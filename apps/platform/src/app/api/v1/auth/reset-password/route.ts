import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { hashCredentialPassword } from '@/lib/auth/password'
import { consumeResetToken } from '@/lib/auth/reset-tokens'
import { revokeAllUserSessions } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'
import { authRateLimiter } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') ?? 'global'
  const rateLimitResult = authRateLimiter.check(forwarded)

  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Liiga palju katseid' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu keha' }, { status: 400 })
  }

  const token = body.token as string | undefined
  const password = body.password as string | undefined

  if (!token || !password) {
    return NextResponse.json(
      { error: 'Lähtestamise link ja uus parool on kohustuslikud' },
      { status: 400 },
    )
  }

  if (typeof password !== 'string' || password.length < 10) {
    return NextResponse.json(
      { error: 'Parool peab olema vähemalt 10 tähemärki' },
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

  const repos = await getRepositories()

  // Hash with the seed's scrypt credential scheme; the raw password never
  // reaches storage.
  const credentials = hashCredentialPassword(password)
  await repos.update({
    collection: 'users',
    id: userId,
    data: {
      passwordHash: credentials.hash,
      passwordSalt: credentials.salt,
    },
  })

  await revokeAllUserSessions(userId)

  return NextResponse.json({ message: 'Parool on edukalt lähtestatud' })
}
