import { contractReadyTemplate } from '@erametsad/emails'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'
import { sendEmail } from '@/lib/notifications/email-sender'
import { notificationsTestRateLimiter } from '@/lib/rate-limit'

async function authenticate(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload.userId
}

async function lookupEmail(userId: string): Promise<string | undefined> {
  try {
    const repos = await getRepositories()
    const user = await repos.findByID({ collection: 'users', id: userId })
    return (user as { email?: string } | null)?.email
  } catch {
    return undefined
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const rateCheck = notificationsTestRateLimiter.check(`my-notifications-test:${userId}`)
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: 'Test-teavitust saab saata ainult ühe korra minutis. Proovige mõne minuti pärast uuesti.' },
      { status: 429 },
    )
  }

  const to = await lookupEmail(userId)
  if (!to) {
    return NextResponse.json(
      { error: 'Kasutaja e-posti aadress puudub; test-teavitust ei saa saata.' },
      { status: 422 },
    )
  }

  // Proves the production pipeline end to end: an existing transactional
  // template rendered by the notification service layer, delivered through
  // the email-sender transport chain to the user's own address.
  const result = await sendEmail({
    ...(process.env.SMTP_FROM ? { from: process.env.SMTP_FROM } : {}),
    to,
    subject: 'Test-teavitus',
    html: contractReadyTemplate({ auctionTitle: 'Näidisoksjon' }),
  })

  if (!result.success) {
    console.error(
      `[notifications-test] send failed via ${result.transport}` +
        ` (code ${result.error?.code ?? 'unknown'}): ${result.error?.message ?? 'unknown error'}`,
    )
    return NextResponse.json(
      { error: `Test-teavituse saatmine ebaõnnestus: ${result.error?.message ?? 'tundmatu viga'}` },
      { status: 502 },
    )
  }

  return NextResponse.json({ status: 'ok', transport: result.transport })
}
