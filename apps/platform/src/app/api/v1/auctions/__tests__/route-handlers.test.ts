import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as unsubscribeRoute } from '@/app/api/v1/auction-subscriptions/unsubscribe/route'
import { GET as auctionBidsRoute } from '@/app/api/v1/auctions/[id]/bids/route'
import { GET as listAuctionsRoute } from '@/app/api/v1/auctions/route'
import { GET as withUserBidsRoute } from '@/app/api/v1/auctions/with-user-bids/route'
import { POST as rightsRequestsRoute } from '@/app/api/v1/my/rights-requests/route'
import { signAccessToken } from '@/lib/auth/jwt'
import { createSession } from '@/lib/auth/session'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'route-test-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  vi.clearAllMocks()
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos))
  setD1ForTests(testDb.d1)
})

afterEach(() => {
  setD1ForTests(null)
  testDb.close()
})

function authedGet(url: string, token?: string): NextRequest {
  return new NextRequest(
    url,
    token ? { headers: { cookie: `access_token=${token}` } } : {},
  )
}

function tokenFor(userId: string, role = 'private'): string {
  return signAccessToken({ userId, role })
}

async function seedUser(id: string): Promise<void> {
  await repos.create({ collection: 'users', data: { id, email: `${id}@example.com` } })
}

async function seedAuction(id: string, overrides: Record<string, unknown> = {}): Promise<void> {
  await repos.create({
    collection: 'auctions',
    data: {
      id,
      title: `Auction ${id}`,
      slug: `slug-${id}`,
      objectType: 'raieoigus',
      minBidCents: 10_000,
      ...overrides,
    },
  })
}

