import { env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { expect, test } from 'vitest'

import * as schema from '../../lib/data/schema'

const db = drizzle(env.DB, { schema })

interface StateResponse {
  auctionId: string
  status: string
  currentPriceCents: number
  endsAt: string | null
  subscriberCount: number
  version: number
}

interface Seed {
  auctionId: string
  sellerId: string
}

async function seedAuction(prefix: string, leadingBidCents?: number): Promise<Seed> {
  const sellerId = crypto.randomUUID()
  const auctionId = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  await db.insert(schema.users).values({
    id: sellerId,
    email: `${prefix}-seller@example.com`,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(schema.auctions).values({
    id: auctionId,
    sellerId,
    title: `${prefix} metsatükk`,
    slug: `${prefix}-${crypto.randomUUID()}`,
    status: 'active',
    objectType: 'raieoigus',
    minBidCents: 10_000,
    endsAt: '2026-12-31T12:00:00.000Z',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  if (leadingBidCents !== undefined) {
    await insertLeadingBid(auctionId, sellerId, leadingBidCents, '2026-01-01T00:00:00.000Z')
  }
  return { auctionId, sellerId }
}

async function insertLeadingBid(
  auctionId: string,
  userId: string,
  amountCents: number,
  createdAt: string,
): Promise<void> {
  await db.insert(schema.bids).values({
    id: crypto.randomUUID(),
    auctionId,
    userId,
    amountCents,
    type: 'open',
    source: 'manual',
    status: 'leading',
    createdAt,
    updatedAt: createdAt,
  })
}

function fetchRoute(auctionId: string, operation: string, init?: RequestInit): Promise<Response> {
  const stub = env.AUCTION.get(env.AUCTION.idFromName(auctionId))
  return stub.fetch(`https://auction-do/${auctionId}${operation}`, init)
}

async function readState(response: Response): Promise<StateResponse> {
  return (await response.json()) as StateResponse
}

test('GET /state hydrates from D1 on first touch, then serves from storage', async () => {
  const { auctionId, sellerId } = await seedAuction('hydrate', 12_000)

  const first = await fetchRoute(auctionId, '/state')
  expect(first.status).toBe(200)
  expect(await readState(first)).toEqual({
    auctionId,
    status: 'active',
    currentPriceCents: 12_000,
    endsAt: '2026-12-31T12:00:00.000Z',
    subscriberCount: 0,
    version: 1,
  })

  await insertLeadingBid(auctionId, sellerId, 15_000, '2026-01-02T00:00:00.000Z')

  const cached = await fetchRoute(auctionId, '/state')
  expect(cached.status).toBe(200)
  expect((await readState(cached)).currentPriceCents).toBe(12_000)

  const forced = await fetchRoute(auctionId, '/hydrate', { method: 'POST' })
  expect(forced.status).toBe(200)
  const hydrated = await readState(forced)
  expect(hydrated.currentPriceCents).toBe(15_000)
  expect(hydrated.version).toBe(2)
})

test('GET /state falls back to minBidCents without a leading bid', async () => {
  const { auctionId } = await seedAuction('no-bid')

  const response = await fetchRoute(auctionId, '/state')
  expect(response.status).toBe(200)
  expect((await readState(response)).currentPriceCents).toBe(10_000)
})

test('unknown auction id returns 404 from /state and /hydrate', async () => {
  const state = await fetchRoute('no-such-auction', '/state')
  expect(state.status).toBe(404)
  const hydrate = await fetchRoute('no-such-auction', '/hydrate', { method: 'POST' })
  expect(hydrate.status).toBe(404)
})

test('skeleton route stubs return 501', async () => {
  const { auctionId } = await seedAuction('stubs')
  for (const path of ['/bid', '/subscribe', '/publish', '/alarm']) {
    const response = await fetchRoute(auctionId, path, { method: 'POST' })
    expect(response.status, path).toBe(501)
  }
})
