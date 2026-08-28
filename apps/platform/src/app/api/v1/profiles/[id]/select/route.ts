import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyRefreshToken } from '@/lib/auth/jwt'
import { selectActiveProfile } from '@/lib/auth/profile-scope'
import {
  getUserSession,
  issueSessionAccessToken,
  setAccessTokenCookie,
} from '@/lib/auth/session'
import { getPayloadClient } from '@/payload/payloadClient'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: profileId } = await params

  const refreshToken =
    request.cookies.get('refresh_token')?.value ??
    request.headers.get('authorization')?.replace('Bearer ', '')

  if (!refreshToken) {
    return NextResponse.json({ error: 'Autentimata' }, { status: 401 })
  }

  const payload_session = verifyRefreshToken(refreshToken)
  if (!payload_session) {
    return NextResponse.json({ error: 'Sessioon on aegunud' }, { status: 401 })
  }

  const session = await getUserSession(payload_session.sessionId)
  if (!session) {
    return NextResponse.json({ error: 'Sessioon on aegunud' }, { status: 401 })
  }

  const payload = await getPayloadClient()

  const profileResult = await payload.findByID({
    collection: 'profile',
    id: profileId,
    depth: 0,
  }) as Record<string, unknown> | null

  if (!profileResult) {
    return NextResponse.json({ error: 'Profiili ei leitud' }, { status: 404 })
  }

  const profile = profileResult
  const userId = profile.user as string | undefined

  if (!userId) {
    return NextResponse.json({ error: 'Profiil ei kuulu kasutajale' }, { status: 403 })
  }

  if (userId !== session.userId) {
    return NextResponse.json({ error: 'Profiil ei kuulu kasutajale' }, { status: 403 })
  }

  await selectActiveProfile(session.userId, profileId)

  const accessToken = await issueSessionAccessToken(payload_session.sessionId)
  if (!accessToken) {
    return NextResponse.json({ error: 'Sessioon on aegunud' }, { status: 401 })
  }

  const profileResponse: Record<string, unknown> = {
    id: profile.id,
    type: profile.type,
    displayName: profile.displayName,
  }

  if (profile.type === 'company') {
    profileResponse.companyName = profile.companyName
    profileResponse.companyRegCode = profile.companyRegCode
    profileResponse.approvalStatus = profile.approvalStatus
  }

  const response = NextResponse.json({ profile: profileResponse })
  setAccessTokenCookie(response, accessToken)
  return response
}