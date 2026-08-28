import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { hashPassword } from '@/lib/auth/password'
import { createSession, setSessionCookies } from '@/lib/auth/session'
import { authRateLimiter } from '@/lib/rate-limit'
import { getPayloadClient } from '@/payload/payloadClient'

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

  const termsTimestamp = consents.terms as string | number | undefined
  const privacyTimestamp = consents.privacy as string | number | undefined

  if (!termsTimestamp || !privacyTimestamp) {
    return NextResponse.json(
      { error: 'Nõusolekud (terms, privacy) on kohustuslikud' },
      { status: 400 },
    )
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

  const payload = await getPayloadClient()
  const passwordHash = await hashPassword(password)

  const userData: Record<string, unknown> = {
    email: identifier,
    password: passwordHash,
    role: profileType === 'company' ? 'company' : 'private',
    authMethod: 'password',
    status: 'active',
  }

  let user: Record<string, unknown>
  try {
    user = (await payload.create({
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
  }

  if (profileType === 'company') {
    profileData.companyName = companyName
    profileData.companyRegCode = regCode
  }

  const profile = (await payload.create({
    collection: 'profile',
    data: profileData,
  })) as Record<string, unknown>

  const profileId = String(profile.id)

  if (profileType === 'company') {
    await payload.create({
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

  const { accessToken, refreshToken } = await createSession(userId, profileId)

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