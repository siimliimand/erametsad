import { env, fetchMock, runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { expect, test } from 'vitest'

import * as schema from '../../lib/data/schema'
import type { AuctionDO } from '../auction'

const db = drizzle(env.DB, { schema })

interface StateResponse {
  auctionId: string
  status: string
  currentPriceCents: number
  endsAt: string | null
  subscriberCount: number
  version: number
}

interface AdmissionResponse {
  allowed: boolean
  bid?: {
    id: string
    status: string
    amount: number
    source: string
    idempotencyKey?: string
  }
  error?: string
  status?: number
  code?: string
  replayed?: boolean
  previousLeading?: { userId: string; amount: number } | null
  autobid?: { userId: string; amount: number; placedAt: string } | null
  extended?: { previousEndsAt: string; endsAt: string; windowMinutes: number } | null
}

interface Seed {
  auctionId: string
  sellerId: string
  bidderId: string
}

async function seedAuction(
  prefix: string,
  options: {
    leadingBidCents?: number
    bidStepCents?: number
    bidderStatus?: 'active' | 'suspended'
    withBidderRight?: boolean
    endsAt?: string
    auctionType?: 'open' | 'sealed'
    reservePriceCents?: number
  } = {},
): Promise<Seed> {
  const {
    leadingBidCents,
    bidStepCents = null,
    bidderStatus = 'active',
    withBidderRight = true,
    endsAt,
    auctionType,
    reservePriceCents,
  } = options
  const sellerId = crypto.randomUUID()
  const bidderId = crypto.randomUUID()
  const auctionId = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  await db.insert(schema.users).values([
    {
      id: sellerId,
      email: `${prefix}-seller@example.com`,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: bidderId,
      email: `${prefix}-bidder@example.com`,
      status: bidderStatus,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ])
  await db.insert(schema.auctions).values({
    id: auctionId,
    sellerId,
    title: `${prefix} metsatükk`,
    slug: `${prefix}-${crypto.randomUUID()}`,
    status: 'active',
    objectType: 'raieoigus',
    ...(auctionType !== undefined ? { type: auctionType } : {}),
    minBidCents: 10_000,
    ...(bidStepCents !== null ? { bidStepCents } : {}),
    ...(reservePriceCents !== undefined ? { reservePriceCents } : {}),
    endsAt: endsAt ?? '2026-12-31T12:00:00.000Z',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  if (withBidderRight) {
    await db.insert(schema.auctionRights).values({
      id: crypto.randomUUID(),
      userId: bidderId,
      objectType: 'raieoigus',
      grantedBy: sellerId,
      grantedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
  if (leadingBidCents !== undefined) {
    await insertLeadingBid(auctionId, sellerId, leadingBidCents, '2026-01-01T00:00:00.000Z')
  }
  return { auctionId, sellerId, bidderId }
}

async function insertLeadingBid(
  auctionId: string,
  userId: string,
  amountCents: number,
  createdAt: string,
  type: 'open' | 'sealed' = 'open',
): Promise<void> {
  await db.insert(schema.bids).values({
    id: crypto.randomUUID(),
    auctionId,
    userId,
    amountCents,
    type,
    source: 'manual',
    status: 'leading',
    createdAt,
    updatedAt: createdAt,
  })
}

function stubFor(auctionId: string) {
  return env.AUCTION.get(env.AUCTION.idFromName(auctionId))
}

// The ambient DurableObjectState the pool-workers types resolve to predates
// the alarm API, so read it through a structural cast; the runtime has it.
interface AlarmCapableStorage {
  getAlarm(): Promise<number | null>
}

async function storedAlarm(auctionId: string): Promise<number | null> {
  return runInDurableObject(stubFor(auctionId), (_instance, state) =>
    (state as unknown as { storage: AlarmCapableStorage }).storage.getAlarm(),
  )
}

async function fireAlarm(auctionId: string): Promise<void> {
  await runInDurableObject(stubFor(auctionId), (instance: AuctionDO) => instance.alarm())
}

async function auctionRow(auctionId: string) {
  const rows = await db.select().from(schema.auctions).where(eq(schema.auctions.id, auctionId))
  return rows[0]
}

async function auditActions(auctionId: string): Promise<string[]> {
  const rows = await db
    .select()
    .from(schema.auditEntries)
    .where(eq(schema.auditEntries.entityId, auctionId))
  return rows.map((row) => row.action)
}

async function notificationsFor(userId: string) {
  return db.select().from(schema.notifications).where(eq(schema.notifications.userId, userId))
}

function fetchRoute(auctionId: string, operation: string, init?: RequestInit): Promise<Response> {
  const stub = env.AUCTION.get(env.AUCTION.idFromName(auctionId))
  return stub.fetch(`https://auction-do/${auctionId}${operation}`, init)
}

async function readState(response: Response): Promise<StateResponse> {
  return (await response.json()) as StateResponse
}

async function placeBidRoute(
  auctionId: string,
  body: Record<string, unknown>,
): Promise<{ response: Response; admission: AdmissionResponse }> {
  const response = await fetchRoute(auctionId, '/bid', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { response, admission: (await response.json()) as AdmissionResponse }
}

async function subscribe(auctionId: string, url: string): Promise<Response> {
  return fetchRoute(auctionId, '/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
}

test('GET /state hydrates from D1 on first touch, then serves from storage', async () => {
  const { auctionId, sellerId } = await seedAuction('hydrate', { leadingBidCents: 12_000 })

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

test('route stubs still unimplemented return 501', async () => {
  const { auctionId } = await seedAuction('stubs')
  const response = await fetchRoute(auctionId, '/alarm', { method: 'POST' })
  expect(response.status).toBe(501)
})

test('POST /bid accepts a valid bid and writes bid, auction update, and audit entry', async () => {
  const { auctionId, bidderId } = await seedAuction('accept')

  const { response, admission } = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 150,
    type: 'open',
  })
  expect(response.status).toBe(200)
  expect(admission.allowed).toBe(true)
  expect(admission.bid?.status).toBe('leading')
  expect(admission.bid?.amount).toBe(150)

  const rows = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.id, admission.bid?.id ?? ''))
  expect(rows).toHaveLength(1)
  expect(rows[0]?.amountCents).toBe(15_000)
  expect(rows[0]?.status).toBe('leading')

  const auctionRows = await db
    .select()
    .from(schema.auctions)
    .where(eq(schema.auctions.id, auctionId))
  expect(auctionRows[0]?.endsAt).toBe('2026-12-31T12:00:00.000Z')
  expect(auctionRows[0]?.updatedAt).toBe(rows[0]?.createdAt)

  const auditRows = await db
    .select()
    .from(schema.auditEntries)
    .where(eq(schema.auditEntries.entityId, admission.bid?.id ?? ''))
  expect(auditRows).toHaveLength(1)
  expect(auditRows[0]?.action).toBe('bid_placed')
  expect(auditRows[0]?.actorId).toBe(bidderId)

  const state = await readState(await fetchRoute(auctionId, '/state'))
  expect(state.currentPriceCents).toBe(15_000)
  expect(state.version).toBe(2)
})

test('POST /bid rejects an amount below the leader plus step', async () => {
  const { auctionId, bidderId } = await seedAuction('step', {
    leadingBidCents: 12_000,
    bidStepCents: 500,
  })

  const { admission } = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 120,
    type: 'open',
  })
  expect(admission.allowed).toBe(false)
  expect(admission.status).toBe(400)
  expect(admission.error).toBe('Bid must be at least 125 EUR')

  const rows = await db.select().from(schema.bids).where(eq(schema.bids.auctionId, auctionId))
  expect(rows).toHaveLength(1)
})

test('POST /bid rejects a suspended user and a user without rights', async () => {
  const suspended = await seedAuction('suspended', { bidderStatus: 'suspended' })
  const suspendedResult = await placeBidRoute(suspended.auctionId, {
    userId: suspended.bidderId,
    amount: 150,
    type: 'open',
  })
  expect(suspendedResult.admission.allowed).toBe(false)
  expect(suspendedResult.admission.status).toBe(403)

  const rightless = await seedAuction('rightless', { withBidderRight: false })
  const rightlessResult = await placeBidRoute(rightless.auctionId, {
    userId: rightless.bidderId,
    amount: 150,
    type: 'open',
  })
  expect(rightlessResult.admission.allowed).toBe(false)
  expect(rightlessResult.admission.status).toBe(403)
  expect(rightlessResult.admission.error).toBe('No bidding right for this object type')
})

test('POST /bid replays the stored result for a repeated idempotency key', async () => {
  const { auctionId, bidderId } = await seedAuction('idem')

  const first = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 150,
    type: 'open',
    idempotencyKey: 'retry-once',
  })
  expect(first.admission.allowed).toBe(true)

  const second = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 150,
    type: 'open',
    idempotencyKey: 'retry-once',
  })
  expect(second.admission.allowed).toBe(true)
  expect(second.admission.replayed).toBe(true)
  expect(second.admission.bid?.id).toBe(first.admission.bid?.id)

  const rows = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.idempotencyKey, 'retry-once'))
  expect(rows).toHaveLength(1)
})

