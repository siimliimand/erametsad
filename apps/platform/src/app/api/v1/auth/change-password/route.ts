import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { clearSessionCookies, revokeAllUserSessions } from '@/lib/auth/session'
import { authRateLimiter } from '@/lib/rate-limit'
import { getPayloadClient } from '@/payload/payloadClient'

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') ?? 'global'
  const rateLimitResult = authRateLimiter.check(forwarded)

  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Liiga palju katseid' }, { status: 429 })
  }

  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu keha' }, { status: 400 })
  }

  const oldPassword = body.oldPassword as string | undefined
  const newPassword = body.newPassword as string | undefined

  if (!oldPassword || !newPassword) {
    return NextResponse.json(
      { error: 'Vana ja uus parool on kohustuslikud' },
      { status: 400 },
    )
  }

  if (typeof newPassword !== 'string' || newPassword.length < 10) {
    return NextResponse.json(
      { error: 'Parool peab olema vähemalt 10 tähemärki' },
      { status: 400 },
    )
  }

  const payload = await getPayloadClient()

  const user = (await payload.findByID({
    collection: 'users',
    id: tokenPayload.userId,
    depth: 0,
  })) as Record<string, unknown>

  // Payload auth collections never return stored credentials, so verify the
  // old password through payload.login (Payload's own comparison) instead
  // of a user.password field that does not exist.
  try {
    await payload.login({
      collection: 'users',
      data: { email: user.email as string, password: oldPassword },
      depth: 0,
    })
  } catch {
    return NextResponse.json({ error: 'Vale vana parool' }, { status: 400 })
  }

  // Raw password: Payload's auth field applies its own hashing on update.
  await payload.update({
    collection: 'users',
    id: tokenPayload.userId,
    data: { password: newPassword },
  })

  // The access token carries no session id, so the session store exposes no
  // way to spare the current session: revoke all and let the client log in
  // again with the new password.
  await revokeAllUserSessions(tokenPayload.userId)

  const response = NextResponse.json({
    message: 'Parool on muudetud. Palun logige uuesti sisse.',
  })
  clearSessionCookies(response)

  return response
}
