import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { hashCredentialPassword, verifyCredentialPassword } from '@/lib/auth/password'
import { checkPasswordPolicy } from '@/lib/auth/password-policy'
import { clearSessionCookies, revokeAllUserSessions } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'
import { authRateLimiter } from '@/lib/rate-limit'

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

  const repos = await getRepositories()

  const user = await repos.findByID({
    collection: 'users',
    id: tokenPayload.userId,
  })

  // Same rules the strength meter shows the user, now also server-enforced.
  const [policyViolation] = checkPasswordPolicy(newPassword, user?.isikukood)
  if (policyViolation) {
    return NextResponse.json({ error: policyViolation.message }, { status: 400 })
  }

  // Verify the old password against the stored credential columns (the
  // scrypt scheme the seed writes); a missing stored credential behaves
  // exactly like a wrong password.
  const oldPasswordOk = verifyCredentialPassword(
    oldPassword,
    user?.passwordHash ?? null,
    user?.passwordSalt ?? null,
  )
  if (!oldPasswordOk) {
    return NextResponse.json({ error: 'Vale vana parool' }, { status: 400 })
  }

  // Hash with the same credential scheme; the raw password never reaches
  // storage.
  const credentials = hashCredentialPassword(newPassword)
  await repos.update({
    collection: 'users',
    id: tokenPayload.userId,
    data: {
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
    },
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
