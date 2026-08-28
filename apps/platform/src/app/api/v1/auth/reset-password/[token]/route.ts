import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { consumeResetToken } from '@/lib/auth/reset-tokens'
import { revokeAllUserSessions } from '@/lib/auth/session'
import { authRateLimiter } from '@/lib/rate-limit'
import { getPayloadClient } from '@/payload/payloadClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const forwarded = request.headers.get('x-forwarded-for') ?? 'global'
  const rateLimitResult = authRateLimiter.check(forwarded)

  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Liiga palju katseid' }, { status: 429 })
  }

  const { token } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu keha' }, { status: 400 })
  }

  const password = body.password as string | undefined
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: 'Parool peab olema vähemalt 8 tähemärki' },
      { status: 400 },
    )
  }

  const userId = await consumeResetToken(token)
  if (!userId) {
    return NextResponse.json(
      { error: 'Lähtestamise link on aegunud või juba kasutatud' },
      { status: 400 },
    )
  }

  const passwordHash = await hashPassword(password)

  const payload = await getPayloadClient()

  await payload.update({
    collection: 'users',
    id: userId,
    data: { password: passwordHash },
  })

  await revokeAllUserSessions(userId)

  return NextResponse.json({ message: 'Parool on edukalt lähtestatud' })
}