test('POST /bid runs the autobidder after an accepted leading bid', async () => {
  const { auctionId, sellerId, bidderId } = await seedAuction('autobid', {
    leadingBidCents: 12_000,
    bidStepCents: 500,
  })
  const autobidderId = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  await db.insert(schema.users).values({
    id: autobidderId,
    email: `autobid-max-user@example.com`,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(schema.auctionRights).values({
    id: crypto.randomUUID(),
    userId: autobidderId,
    objectType: 'raieoigus',
    grantedBy: sellerId,
    grantedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(schema.autobidders).values({
    id: crypto.randomUUID(),
    userId: autobidderId,
    auctionId,
    maxAmountCents: 20_000,
    status: 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  })

  const { admission } = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 130,
    type: 'open',
  })
  expect(admission.allowed).toBe(true)
  expect(admission.autobid).toEqual({
    userId: autobidderId,
    amount: 135,
    placedAt: expect.any(String) as string,
  })

  const leading = await db
    .select()
    .from(schema.bids)
    .where(eq(schema.bids.status, 'leading'))
  const forAuction = leading.filter((row) => row.auctionId === auctionId)
  expect(forAuction).toHaveLength(1)
  expect(forAuction[0]?.userId).toBe(autobidderId)
  expect(forAuction[0]?.amountCents).toBe(13_500)
  expect(forAuction[0]?.source).toBe('autobidder')
})

test('subscription lifecycle: add, dedupe, remove', async () => {
  const { auctionId } = await seedAuction('subs')

  const first = await subscribe(auctionId, 'https://sub1.example/callback')
  expect(first.status).toBe(200)
  expect(await first.json()).toEqual({
    url: 'https://sub1.example/callback',
    subscriberCount: 1,
    added: true,
  })

  const duplicate = await subscribe(auctionId, 'https://sub1.example/callback')
  expect((await (duplicate.json() as Promise<{ subscriberCount: number }>)).subscriberCount).toBe(1)

  await subscribe(auctionId, 'https://sub2.example/callback')

  const removed = await fetchRoute(auctionId, '/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://sub1.example/callback' }),
  })
  expect(removed.status).toBe(200)
  expect(
    await (removed.json() as Promise<{ subscriberCount: number }>),
  ).toMatchObject({ subscriberCount: 1 })

  const state = await readState(await fetchRoute(auctionId, '/state'))
  expect(state.subscriberCount).toBe(1)

  const invalid = await subscribe(auctionId, 'ftp://sub3.example')
  expect(invalid.status).toBe(400)
})

