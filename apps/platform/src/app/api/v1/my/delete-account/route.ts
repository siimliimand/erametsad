import { drizzle } from 'drizzle-orm/d1'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  activeParticipationMessage,
  findActiveParticipation,
  hasActiveParticipation,
} from './delete-account'

import { verifyAccessToken } from '@/lib/auth/jwt'
import {
  clearSessionCookies,
  resolveAccessTokenSession,
  revokeAllUserSessions,
  sessionCookieDomainFromHost,
} from '@/lib/auth/session'
import { computeIpHash } from '@/lib/bidding/place-bid'
import { anonymizeUser } from '@/lib/data/repositories/anonymize-user'
import type { CoreDatabase } from '@/lib/data/repositories/repository'
import { getRepositories } from '@/lib/data/runtime'
import * as schema from '@/lib/data/schema'
import { getD1Database } from '@/lib/db'

// D7 (change portal-parity-gap-closure): self-service deletion is an
// anonymize + revoke + audit flow, never a row delete — bids, contracts,
// the consent log and the audit chain reference the user and are
// append-only.

const DELETE_CONFIRMATION = 'KUSTUTA'

async function authenticate(
  request: NextRequest,
): Promise<{ userId: string; sessionId: string | null } | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return { userId: payload.userId, sessionId: ref.state === 'active' ? ref.sessionId : null }
}

/** Drizzle over the D1 binding, built per call like runtime.ts does. */
async function coreDatabase(): Promise<CoreDatabase> {
  const d1 = await getD1Database()
  return drizzle(d1 as unknown as Parameters<typeof drizzle>[0], { schema })
}

export async function POST(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigased andmed' }, { status: 400 })
  }

  if (body.confirmation !== DELETE_CONFIRMATION) {
    return NextResponse.json(
      { error: 'Kinnituseks kirjuta KUSTUTA' },
      { status: 400 },
    )
  }

  const repos = await getRepositories()
  const user = await repos.findByID({ collection: 'users', id: auth.userId })
  if (!user) {
    return NextResponse.json({ error: 'Kasutajat ei leitud' }, { status: 404 })
  }

  const participation = await findActiveParticipation(repos, auth.userId)
  if (hasActiveParticipation(participation)) {
    return NextResponse.json(
      { error: activeParticipationMessage(participation) },
      { status: 409 },
    )
  }

  await anonymizeUser(await coreDatabase(), auth.userId)
  await revokeAllUserSessions(auth.userId)

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const userAgent = request.headers.get('user-agent')?.trim()
  await repos.create({
    collection: 'audit-entry',
    data: {
      actorId: auth.userId,
      action: 'user-self-deletion',
      entityType: 'user',
      entityId: auth.userId,
      before: { email: user.email, status: user.status },
      after: { status: 'deleted', anonymized: true },
      reason: 'user-self-deletion',
      ...(auth.sessionId ? { sessionId: auth.sessionId } : {}),
      ...(ip && ip.length > 0 ? { ipHash: computeIpHash(ip) } : {}),
      ...(userAgent && userAgent.length > 0 ? { userAgent: userAgent.slice(0, 512) } : {}),
    },
  })

  // The current session just died server-side; drop the cookies on the
  // response so the very next document load is signed out.
  const response = NextResponse.json({ status: 'ok' })
  clearSessionCookies(response, sessionCookieDomainFromHost(request.headers.get('host')))
  return response
}
