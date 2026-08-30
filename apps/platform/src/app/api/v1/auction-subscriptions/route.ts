import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { AuctionSubscriptionDoc } from '@/lib/data/repositories/registry'
import { getRepositories } from '@/lib/data/runtime'
import type { NotificationChannel, SubscriptionFrequency } from '@/lib/data/schema'

const CREATE_CHANNELS: readonly NotificationChannel[] = ['email', 'sms']
const FREQUENCIES: readonly SubscriptionFrequency[] = ['immediate', 'daily', 'weekly']

function authenticate(request: NextRequest): string | null {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null
  return verifyAccessToken(token)?.userId ?? null
}

function toSubscriptionDto(doc: AuctionSubscriptionDoc) {
  return {
    id: doc.id,
    filter: doc.filterJson ?? null,
    channel: doc.channel,
    frequency: doc.frequency,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

export async function GET(request: NextRequest) {
  const userId = authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'auction-subscriptions',
    where: { userId: { equals: userId } },
    sort: '-createdAt',
    pagination: false,
  })

  return NextResponse.json({ items: result.docs.map(toSubscriptionDto) })
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu sisu' }, { status: 400 })
  }

  const userId = authenticate(request)

  const filterJson = body.filterJson
  if (typeof filterJson !== 'object' || filterJson === null || Array.isArray(filterJson)) {
    return NextResponse.json({ error: 'Filtri andmed on kohustuslikud' }, { status: 400 })
  }

  const channel = body.channel
  if (typeof channel !== 'string' || !CREATE_CHANNELS.includes(channel as NotificationChannel)) {
    return NextResponse.json({ error: 'Kanal peab olema email või sms' }, { status: 400 })
  }

  const frequency = body.frequency
  if (typeof frequency !== 'string' || !FREQUENCIES.includes(frequency as SubscriptionFrequency)) {
    return NextResponse.json(
      { error: 'Sagedus peab olema immediate, daily või weekly' },
      { status: 400 },
    )
  }

  // Consent is required for guest signups and every email channel: without
  // it the send would violate the opt-in rules that leads already follow.
  if ((!userId || channel === 'email') && body.consent !== true) {
    return NextResponse.json({ error: 'Nõusolek on kohustuslik' }, { status: 400 })
  }

  const repos = await getRepositories()
  const created = await repos.create({
    collection: 'auction-subscriptions',
    data: {
      userId: userId ?? null,
      filterJson,
      channel: channel as NotificationChannel,
      frequency: frequency as SubscriptionFrequency,
      unsubscribeToken: crypto.randomUUID(),
      status: 'active',
    },
  })

  return NextResponse.json(toSubscriptionDto(created), { status: 201 })
}