test('accepted bid fans out bid:created to the subscriber URLs', async () => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
  const deliveries: string[] = []
  fetchMock
    .get('https://sub.example')
    .intercept({ path: () => true, method: 'POST' })
    .reply((options) => {
      deliveries.push(typeof options.body === 'string' ? options.body : '')
      return { statusCode: 200 }
    })
    .persist()

  const { auctionId, bidderId } = await seedAuction('fanout')
  await subscribe(auctionId, 'https://sub.example/callback')

  const { admission } = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 150,
    type: 'open',
  })
  expect(admission.allowed).toBe(true)
  expect(deliveries).toHaveLength(1)
  const payload = JSON.parse(deliveries[0] ?? '{}') as {
    type: string
    auctionId: string
    data: { amount: number }
  }
  expect(payload.type).toBe('bid:created')
  expect(payload.auctionId).toBe(auctionId)
  expect(payload.data.amount).toBe(150)

  await fetchRoute(auctionId, '/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://sub.example/callback' }),
  })
  await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 200,
    type: 'open',
  })
  expect(deliveries).toHaveLength(1)
})

test('hydration arms the alarm at endsAt and an anti-snipe bid reschedules it', async () => {
  const endsAt = new Date(Date.now() + 60_000).toISOString()
  const { auctionId, bidderId } = await seedAuction('snipe-alarm', { endsAt })

  await fetchRoute(auctionId, '/state')
  expect(await storedAlarm(auctionId)).toBe(Date.parse(endsAt))

  const { admission } = await placeBidRoute(auctionId, {
    userId: bidderId,
    amount: 150,
    type: 'open',
  })
  expect(admission.allowed).toBe(true)
  expect(admission.extended).not.toBeNull()
  const expectedMs = Date.parse(endsAt) + 5 * 60 * 1000
  expect(admission.extended?.endsAt).toBe(new Date(expectedMs).toISOString())
  expect(await storedAlarm(auctionId)).toBe(expectedMs)
  expect((await auctionRow(auctionId))?.endsAt).toBe(new Date(expectedMs).toISOString())
})

