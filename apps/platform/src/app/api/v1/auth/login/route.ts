import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyCredentialPassword } from '@/lib/auth/password'
import { createSession, setSessionCookies } from '@/lib/auth/session'
import { hash } from '@/lib/crypto'
import { getRepositories } from '@/lib/data/runtime'
import { authRateLimiter } from '@/lib/rate-limit'
import { getUserRole } from '@/payload/access/roles'

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
    return NextResponse.json(
      { error: 'Vale kasutajanimi või parool' },
      { status: 401 },
    )
  }

  const identifier = body.identifier as string | undefined
  const password = body.password as string | undefined

  if (!identifier || !password) {
    return NextResponse.json(
      { error: 'Vale kasutajanimi või parool' },
      { status: 401 },
    )
  }

  const repos = await getRepositories()

  const isEmail = identifier.includes('@')
  let user: Record<string, unknown> | null = null

  if (isEmail) {
    const result = await repos.find({
      collection: 'users',
      where: { email: { equals: identifier } },
      limit: 1,
    })
    user = (result.docs[0] as Record<string, unknown> | undefined) ?? null
  } else {
    const isikukoodHash = hash(identifier)
    const result = await repos.find({
      collection: 'users',
      where: { isikukoodHash: { equals: isikukoodHash } },
      limit: 1,
    })
    user = (result.docs[0] as Record<string, unknown> | undefined) ?? null
  }

  if (!user) {
    return NextResponse.json(
      { error: 'Vale kasutajanimi või parool' },
      { status: 401 },
    )
  }

  // Credentials live in the password_hash/password_salt columns; verify
  // the password directly (the scrypt scheme the seed writes). The
  // comparison below runs regardless of the outcome, so a missing or
  // malformed stored credential behaves exactly like a wrong password.
  const passwordOk = verifyCredentialPassword(
    password,
    user.passwordHash as string | null,
    user.passwordSalt as string | null,
  )
  if (!passwordOk) {
    return NextResponse.json(
      { error: 'Vale kasutajanimi või parool' },
      { status: 401 },
    )
  }

  if (user.status === 'suspended') {
    return NextResponse.json(
      { error: 'Vale kasutajanimi või parool' },
      { status: 401 },
    )
  }

  const userId = String(user.id)
  const role = getUserRole(user.role as string | undefined)
  const profileId = user.profileId as string | undefined
  const { accessToken, refreshToken } = await createSession(userId, role, profileId)

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  })

  setSessionCookies(response, accessToken, refreshToken)

  return response
}