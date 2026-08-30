import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { AuctionSubscriptionDoc, UpdateDataFor } from '@/lib/data/repositories/registry'
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu sisu' }, { status: 400 })
  }

  const data: UpdateDataFor<'auction-subscriptions'> = {}

  if (body.filterJson !== undefined) {
    const filterJson = body.filterJson
    if (typeof filterJson !== 'object' || filterJson === null || Array.isArray(filterJson)) {
      return NextResponse.json({ error: 'Filtri andmed peavad olema objekt' }, { status: 400 })
    }
    data.filterJson = filterJson
  }

  if (body.channel !== undefined) {
    const channel = body.channel
    if (typeof channel !== 'string' || !CREATE_CHANNELS.includes(channel as NotificationChannel)) {
      return NextResponse.json({ error: 'Kanal peab olema email või sms' }, { status: 400 })
    }
    data.channel = channel as NotificationChannel
  }

  if (body.frequency !== undefined) {
    const frequency = body.frequency
    if (typeof frequency !== 'string' || !FREQUENCIES.includes(frequency as SubscriptionFrequency)) {
      return NextResponse.json(
        { error: 'Sagedus peab olema immediate, daily või weekly' },
        { status: 400 },
      )
    }
    data.frequency = frequency as SubscriptionFrequency
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Puuduvad uuendatavad väljad' }, { status: 400 })
  }

  const repos = await getRepositories()
  const scoped = await repos.find({
    collection: 'auction-subscriptions',
    where: { and: [{ id: { equals: id } }, { userId: { equals: userId } }] },
    limit: 1,
  })
  if (!scoped.docs[0]) {
    return NextResponse.json({ error: 'Tellimust ei leitud' }, { status: 404 })
  }

  const updated = await repos.update({ collection: 'auction-subscriptions', id, data })

  return NextResponse.json(toSubscriptionDto(updated))
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const { id } = await params

  const repos = await getRepositories()
  const scoped = await repos.find({
    collection: 'auction-subscriptions',
    where: { and: [{ id: { equals: id } }, { userId: { equals: userId } }] },
    limit: 1,
  })
  if (!scoped.docs[0]) {
    return NextResponse.json({ error: 'Tellimust ei leitud' }, { status: 404 })
  }

  await repos.delete({ collection: 'auction-subscriptions', id })

  return NextResponse.json({ success: true })
}
