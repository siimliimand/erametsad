import { eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { env } from 'cloudflare:test'
import { beforeEach, expect, test } from 'vitest'
import * as schema from './schema'

const db = drizzle(env.DB, { schema })

const now = () => new Date().toISOString()
const uuid = () => crypto.randomUUID()

interface Seed {
  seller: { id: string; email: string }
  bidder: { id: string; email: string }
  auction: { id: string }
}

async function seed(prefix: string): Promise<Seed> {
  const seller = { id: uuid(), email: `${prefix}-seller@example.com`, displayName: 'Seller', status: 'active' as const, createdAt: now() }
  const bidder = { id: uuid(), email: `${prefix}-bidder@example.com`, displayName: 'Bidder', status: 'active' as const, createdAt: now() }
  await db.insert(schema.users).values([seller, bidder])
  const auction = {
    id: uuid(),
    sellerId: seller.id,
    title: `${prefix} metsatükk`,
    status: 'active' as const,
    startingPriceCents: 10_000,
    currentPriceCents: 10_000,
    endsAt: now(),
    createdAt: now(),
  }
  await db.insert(schema.auctions).values(auction)
  return { seller, bidder, auction }
}

function bidRow(seed: Seed, amountCents: number) {
  return {
    id: uuid(),
    auctionId: seed.auction.id,
    bidderId: seed.bidder.id,
    amountCents,
    createdAt: now(),
  }
}

async function bidCount(auctionId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)` })
    .from(schema.bids)
    .where(eq(schema.bids.auctionId, auctionId))
  return rows[0]?.n ?? 0
}

beforeEach(async () => {
  await db.delete(schema.bids)
  await db.delete(schema.auctions)
  await db.delete(schema.users)
})

test('CRUD: insert with RETURNING, select, update, delete', async () => {
  const s = await seed('crud')

  const inserted = await db.insert(schema.bids).values(bidRow(s, 10_500)).returning()
  expect(inserted).toHaveLength(1)
  expect(inserted[0]?.amountCents).toBe(10_500)
  expect(inserted[0]?.id).toMatch(/^[0-9a-f-]{36}$/)

  const read = await db.select().from(schema.bids).where(eq(schema.bids.id, inserted[0]!.id))
  expect(read).toHaveLength(1)
  expect(read[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

  const updated = await db
    .update(schema.bids)
    .set({ amountCents: 11_000 })
    .where(eq(schema.bids.id, inserted[0]!.id))
    .returning()
  expect(updated[0]?.amountCents).toBe(11_000)

  const deleted = await db.delete(schema.bids).where(eq(schema.bids.id, inserted[0]!.id)).returning()
  expect(deleted).toHaveLength(1)
  expect(await bidCount(s.auction.id)).toBe(0)
})

function errorText(error: unknown): string {
  const parts: string[] = []
  for (let e = error; e instanceof Error && parts.length < 5; e = e.cause as Error | undefined) {
    parts.push(e.message)
  }
  return parts.join(' | ')
}

test('enum CHECK constraint rejects a value outside the allowed list', async () => {
  const s = await seed('enum')
  const error = await db
    .run(
      sql`INSERT INTO auctions (id, seller_id, title, status, starting_price_cents, current_price_cents, created_at)
          VALUES (${uuid()}, ${s.seller.id}, 'x', 'bogus', 100, 100, ${now()})`,
    )
    .then(
      () => '',
      (e: unknown) => errorText(e),
    )
  expect(error).toMatch(/constraint/i)
  expect(error).toContain('auctions_status_check')
})

test('batch() is atomic: a failing statement rolls back the whole batch', async () => {
  const s = await seed('batch-rollback')
  const good = bidRow(s, 12_000)
  const bad = { ...bidRow(s, -5), auctionId: s.auction.id }

  await expect(
    db.batch([db.insert(schema.bids).values(good), db.insert(schema.bids).values(bad)]),
  ).rejects.toThrow(/constraint/i)

  expect(await bidCount(s.auction.id)).toBe(0)
})

test('batch() enforces foreign keys across statements', async () => {
  const s = await seed('batch-fk')
  const good = bidRow(s, 12_500)
  const orphan = { ...bidRow(s, 13_000), auctionId: uuid() }

  await expect(
    db.batch([db.insert(schema.bids).values(good), db.insert(schema.bids).values(orphan)]),
  ).rejects.toThrow(/foreign key/i)

  expect(await bidCount(s.auction.id)).toBe(0)
})

test('batch() runs statements in order and later statements see earlier writes', async () => {
  const s = await seed('batch-order')
  const row = bidRow(s, 12_000)

  const results = await db.batch([
    db.insert(schema.bids).values(row),
    db
      .select({ n: sql<number>`count(*)` })
      .from(schema.bids)
      .where(eq(schema.bids.auctionId, s.auction.id)),
    db.select().from(schema.bids).where(eq(schema.bids.id, row.id)),
  ])

  const countRows = results[1] as { n: number }[]
  const selectRows = results[2] as { id: string; amountCents: number }[]
  expect(countRows[0]?.n).toBe(1)
  expect(selectRows[0]?.id).toBe(row.id)
})

test('concurrent single writes are serialized: no lost inserts', async () => {
  const s = await seed('concurrent-inserts')
  await Promise.all(
    Array.from({ length: 30 }, () => db.insert(schema.bids).values(bidRow(s, 11_000))),
  )
  expect(await bidCount(s.auction.id)).toBe(30)
})

test('concurrent read-modify-write batches serialize: no lost updates', async () => {
  const s = await seed('concurrent-updates')
  const bump = (step: number) =>
    db
      .update(schema.auctions)
      .set({
        currentPriceCents: sql`${schema.auctions.currentPriceCents} + ${step}`,
        status: 'active',
      })
      .where(eq(schema.auctions.id, s.auction.id))

  await Promise.all(Array.from({ length: 10 }, (_, i) => db.batch([bump(100), bump(1)]).then(() => i)))

  const rows = await db.select().from(schema.auctions).where(eq(schema.auctions.id, s.auction.id))
  expect(rows[0]?.currentPriceCents).toBe(10_000 + 10 * 101)
})

test('SELECT ... FOR UPDATE is rejected by SQLite/D1', async () => {
  const s = await seed('for-update')
  await expect(
    db.run(sql`SELECT id FROM auctions WHERE id = ${s.auction.id} FOR UPDATE`),
  ).rejects.toThrow()
})

test('money stays INTEGER cents end to end (typeof integer from SQLite)', async () => {
  const s = await seed('typeof-money')
  await db.insert(schema.bids).values(bidRow(s, 12_345))
  const raw = await db.run(
    sql`SELECT amount_cents, typeof(amount_cents) AS t FROM bids WHERE auction_id = ${s.auction.id}`,
  )
  const row = raw.results[0] as unknown as { amount_cents: number; t: string } | undefined
  expect(row?.t).toBe('integer')
  expect(row?.amount_cents).toBe(12_345)
})
