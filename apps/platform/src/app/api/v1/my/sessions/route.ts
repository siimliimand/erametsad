import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import {
  clearSessionCookies,
  getUserSession,
  listUserSessions,
  resolveAccessTokenSession,
  revokeSession,
} from '@/lib/auth/session'

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

export async function GET(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const sessions = await listUserSessions(auth.userId, auth.sessionId ?? undefined)

  return NextResponse.json({
    sessions: sessions.map((session) => ({
      id: session.sessionId,
      createdAt: session.createdAt.toISOString(),
      current: session.current,
    })),
  })
}

export async function DELETE(request: NextRequest) {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const sessionId = request.nextUrl.searchParams.get('id')
  if (!sessionId) {
    return NextResponse.json({ error: 'Sessiooni id on kohustuslik' }, { status: 400 })
  }

  const record = await getUserSession(sessionId)
  if (record?.userId !== auth.userId) {
    return NextResponse.json({ error: 'Sessiooni ei leitud' }, { status: 404 })
  }

  const isCurrent = auth.sessionId === sessionId
  await revokeSession(sessionId)

  const response = NextResponse.json({ revoked: sessionId })
  if (isCurrent) {
    clearSessionCookies(response)
  }

  return response
}
