import { env } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { expect, test } from 'vitest'

import * as schema from '../../lib/data/schema'

const db = drizzle(env.DB, { schema })

interface AdmissionResponse {
  allowed: boolean
  bid?: { id: string; status: string; amount: number }
  error?: string
  status?: number
  code?: string
}

async function seedSealedAuction(prefix: string): Promise<{
  auctionId: string
  sellerId: string
  bidderId: string
}> {
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
    type: 'sealed',
    minBidCents: 10_000,
    endsAt: '2099-12-31T12:00:00.000Z',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(schema.auctionRights).values({
    id: crypto.randomUUID(),
    userId: bidderId,
    objectType: 'raieoigus',
    grantedBy: sellerId,
    grantedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return { auctionId, sellerId, bidderId }
}

async function admit(
  auctionId: string,
  body: Record<string, unknown>,
): Promise<{ response: Response; admission: AdmissionResponse }> {
  const stub = env.AUCTION.get(env.AUCTION.idFromName(auctionId))
  const response = await stub.fetch(`https://auction-do/${auctionId}/bid`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { response, admission: (await response.json()) as AdmissionResponse }
}

async function bidRows(auctionId: string) {
  return db.select().from(schema.bids).where(eq(schema.bids.auctionId, auctionId))
}

test('sealed admission past 1 + revisionCap returns revision_cap_exceeded', async () => {
  const { auctionId, bidderId } = await seedSealedAuction('sealed-cap')
  const timestamp = new Date().toISOString()

  // No settings row: resolveSealedRevisionCap falls back to the default 3,
  // so four prior sealed bids fill the 1 + 3 budget.
  await db.insert(schema.bids).values(
    Array.from({ length: 4 }, () => ({
      id: crypto.randomUUID(),
      auctionId,
      userId: bidderId,
      amountCents: 0,
      type: 'sealed' as const,
      source: 'manual' as const,
      status: 'leading' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  )

  const { response, admission } = await admit(auctionId, {
    userId: bidderId,
    amount: 250,
    type: 'sealed',
  })
  expect(response.status).toBe(200)
  expect(admission.allowed).toBe(false)
  expect(admission.status).toBe(400)
  expect(admission.code).toBe('revision_cap_exceeded')
  expect(admission.error).toBe(
    'Lukspakkumuste limiit on ületatud: lubatud on üks esialgne pakkumine ja kuni 3 täienduspakkumist',
  )

  // The rejected admission wrote nothing.
  expect(await bidRows(auctionId)).toHaveLength(4)
})

test('open admission keeps the readable amount and writes no identity_snapshot', async () => {
  const { auctionId, bidderId } = await seedSealedAuction('open-regression')

  const { response, admission } = await admit(auctionId, {
    userId: bidderId,
    amount: 150,
    type: 'open',
  })
  expect(response.status).toBe(200)
  expect(admission.allowed).toBe(true)

  const rows = await bidRows(auctionId)
  expect(rows).toHaveLength(1)
  expect(rows[0]?.amountCents).toBe(15_000)
  expect(rows[0]?.identitySnapshot).toBeNull()
})
