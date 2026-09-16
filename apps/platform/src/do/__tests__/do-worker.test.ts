import { env, runInDurableObject } from 'cloudflare:test'
import { eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { expect, test } from 'vitest'

import * as schema from '../../lib/data/schema'
import {
  scheduled,
  sweepDueAuctions,
  type SweepEnv,
  type SweepExecutionContext,
} from '../../lib/workers/auction-ending'
import { AuctionDO } from '../auction'
import shimSource from '../index.ts?raw'
import { RateLimiterDO } from '../rate-limiter'

// The shim's whole job is wiring: it re-exports the built OpenNext fetch
// handler (loadable only after `build:cf`, so asserted as source wiring
// below) alongside the DO classes, the queue consumer, and the cron sweep.
test('shim wires fetch, both DO classes, queue consumer, and cron sweep', () => {
  expect(shimSource).toContain("import openNextWorker from '../../.open-next/worker.js'")
  // Cloudflare registers cron handlers from the default ExportedHandler
  // object: with scheduled only as a bare named export, the version metadata
  // listed `fetch` alone and every tick threw "Handler does not export a
  // scheduled() function" (2026-09-02 incident). The default export must
  // carry scheduled.
  expect(shimSource).toContain('export default Object.assign(openNextWorker, { scheduled })')
  expect(shimSource).toContain("export { AuctionDO } from './auction'")
  expect(shimSource).toContain("export { RateLimiterDO } from './rate-limiter'")
  // The cron handler must be DEFINED in the shim, not re-exported: wrangler's
  // static detection cannot see handlers through the re-export chain, so a
  // re-export ships code but registers no cron handler (2026-08-30 incident:
  // every tick threw "Handler does not export a scheduled() function").
  expect(shimSource).toContain('export function scheduled(')
  expect(shimSource).not.toContain("export { scheduled } from")
  // The queue consumer is its own Worker (src/workers/wrangler.jsonc): wrangler
  // cannot detect the queue export through this shim's re-export chain.
  expect(shimSource).not.toContain("export { queue }")
})

test('DO classes are exported for the wrangler bindings', () => {
  expect(AuctionDO).toBeTypeOf('function')
  expect(AuctionDO.name).toBe('AuctionDO')
  expect(RateLimiterDO).toBeTypeOf('function')
  expect(RateLimiterDO.name).toBe('RateLimiterDO')
})

test('cron sweep handler is a function; consumer ships its own worker', () => {
  expect(scheduled).toBeTypeOf('function')
  expect(sweepDueAuctions).toBeTypeOf('function')
})

// The sweep tests run on the real bindings: a wake only counts when the live
// AuctionDO answers /due, so D1 row state doubles as wake evidence. Bindings
// are typed here with the ambient workers declarations while SweepEnv uses
// the minimal local ones, hence the one structural cast at the boundary.
const sweepDb = drizzle(env.DB, { schema })
const sweepEnv = env as unknown as SweepEnv
const sweepCtx: SweepExecutionContext = { waitUntil: () => {} }

async function seedSweepAuction(
  prefix: string,
  options: { status: 'active' | 'scheduled'; startsAt?: string; endsAt: string },
): Promise<string> {
  const sellerId = crypto.randomUUID()
  const auctionId = crypto.randomUUID()
  const timestamp = new Date().toISOString()
  await sweepDb.insert(schema.users).values({
    id: sellerId,
    email: `${prefix}-seller@example.com`,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await sweepDb.insert(schema.auctions).values({
    id: auctionId,
    sellerId,
    title: `${prefix} metsatükk`,
    slug: `${prefix}-${crypto.randomUUID()}`,
    status: options.status,
    objectType: 'raieoigus',
    minBidCents: 10_000,
    ...(options.startsAt !== undefined ? { startsAt: options.startsAt } : {}),
    endsAt: options.endsAt,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return auctionId
}

async function sweepAuctionRow(auctionId: string) {
  const rows = await sweepDb
    .select()
    .from(schema.auctions)
    .where(eq(schema.auctions.id, auctionId))
  return rows[0]
}

// The ambient DurableObjectState the pool-workers types resolve to predates
// the alarm API, so read it through a structural cast (same as
// auction.test.ts).
async function sweepStoredAlarm(auctionId: string): Promise<number | null> {
  const stub = env.AUCTION.get(env.AUCTION.idFromName(auctionId))
  return runInDurableObject(stub, (_instance, state) =>
    (state as unknown as { storage: { getAlarm(): Promise<number | null> } }).storage.getAlarm(),
  )
}

test('cron sweep wakes a due scheduled auction and the DO promotes it to active', async () => {
  const startsAt = new Date(Date.now() - 60_000).toISOString()
  const auctionId = await seedSweepAuction('sweep-due-start', {
    status: 'scheduled',
    startsAt,
    endsAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  })

  const result = await sweepDueAuctions(sweepEnv, sweepCtx)

  expect(result.failed).toBe(0)
  expect(result.woken).toBeGreaterThanOrEqual(1)
  // The sweep never writes: only a /due wake could have promoted the row.
  const row = await sweepAuctionRow(auctionId)
  expect(row?.status).toBe('active')
  expect(row?.activatedAt).not.toBeNull()
})

test('cron sweep leaves a scheduled auction whose start is in the future alone', async () => {
  const auctionId = await seedSweepAuction('sweep-future-start', {
    status: 'scheduled',
    startsAt: new Date(Date.now() + 10 * 60_000).toISOString(),
    endsAt: new Date(Date.now() + 30 * 60_000).toISOString(),
  })

  await sweepDueAuctions(sweepEnv, sweepCtx)

  // A wake would hydrate the DO and arm an alarm at startsAt, so an absent
  // alarm proves the query never selected this row.
  expect(await sweepStoredAlarm(auctionId)).toBeNull()
  const row = await sweepAuctionRow(auctionId)
  expect(row?.status).toBe('scheduled')
  expect(row?.activatedAt).toBeNull()
})

test('cron sweep still selects active rows by ends_at and skips not-yet-due ones', async () => {
  const overdueId = await seedSweepAuction('sweep-due-end', {
    status: 'active',
    endsAt: '2026-01-01T00:00:00.000Z',
  })
  const futureEndsAt = new Date(Date.now() + 30 * 60_000).toISOString()
  const futureId = await seedSweepAuction('sweep-future-end', {
    status: 'active',
    endsAt: futureEndsAt,
  })

  const result = await sweepDueAuctions(sweepEnv, sweepCtx)

  expect(result.failed).toBe(0)
  expect(result.woken).toBeGreaterThanOrEqual(1)
  const overdue = await sweepAuctionRow(overdueId)
  expect(overdue?.status).toBe('unsold')
  expect(overdue?.endedAt).not.toBeNull()
  expect(await sweepStoredAlarm(futureId)).toBeNull()
  const future = await sweepAuctionRow(futureId)
  expect(future?.status).toBe('active')
  expect(future?.endsAt).toBe(futureEndsAt)
})
