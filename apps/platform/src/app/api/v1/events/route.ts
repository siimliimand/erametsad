import { NextResponse } from 'next/server'

import { computeIpHash } from '@/lib/bidding/place-bid'
import { getRepositories } from '@/lib/data/runtime'
import { eventsRateLimiter } from '@/lib/rate-limit'

const MAX_NAME_LENGTH = 64
const MAX_PROPS_KEYS = 32
const MAX_PROPS_LENGTH = 4096
const CONSENT_COOKIE = 'eametsad_consent'

function extractIp(request: Request): string {
  const raw = request.headers.get('x-forwarded-for')
  const first = raw?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() === name) {
      return part.slice(separator + 1).trim()
    }
  }
  return null
}

// Cookie value is URL-encoded JSON per the shell spec (written by task 2.4):
// {"necessary":true,"statistics":false,"marketing":true}. Anything
// unreadable counts as no statistics consent.
function hasStatisticsConsent(request: Request): boolean {
  const raw = readCookie(request, CONSENT_COOKIE)
  if (!raw) return false
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return false
    }
    return (parsed as Record<string, unknown>).statistics === true
  } catch {
    return false
  }
}

// undefined = absent (valid), null = malformed or oversized.
function parseProps(value: unknown): Record<string, unknown> | null | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'object' || Array.isArray(value) || value === null) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).length > MAX_PROPS_KEYS) return null
  const serialized = JSON.stringify(record)
  if (serialized.length > MAX_PROPS_LENGTH) return null
  return record
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = eventsRateLimiter.check(`events:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane JSON' }, { status: 400 })
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
    return NextResponse.json({ error: 'Sobimatu sündmuse nimi' }, { status: 400 })
  }

  const props = parseProps(body.props)
  if (props === null) {
    return NextResponse.json({ error: 'Sobimatud omadused' }, { status: 400 })
  }

  // Server-side mirror of the client gating in track(): without statistics
  // consent only cookie_consent passes (design D4). The event is dropped
  // silently with 202, so the response does not reveal the consent state
  // and clients have no reason to retry.
  if (name !== 'cookie_consent' && !hasStatisticsConsent(request)) {
    return NextResponse.json({ status: 'ok' }, { status: 202 })
  }

  const ipHash = computeIpHash(ip)

  try {
    const repos = await getRepositories()
    await repos.create({
      collection: 'analytics-events',
      data: {
        name,
        props: props ?? null,
        ipHash,
      },
    })

    return NextResponse.json({ status: 'ok' }, { status: 201 })
  } catch (error) {
    console.error('[events] logging failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