async function seedBid(
  id: string,
  data: {
    auctionId: string
    userId: string
    amountCents: number
    status?: string
    source?: string
    type?: string
    /** Pins created_at: hook stamps are wall-clock, so label order needs this. */
    createdAt?: string
  },
): Promise<void> {
  await repos.create({
    collection: 'bids',
    data: {
      id,
      auction: data.auctionId,
      user: data.userId,
      amountCents: data.amountCents,
      type: data.type ?? 'open',
      source: data.source ?? 'manual',
      status: data.status ?? 'leading',
    },
  })
  if (data.createdAt !== undefined) {
    testDb.raw
      .prepare('UPDATE bids SET created_at = ?, updated_at = ? WHERE id = ?')
      .run(data.createdAt, data.createdAt, id)
  }
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

describe('GET /api/v1/auctions', () => {
  it('applies county+species filters with page metadata', async () => {
    await repos.create({
      collection: 'counties',
      data: { id: 'c1', name: 'Harjumaa', code: 'HH' },
    })
    await seedAuction('a-1', { status: 'active', countyId: 'c1', species: ['mänd'] })
    await seedAuction('a-2', { status: 'active', countyId: 'c1', species: ['kuusk'] })

    const response = await listAuctionsRoute(
      new NextRequest(`${BASE}/auctions?county=HH&species=ma&limit=10`),
    )
    expect(response.status).toBe(200)
    const body = await jsonOf(response)
    expect(body.total).toBe(1)
    expect(body.limit).toBe(10)
    expect((body.auctions as { id: string }[]).map((a) => a.id)).toEqual(['a-1'])
  })

  it('accepts the camelCase sort keys the portal UI serializes', async () => {
    await seedUser('seller-1')
    await seedAuction('a-b', { status: 'active', minBidCents: 20_000 })
    await seedAuction('a-a', { status: 'active', minBidCents: 5_000 })

    const response = await listAuctionsRoute(
      new NextRequest(`${BASE}/auctions?sort=startPrice&order=asc`),
    )
    expect(response.status).toBe(200)
    const body = await jsonOf(response)
    expect((body.auctions as { id: string }[]).map((a) => a.id)).toEqual(['a-a', 'a-b'])
  })

  it('rejects an unknown sort field with 400', async () => {
    const response = await listAuctionsRoute(new NextRequest(`${BASE}/auctions?sort=nope`))
    expect(response.status).toBe(400)
    expect(await jsonOf(response)).toHaveProperty('error')
  })

  it('returns unpaged coordinates in map mode', async () => {
    await seedUser('seller-1')
    await seedAuction('a-pin', { status: 'active', coordinates: { lat: 59.0, lng: 24.5 } })

    const response = await listAuctionsRoute(new NextRequest(`${BASE}/auctions?map=1`))
    expect(response.status).toBe(200)
    const body = await jsonOf(response)
    const auctions = body.auctions as { id: string; coordinates: unknown }[]
    expect(auctions).toHaveLength(1)
    expect(auctions[0]?.coordinates).toEqual({ lat: 59.0, lng: 24.5 })
    expect(JSON.stringify(body)).not.toContain('"total"')
  })

  it('never exposes reservePrice', async () => {
    await seedUser('seller-1')
    await seedAuction('a-res', { status: 'active', reservePriceCents: 777_777 })

    const response = await listAuctionsRoute(new NextRequest(`${BASE}/auctions`))
    expect(JSON.stringify(await jsonOf(response))).not.toContain('reservePrice')
  })
})

describe('GET /api/v1/auctions/[id]/bids', () => {
  function bidsRequest(id: string, token?: string): Parameters<typeof auctionBidsRoute>[0] {
    return authedGet(`${BASE}/auctions/${id}/bids`, token)
  }

  it('serves guests only the count and latest time', async () => {
    await seedUser('u1')
    await seedUser('u2')
    await seedAuction('a-1', { status: 'active' })
    await seedBid('b-1', { auctionId: 'a-1', userId: 'u1', amountCents: 15_000 })
    await seedBid('b-2', { auctionId: 'a-1', userId: 'u2', amountCents: 20_000 })

    const response = await auctionBidsRoute(authedGet(`${BASE}/auctions/a-1/bids`), {
      params: Promise.resolve({ id: 'a-1' }),
    })
    expect(response.status).toBe(200)
    const body = await jsonOf(response)
    expect(body.kind).toBe('guest')
    expect(body.bidCount).toBe(2)
    expect(body.latestBidAt).toEqual(expect.any(String))
    expect(JSON.stringify(body)).not.toContain('"bids"')
  })

  it('serves authed callers shaped rows including their own pending bid', async () => {
    await seedUser('u1')
    await seedUser('u2')
    await seedAuction('a-1', { status: 'active' })
    await seedBid('b-1', {
      auctionId: 'a-1',
      userId: 'u1',
      amountCents: 15_000,
      status: 'outbid',
      createdAt: '2026-01-01T00:00:01.000Z',
    })
    await seedBid('b-2', {
      auctionId: 'a-1',
      userId: 'u2',
      amountCents: 20_000,
      createdAt: '2026-01-01T00:00:02.000Z',
    })
    await seedBid('b-3', {
      auctionId: 'a-1',
      userId: 'u1',
      amountCents: 40_000,
      status: 'pending_approval',
      createdAt: '2026-01-01T00:00:03.000Z',
    })

    const response = await auctionBidsRoute(bidsRequest('a-1', tokenFor('u1')), {
      params: Promise.resolve({ id: 'a-1' }),
    })
    expect(response.status).toBe(200)
    const body = await jsonOf(response)
    expect(body.kind).toBe('authed')
    const bids = body.bids as { id: string; label: string; isOwn: boolean; amount: number }[]
    expect(bids.map((b) => b.id)).toEqual(['b-3', 'b-2', 'b-1'])
    expect(bids.map((b) => b.label)).toEqual(['Pakkuja #3', 'Pakkuja #2', 'Pakkuja #1'])
    expect(bids.find((b) => b.id === 'b-3')?.isOwn).toBe(true)
    // Another user's pending approval never appears as a row.
    expect(bids.every((b) => b.id !== 'pending-other')).toBe(true)
  })

  it('downgrades an invalid token to the guest view', async () => {
    await seedUser('u1')
    await seedAuction('a-1', { status: 'active' })
    await seedBid('b-1', { auctionId: 'a-1', userId: 'u1', amountCents: 15_000 })

    const response = await auctionBidsRoute(bidsRequest('a-1', 'not-a-jwt'), {
      params: Promise.resolve({ id: 'a-1' }),
    })
    expect(response.status).toBe(200)
    expect((await jsonOf(response)).kind).toBe('guest')
  })

  it('returns 404 for an unknown auction', async () => {
    const response = await auctionBidsRoute(bidsRequest('missing'), {
      params: Promise.resolve({ id: 'missing' }),
    })
    expect(response.status).toBe(404)
  })
})

describe('GET /api/v1/auctions/with-user-bids', () => {
  it('requires a session', async () => {
    const response = await withUserBidsRoute(authedGet(`${BASE}/auctions/with-user-bids`))
    expect(response.status).toBe(401)
  })

  it('returns only the caller bids grouped active/ended with outcomes', async () => {
    await seedUser('u-me')
    await seedUser('u-other')
    await seedAuction('a-active', { status: 'active', endsAt: '2026-12-01T00:00:00.000Z' })
    await seedAuction('a-won', {
      status: 'ended',
      finalPriceCents: 90_000,
      winningBid: 'b-me-1',
    })
    await seedAuction('a-lost', { status: 'ended', finalPriceCents: 50_000, winningBid: 'b-other-1' })
    await seedAuction('a-unsold', { status: 'unsold', finalPriceCents: null })
    await seedAuction('a-other-only', { status: 'active' })

    await seedBid('b-me-1', { auctionId: 'a-won', userId: 'u-me', amountCents: 90_000 })
    await seedBid('b-me-2', { auctionId: 'a-active', userId: 'u-me', amountCents: 12_000 })
    await seedBid('b-me-3', { auctionId: 'a-lost', userId: 'u-me', amountCents: 40_000, status: 'lost' })
    await seedBid('b-me-4', { auctionId: 'a-unsold', userId: 'u-me', amountCents: 30_000, status: 'lost' })
    await seedBid('b-other-1', { auctionId: 'a-lost', userId: 'u-other', amountCents: 50_000 })
    await seedBid('b-other-2', { auctionId: 'a-other-only', userId: 'u-other', amountCents: 60_000 })

    const response = await withUserBidsRoute(
      authedGet(`${BASE}/auctions/with-user-bids`, tokenFor('u-me')),
    )
    expect(response.status).toBe(200)
    const body = await jsonOf(response)
    const active = body.active as { auction: { id: string } }[]
    const ended = body.ended as {
      auction: { id: string }
      outcome?: string
      finalPriceEur?: number | null
    }[]
    // Only auctions where the caller has a bid.
    expect(active.map((r) => r.auction.id)).toEqual(['a-active'])
    expect(ended.map((r) => r.auction.id).sort()).toEqual(['a-lost', 'a-unsold', 'a-won'])

    const won = ended.find((r) => r.auction.id === 'a-won')
    expect(won?.outcome).toBe('won')
    expect(won?.finalPriceEur).toBe(900)
    expect(ended.find((r) => r.auction.id === 'a-lost')?.outcome).toBe('lost')
    expect(ended.find((r) => r.auction.id === 'a-unsold')?.outcome).toBe('unsold')
  })

  it('hides leading amounts for sealed auctions and never leaks bidder identity', async () => {
    await seedUser('u-me')
    await seedUser('u-other')
    await seedAuction('a-sealed-ended', { status: 'ended', type: 'sealed', finalPriceCents: 80_000 })
    await seedBid('b-me-s1', {
      auctionId: 'a-sealed-ended',
      userId: 'u-me',
      amountCents: 80_000,
      type: 'sealed',
      status: 'won',
    })
    await seedBid('b-other-s1', {
      auctionId: 'a-sealed-ended',
      userId: 'u-other',
      amountCents: 70_000,
      type: 'sealed',
      status: 'lost',
    })

    const response = await withUserBidsRoute(
      authedGet(`${BASE}/auctions/with-user-bids`, tokenFor('u-me')),
    )
    const body = await jsonOf(response)
    const ended = body.ended as { myBid: { amountEur: number } | null; leadingAmountEur: number | null }[]
    expect(ended[0]?.myBid?.amountEur).toBe(800)
    expect(ended[0]?.leadingAmountEur).toBeNull()
    const json = JSON.stringify(body)
    expect(json).not.toContain('u-other')
    expect(json).not.toContain('"userId"')
    expect(json).not.toContain('amountCents')
  })
})

describe('POST /api/v1/auction-subscriptions/unsubscribe', () => {
  async function seedSubscription(id: string, token: string): Promise<void> {
    await repos.create({
      collection: 'auction-subscriptions',
      data: {
        id,
        channel: 'email',
        frequency: 'immediate',
        unsubscribeToken: token,
      },
    })
  }

  const countToken = (token: string): number =>
    (
      testDb.raw
        .prepare("SELECT COUNT(*) AS n FROM auction_subscriptions WHERE unsubscribe_token = ?")
        .get(token) as { n: number }
    ).n

  it('requires the token parameter', async () => {
    const response = await unsubscribeRoute(new NextRequest(`${BASE}/auction-subscriptions/unsubscribe`, { method: 'POST' }))
    expect(response.status).toBe(400)
  })

  it('deletes the subscription with a valid token and no session', async () => {
    await seedSubscription('sub-1', 'tok-1')
    expect(countToken('tok-1')).toBe(1)

    const response = await unsubscribeRoute(
      new NextRequest(`${BASE}/auction-subscriptions/unsubscribe?token=tok-1`, { method: 'POST' }),
    )
    expect(response.status).toBe(200)
    expect(await jsonOf(response)).toMatchObject({ success: true })
    expect(countToken('tok-1')).toBe(0)
  })

  it('answers 404 for an unknown or already used token', async () => {
    await seedSubscription('sub-1', 'tok-1')
    const unknown = await unsubscribeRoute(
      new NextRequest(`${BASE}/auction-subscriptions/unsubscribe?token=tok-x`, { method: 'POST' }),
    )
    expect(unknown.status).toBe(404)

    // The token was consumed by the successful unsubscribe above.
    await unsubscribeRoute(
      new NextRequest(`${BASE}/auction-subscriptions/unsubscribe?token=tok-1`, { method: 'POST' }),
    )
    const reused = await unsubscribeRoute(
      new NextRequest(`${BASE}/auction-subscriptions/unsubscribe?token=tok-1`, { method: 'POST' }),
    )
    expect(reused.status).toBe(404)
  })
})

describe('POST /api/v1/my/rights-requests', () => {
  function postRequest(userId: string, body: unknown): NextRequest {
    return new NextRequest(`${BASE}/my/rights-requests`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'content-type': 'application/json',
        cookie: `access_token=${tokenFor(userId)}`,
      },
    })
  }

  async function seedSession(userId: string): Promise<void> {
    await seedUser(userId)
    await createSession(userId, 'private')
  }

  it('requires a valid session', async () => {
    const response = await rightsRequestsRoute(
      new NextRequest(`${BASE}/my/rights-requests`, { method: 'POST' }),
    )
    expect(response.status).toBe(401)
  })

  it('rejects an invalid objectType', async () => {
    await seedSession('u1')
    const response = await rightsRequestsRoute(postRequest('u1', { objectType: 'gold' }))
    expect(response.status).toBe(400)
  })

  it('creates a pending request for the caller', async () => {
    await seedSession('u1')
    const response = await rightsRequestsRoute(postRequest('u1', { objectType: 'raieoigus' }))
    expect(response.status).toBe(201)
    const body = await jsonOf(response)
    expect(body).toMatchObject({
      user: 'u1',
      objectType: 'raieoigus',
      status: 'pending',
    })
    const rows = testDb.raw.prepare('SELECT COUNT(*) AS n FROM rights_requests').get() as { n: number }
    expect(rows.n).toBe(1)
  })

  it('answers 409 on a pending duplicate and creates no second row', async () => {
    await seedSession('u1')
    await repos.create({
      collection: 'rights-request',
      data: { user: 'u1', objectType: 'raieoigus', status: 'pending' },
    })

    const response = await rightsRequestsRoute(postRequest('u1', { objectType: 'raieoigus' }))
    expect(response.status).toBe(409)
    const rows = testDb.raw.prepare('SELECT COUNT(*) AS n FROM rights_requests').get() as { n: number }
    expect(rows.n).toBe(1)
  })
})