test('alarm before endsAt re-arms at the current end and keeps the auction active', async () => {
  const endsAt = new Date(Date.now() + 10 * 60_000).toISOString()
  const { auctionId } = await seedAuction('alarm-early', { endsAt })

  await fetchRoute(auctionId, '/state')
  await fireAlarm(auctionId)

  expect(await storedAlarm(auctionId)).toBe(Date.parse(endsAt))
  expect((await auctionRow(auctionId))?.status).toBe('active')
})

test('scheduled alarm ends an open auction with a winner and notifies both parties', async () => {
  fetchMock.activate()
  fetchMock.disableNetConnect()
  const deliveries: string[] = []
  // A dedicated origin: the fanout test's persist() interceptor on
  // sub.example would otherwise consume these deliveries first.
  fetchMock
    .get('https://alarm-sub.example')
    .intercept({ path: () => true, method: 'POST' })
    .reply((options) => {
      deliveries.push(typeof options.body === 'string' ? options.body : '')
      return { statusCode: 200 }
    })
    .persist()

  const { auctionId, sellerId, bidderId } = await seedAuction('alarm-win', {
    endsAt: '2026-01-01T00:00:00.000Z',
  })
  await insertLeadingBid(auctionId, bidderId, 12_000, '2025-12-30T00:00:00.000Z')
  await subscribe(auctionId, 'https://alarm-sub.example/callback')
  await fetchRoute(auctionId, '/state')

  // Hydration arms an already-overdue alarm, so the runtime may fire it
  // before this call; either path runs the same alarm() body, so only the
  // outcome is asserted.
  await runDurableObjectAlarm(stubFor(auctionId))

  const row = await auctionRow(auctionId)
  expect(row?.status).toBe('appraised')
  expect(row?.endedAt).not.toBeNull()
  const bidRows = await db.select().from(schema.bids).where(eq(schema.bids.auctionId, auctionId))
  expect(row?.winningBid).toBe(bidRows[0]?.id)

  expect(await auditActions(auctionId)).toEqual(
    expect.arrayContaining(['auction_ended', 'auction_outcome_computed']),
  )

  const winnerNotifications = await notificationsFor(bidderId)
  expect(winnerNotifications).toHaveLength(1)
  expect(winnerNotifications[0]?.event).toBe('auction.won')
  expect(winnerNotifications[0]?.channel).toBe('email')
  expect(winnerNotifications[0]?.title).toBe('Te võitsite oksjoni')

  const sellerNotifications = await notificationsFor(sellerId)
  expect(sellerNotifications).toHaveLength(1)
  expect(sellerNotifications[0]?.event).toBe('auction.ended')

  const endedBroadcast = deliveries.map((body) =>
    JSON.parse(body) as {
      type: string
      auctionId: string
      data: { hasWinner?: boolean; type?: string }
    },
  )
  const ended = endedBroadcast.filter((event) => event.type === 'auction:ended')
  expect(ended).toHaveLength(1)
  expect(ended[0]?.auctionId).toBe(auctionId)
  expect(ended[0]?.data.hasWinner).toBe(true)
  expect(ended[0]?.data.type).toBe('open')
})

