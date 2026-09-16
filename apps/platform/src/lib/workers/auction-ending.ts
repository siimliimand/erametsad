import type { DurableObjectNamespace } from 'cloudflare:workers'

import type { DbDatabase } from '../db'

/**
 * Cron safety net for auction deadlines (tasks 6.2 and 1.2): ends of active
 * auctions and starts of scheduled ones. AuctionDO alarms are the primary
 * mechanism for both; this sweep only wakes the DO for auctions that are due
 * but whose alarm was lost (object evicted before hydration or a missed
 * re-arm). The sweep never writes auction state: every transition runs
 * inside the DO through the same serialized path as alarm().
 */
export interface SweepEnv {
  DB: DbDatabase
  AUCTION: DurableObjectNamespace
}

export interface SweepExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export interface SweepResult {
  /** Rows the D1 queries returned as due. */
  due: number
  /** Wakes the DO acknowledged. */
  woken: number
  /** Wakes that returned a non-ok response or threw. */
  failed: number
}

const SWEEP_LIMIT = 50

export async function sweepDueAuctions(
  env: SweepEnv,
  _ctx: SweepExecutionContext,
): Promise<SweepResult> {
  const now = new Date().toISOString()
  // Disjoint statuses: a row due to start can never also be due to end, so
  // the two result sets need no dedup before waking.
  const dueEnds = await env.DB.prepare(
    `select id from auctions where status = ? and ends_at <= ? limit ${String(SWEEP_LIMIT)}`,
  )
    .bind('active', now)
    .all<{ id: unknown }>()
  const dueStarts = await env.DB.prepare(
    `select id from auctions where status = ? and starts_at <= ? limit ${String(SWEEP_LIMIT)}`,
  )
    .bind('scheduled', now)
    .all<{ id: unknown }>()

  let woken = 0
  let failed = 0
  for (const row of [...dueEnds.results, ...dueStarts.results]) {
    const auctionId = row.id
    if (typeof auctionId !== 'string' || auctionId.length === 0) continue
    try {
      const stub = env.AUCTION.get(env.AUCTION.idFromName(auctionId))
      const response = await stub.fetch(`https://auction-do/${auctionId}/due`, {
        method: 'POST',
      })
      if (response.ok) {
        woken++
      } else {
        failed++
        console.error(`[auction-sweep] wake for ${auctionId} returned ${String(response.status)}`)
      }
    } catch (error) {
      failed++
      console.error(`[auction-sweep] wake for ${auctionId} failed`, error)
    }
  }
  return { due: dueEnds.results.length + dueStarts.results.length, woken, failed }
}

export interface CronController {
  cron: string
  scheduledTime: number
  noRetry(): void
}

/**
 * Cron trigger entry (task 6.2): the every-minute sweep that wakes auctions
 * due to end or start whose DO alarm was lost to eviction. The DO owns the
 * transitions; this handler only wakes objects. Exported from here so tests
 * can reach it without loading the built OpenNext worker (the wrangler shim
 * re-exports it as the Worker's `scheduled` handler).
 */
export function scheduled(
  _controller: CronController,
  env: SweepEnv,
  ctx: SweepExecutionContext,
): void {
  ctx.waitUntil(sweepDueAuctions(env, ctx))
}
