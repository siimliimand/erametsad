import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { hashCredentialPassword } from '@/lib/auth/password'
import { createSession, setSessionCookies } from '@/lib/auth/session'
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

  const identifier = body.identifier as string | undefined
  const password = body.password as string | undefined
  const profileType = body.profileType as string | undefined
  const consents = body.consents as Record<string, unknown> | undefined
  const regCode = body.regCode as string | undefined
  const companyName = body.companyName as string | undefined

  if (!identifier || !password || !profileType || !consents) {
    return NextResponse.json({ error: 'Puuduvad kohustuslikud väljad' }, { status: 400 })
  }

  if (profileType !== 'private' && profileType !== 'company') {
    return NextResponse.json({ error: 'Vale profiili tüüp' }, { status: 400 })
  }

  const consentTimestamps: Record<string, string> = {}
  for (const key of ['terms', 'privacy', 'marketing']) {
    const raw = consents[key]
    const parsed =
      typeof raw === 'string' || typeof raw === 'number' ? new Date(raw) : undefined
    if (!parsed || Number.isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: 'Nõusolekud (terms, privacy, marketing) on kohustuslikud' },
        { status: 400 },
      )
    }
    consentTimestamps[key] = parsed.toISOString()
  }

  if (profileType === 'company' && (!regCode || !companyName)) {
    return NextResponse.json(
      { error: 'Ettevõtte registrikood ja nimi on kohustuslikud' },
      { status: 400 },
    )
  }

  if (password.length < 8) {
    return NextResponse.json({ error: 'Parool peab olema vähemalt 8 tähemärki' }, { status: 400 })
  }

  const repos = await getRepositories()

  // Hash with the seed's scrypt credential scheme (password_hash +
  // password_salt); the raw password never reaches storage.
  const credentials = hashCredentialPassword(password)
  const userData: Record<string, unknown> = {
    email: identifier,
    passwordHash: credentials.hash,
    passwordSalt: credentials.salt,
    role: profileType === 'company' ? 'company' : 'private',
    authMethod: 'password',
    status: 'active',
  }

  let user: Record<string, unknown>
  try {
    user = (await repos.create({
      collection: 'users',
      data: userData,
    }))
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : ''
    if (message.includes('duplicate') || message.includes('unique')) {
      return NextResponse.json({ error: 'See e-posti aadress on juba kasutusel' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Kasutaja loomine ebaõnnestus' }, { status: 500 })
  }

  const userId = String(user.id)
  const displayName = profileType === 'company' ? companyName : identifier.split('@')[0] ?? identifier

  const profileData: Record<string, unknown> = {
    type: profileType,
    user: userId,
    displayName,
    approvalStatus: profileType === 'company' ? 'pending' : 'approved',
    termsConsentAt: consentTimestamps.terms ?? '',
    privacyConsentAt: consentTimestamps.privacy ?? '',
    marketingConsentAt: consentTimestamps.marketing ?? '',
  }

  if (profileType === 'company') {
    profileData.companyName = companyName
    profileData.companyRegCode = regCode
  }

  const profile = (await repos.create({
    collection: 'profile',
    data: profileData,
  })) as Record<string, unknown>

  const profileId = String(profile.id)

  if (profileType === 'company') {
    await repos.create({
      collection: 'company-access-request',
      data: {
        regCode,
        companyName,
        requesterName: displayName,
        requesterEmail: identifier,
        status: 'pending',
      },
    })
  }

  const { accessToken, refreshToken } = await createSession(
    userId,
    String(user.role),
    profileId,
  )

  const response = NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    profile: {
      id: profile.id,
      type: profile.type,
      displayName: profile.displayName,
      approvalStatus: profile.approvalStatus,
    },
  })

  setSessionCookies(response, accessToken, refreshToken)

  return response
}