test('alarm ends an open auction without bids as unsold', async () => {
  const { auctionId, sellerId, bidderId } = await seedAuction('alarm-unsold', {
    endsAt: '2026-01-01T00:00:00.000Z',
  })
  await fetchRoute(auctionId, '/state')

  await fireAlarm(auctionId)

  const row = await auctionRow(auctionId)
  expect(row?.status).toBe('unsold')
  expect(row?.endedAt).not.toBeNull()
  expect(row?.winningBid).toBeNull()
  expect(await auditActions(auctionId)).toEqual(
    expect.arrayContaining(['auction_ended', 'auction_outcome_computed']),
  )
  expect(await notificationsFor(sellerId)).toHaveLength(1)
  expect(await notificationsFor(bidderId)).toHaveLength(0)
})

test('leading bid below the reserve price ends unsold and notifies the bidder', async () => {
  const { auctionId, sellerId, bidderId } = await seedAuction('alarm-reserve', {
    endsAt: '2026-01-01T00:00:00.000Z',
    reservePriceCents: 20_000,
  })
  await insertLeadingBid(auctionId, bidderId, 12_000, '2025-12-30T00:00:00.000Z')
  await fetchRoute(auctionId, '/state')

  await fireAlarm(auctionId)

  const row = await auctionRow(auctionId)
  expect(row?.status).toBe('unsold')
  expect(row?.winningBid).toBeNull()
  expect((await notificationsFor(bidderId)).map((n) => n.event)).toEqual(['auction.ended'])
  expect((await notificationsFor(sellerId)).map((n) => n.event)).toEqual(['auction.ended'])
})

test('sealed auction stops at ended with the opening ceremony flagged', async () => {
  const { auctionId, sellerId, bidderId } = await seedAuction('alarm-sealed', {
    endsAt: '2026-01-01T00:00:00.000Z',
    auctionType: 'sealed',
  })
  await insertLeadingBid(auctionId, bidderId, 12_000, '2025-12-30T00:00:00.000Z', 'sealed')
  await fetchRoute(auctionId, '/state')

  await fireAlarm(auctionId)

  const row = await auctionRow(auctionId)
  expect(row?.status).toBe('ended')
  expect(row?.endedAt).not.toBeNull()
  expect(row?.winningBid).toBeNull()
  expect(await auditActions(auctionId)).toEqual(['auction_ended'])

  const auditRows = await db
    .select()
    .from(schema.auditEntries)
    .where(eq(schema.auditEntries.entityId, auctionId))
  const after = JSON.parse(auditRows[0]?.after ?? '{}') as { sealedOpeningPending?: boolean }
  expect(after.sealedOpeningPending).toBe(true)

  expect(await notificationsFor(bidderId)).toHaveLength(0)
  const sellerNotifications = await notificationsFor(sellerId)
  expect(sellerNotifications).toHaveLength(1)
  const payload = JSON.parse(sellerNotifications[0]?.payload ?? '{}') as {
    sealedOpeningPending?: boolean
  }
  expect(payload.sealedOpeningPending).toBe(true)
})

test('a second alarm fire after the transition is a no-op', async () => {
  const { auctionId, sellerId } = await seedAuction('alarm-idem', {
    endsAt: '2026-01-01T00:00:00.000Z',
    leadingBidCents: 12_000,
  })
  await fetchRoute(auctionId, '/state')

  await fireAlarm(auctionId)
  expect((await auctionRow(auctionId))?.status).toBe('appraised')
  expect(await auditActions(auctionId)).toHaveLength(2)
  expect(await notificationsFor(sellerId)).toHaveLength(2)

  await fireAlarm(auctionId)
  expect((await auctionRow(auctionId))?.status).toBe('appraised')
  expect(await auditActions(auctionId)).toHaveLength(2)
  expect(await notificationsFor(sellerId)).toHaveLength(2)
})
