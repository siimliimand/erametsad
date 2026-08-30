import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Force the legacy in-process admission fallback: no Cloudflare context in
// the node pool, so admitViaAuctionDO returns null.
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn(() => Promise.reject(new Error('no cloudflare context in tests'))),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as createBidRoute } from '@/app/api/v1/bids/create/route'
import { signAccessToken } from '@/lib/auth/jwt'
import { decryptSealedBids } from '@/lib/bidding/sealed-bid'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'route-test-jwt-secret'
process.env.SEALED_BID_ENCRYPTION_KEY =
  process.env.SEALED_BID_ENCRYPTION_KEY ?? 'test-encryption-key-32chars!!'

const BASE = 'http://localhost:3000/api/v1/bids/create'

const SUBMITTED_SNAPSHOT = JSON.stringify({
  name: 'Mari Maasikas',
  aadress: 'Metsa tee 1, Tartu',
  email: 'mari@example.com',
  telefon: '+372 500 100',
  isikukood: '30000000003',
})

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

function authedPost(body: Record<string, unknown>, token: string): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie: `access_token=${token}`,
    },
    body: JSON.stringify(body),
  })
}

async function jsonOf(response: Response): Promise<Record<string, unknown>> {
  return (await response.json()) as Record<string, unknown>
}

async function seedSealedAuction(options: { revisionCap: number }): Promise<{
  auctionId: string
  bidderId: string
  token: string
}> {
  const bidderId = 'route-bidder'
  const sellerId = 'route-seller'
  const auctionId = 'route-auction'
  const timestamp = new Date().toISOString()
  await repos.create({ collection: 'users', data: { id: bidderId, email: `${bidderId}@example.com` } })
  await repos.create({ collection: 'users', data: { id: sellerId, email: `${sellerId}@example.com` } })
  await repos.create({
    collection: 'auctions',
    data: {
      id: auctionId,
      title: 'Lukustatud oksjon',
      slug: `slug-${auctionId}`,
      objectType: 'raieoigus',
      status: 'active',
      type: 'sealed',
      minBidCents: 10_000,
      endsAt: '2099-01-01T00:00:00Z',
    },
  })
  await repos.create({
    collection: 'auction-rights',
    data: {
      user: bidderId,
      objectType: 'raieoigus',
      grantedBy: sellerId,
      grantedAt: timestamp,
    },
  })
  await repos.create({
    collection: 'settings',
    data: {
      sealedRevisionCap: options.revisionCap,
      featureFlags: { requireFrameworkContract: false },
    },
  })
  return { auctionId, bidderId, token: signAccessToken({ userId: bidderId, role: 'private' }) }
}

describe('POST /api/v1/bids/create (sealed admission)', () => {
  it('stores sealed bids encrypted and returns the coded cap rejection over HTTP', async () => {
    const { auctionId, token } = await seedSealedAuction({ revisionCap: 1 })

    // 1 + sealedRevisionCap accepted submissions...
    for (let i = 0; i < 2; i++) {
      const response = await createBidRoute(
        authedPost(
          {
            auctionId,
            amount: 150,
            type: 'sealed',
            identitySnapshot: SUBMITTED_SNAPSHOT,
          },
          token,
        ),
      )
      expect(response.status).toBe(201)
      const body = await jsonOf(response)
      const returnedSnapshot = body.identitySnapshot as string | undefined
      // The API response carries ciphertext, never the submitted snapshot.
      expect(returnedSnapshot).toBeTruthy()
      expect(returnedSnapshot).not.toContain('Mari Maasikas')
      expect(returnedSnapshot).not.toContain('30000000003')
    }

    // ...the next one trips the cap, and the code reaches the HTTP layer.
    const rejected = await createBidRoute(
      authedPost(
        {
          auctionId,
          amount: 150,
          type: 'sealed',
          identitySnapshot: SUBMITTED_SNAPSHOT,
        },
        token,
      ),
    )
    expect(rejected.status).toBe(400)
    const errorBody = await jsonOf(rejected)
    expect(errorBody.code).toBe('revision_cap_exceeded')
    expect(errorBody.error).toBe(
      'Lukspakkumuste limiit on ületatud: lubatud on üks esialgne pakkumine ja kuni 1 täienduspakkumist',
    )

    // Every stored row: amount_cents 0, unreadable identity_snapshot.
    const rows = testDb.raw.prepare('select * from bids order by created_at').all() as {
      amount_cents: number
      identity_snapshot: string | null
    }[]
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.amount_cents).toBe(0)
      expect(row.identity_snapshot).not.toBeNull()
      expect(row.identity_snapshot).not.toContain('Mari Maasikas')
    }

    // The ceremony path still decrypts the stored envelopes.
    const decrypted = decryptSealedBids(
      rows.map((row, index) => ({
        id: `bid-${String(index)}`,
        auction: auctionId,
        user: 'route-bidder',
        status: 'leading',
        createdAt: '2026-02-01T10:00:00Z',
        identitySnapshot: row.identity_snapshot ?? undefined,
      })),
    )
    for (const bid of decrypted) {
      expect(bid.valid).toBe(true)
      expect(bid.amount).toBe(150)
      expect(bid.identitySnapshot).toBe(SUBMITTED_SNAPSHOT)
    }
  })

  it('keeps open bids unchanged: real amount stored, no identity_snapshot', async () => {
    const { auctionId, token } = await seedSealedAuction({ revisionCap: 1 })

    const response = await createBidRoute(
      authedPost({ auctionId, amount: 150, type: 'open' }, token),
    )
    expect(response.status).toBe(201)
    const body = await jsonOf(response)
    expect(body.amount).toBe(150)

    const rows = testDb.raw.prepare('select * from bids').all() as {
      amount_cents: number
      identity_snapshot: string | null
    }[]
    expect(rows).toHaveLength(1)
    expect(rows[0]?.amount_cents).toBe(15_000)
    expect(rows[0]?.identity_snapshot).toBeNull()
  })
})
