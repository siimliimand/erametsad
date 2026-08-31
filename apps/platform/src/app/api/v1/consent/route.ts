import { NextResponse } from 'next/server'

import { computeIpHash } from '@/lib/bidding/place-bid'
import { getRepositories } from '@/lib/data/runtime'
import { consentRateLimiter } from '@/lib/rate-limit'

const MAX_CATEGORY_KEYS = 32
const MAX_CATEGORY_KEY_LENGTH = 64

function extractIp(request: Request): string {
  const raw = request.headers.get('x-forwarded-for')
  const first = raw?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

function parseCategories(value: unknown): Record<string, boolean> | null {
  if (value === undefined || value === null) return {}
  if (typeof value !== 'object' || Array.isArray(value)) return null
  const entries = Object.entries(value as Record<string, unknown>)
  if (entries.length > MAX_CATEGORY_KEYS) return null
  const out: Record<string, boolean> = {}
  for (const [key, categoryValue] of entries) {
    if (key.length === 0 || key.length > MAX_CATEGORY_KEY_LENGTH) return null
    if (typeof categoryValue !== 'boolean') return null
    out[key] = categoryValue
  }
  return out
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = consentRateLimiter.check(`consent:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane JSON' }, { status: 400 })
  }

  const choice = typeof body.choice === 'string' ? body.choice.trim() : ''
  if (choice !== 'accepted' && choice !== 'rejected' && choice !== 'custom') {
    return NextResponse.json({ error: 'Sobimatu nõusoleku valik' }, { status: 400 })
  }

  const categories = parseCategories(body.categories)
  if (categories === null) {
    return NextResponse.json({ error: 'Sobimatud kategooriad' }, { status: 400 })
  }

  const ipHash = computeIpHash(ip)

  try {
    const repos = await getRepositories()
    await repos.create({
      collection: 'consent-log',
      data: {
        choice,
        categories,
        ipHash,
      },
    })

    return NextResponse.json({ status: 'ok' }, { status: 201 })
  } catch (error) {
    console.error('[consent] logging failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
