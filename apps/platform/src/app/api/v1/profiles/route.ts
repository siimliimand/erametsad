import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import type { ProfileDoc } from '@/lib/data/repositories/registry'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'

async function authenticate(request: NextRequest): Promise<AccessTokenPayload | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload
}

// The company registry fields (companyName, companyRegCode) are read-only;
// type, approvalStatus and userId are never client-writable.
function toPublicProfile(profile: ProfileDoc): Record<string, unknown> {
  const out: Record<string, unknown> = {
    id: profile.id,
    type: profile.type,
    displayName: profile.displayName,
    phone: profile.phone,
    approvalStatus: profile.approvalStatus,
    termsConsentAt: profile.termsConsentAt,
    privacyConsentAt: profile.privacyConsentAt,
    marketingConsentAt: profile.marketingConsentAt,
    notificationPreferences: profile.notificationPreferences,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  }
  if (profile.type === 'company') {
    out.companyName = profile.companyName
    out.companyRegCode = profile.companyRegCode
  }
  return out
}

const TEXT_FIELD_LIMITS: Record<string, number> = { displayName: 120, phone: 32 }

const CONSENT_AT_FIELDS = {
  termsConsent: 'termsConsentAt',
  privacyConsent: 'privacyConsentAt',
  marketingConsent: 'marketingConsentAt',
} as const

// notificationPreferences: { [event]: { email?: boolean, sms?: boolean } }.
// At least one channel per event; bounded count keeps the TEXT cell small.
const MAX_PREFERENCE_EVENTS = 32

function validateNotificationPreferences(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_PREFERENCE_EVENTS) return null
  const out: Record<string, unknown> = {}
  for (const [event, channels] of entries) {
    if (event.trim() === '') return null
    if (typeof channels !== 'object' || channels === null || Array.isArray(channels)) return null
    const { email, sms } = channels as Record<string, unknown>
    if (email !== undefined && typeof email !== 'boolean') return null
    if (sms !== undefined && typeof sms !== 'boolean') return null
    if (email === undefined && sms === undefined) return null
    const cleaned: Record<string, boolean> = {}
    if (email !== undefined) cleaned.email = email
    if (sms !== undefined) cleaned.sms = sms
    out[event] = cleaned
  }
  return out
}

export async function GET(request: NextRequest) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const repos = await getRepositories(sessionGuardContext(payload))
  const { docs } = await repos.find({ collection: 'profile' })

  return NextResponse.json({ profiles: docs.map(toPublicProfile) })
}

export async function PATCH(request: NextRequest) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigased andmed' }, { status: 400 })
  }

  const data: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(body)) {
    const limit = TEXT_FIELD_LIMITS[key]
    if (limit !== undefined) {
      if (value !== null && typeof value !== 'string') {
        return NextResponse.json({ error: `Vigane väli: ${key}` }, { status: 400 })
      }
      const text = typeof value === 'string' ? value.trim() : null
      if (text !== null && (text.length === 0 || text.length > limit)) {
        return NextResponse.json({ error: `Vigane väli: ${key}` }, { status: 400 })
      }
      data[key] = text
      continue
    }
    if (key in CONSENT_AT_FIELDS) {
      if (typeof value !== 'boolean') {
        return NextResponse.json({ error: `Vigane väli: ${key}` }, { status: 400 })
      }
      data[CONSENT_AT_FIELDS[key as keyof typeof CONSENT_AT_FIELDS]] = value
        ? new Date().toISOString()
        : null
      continue
    }
    if (key === 'notificationPreferences') {
      const prefs = validateNotificationPreferences(value)
      if (prefs === null) {
        return NextResponse.json(
          { error: 'Vigane väli: notificationPreferences' },
          { status: 400 },
        )
      }
      data[key] = prefs
      continue
    }
    return NextResponse.json({ error: `Lubamatu väli: ${key}` }, { status: 400 })
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Pole midagi uuendada' }, { status: 400 })
  }

  const repos = await getRepositories(sessionGuardContext(payload))
  const { docs } = await repos.find({ collection: 'profile' })
  if (docs.length === 0) {
    return NextResponse.json({ error: 'Profiili ei leitud' }, { status: 404 })
  }

  const updated: ProfileDoc[] = []
  for (const profile of docs) {
    updated.push(await repos.update({ collection: 'profile', id: profile.id, data }))
  }

  return NextResponse.json({ profiles: updated.map(toPublicProfile) })
}
