import type { DurableObjectNamespace } from 'cloudflare:workers'

import type { DbDatabase } from '../db'

/**
 * Cron safety net for auction ending (task 6.2). AuctionDO alarms are the
 * primary end mechanism; this sweep only wakes the DO for auctions that are
 * due but whose alarm was lost (object evicted before hydration or a missed
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
  /** Rows the D1 query returned as due. */
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
  const due = await env.DB.prepare(
    `select id from auctions where status = ? and ends_at <= ? limit ${String(SWEEP_LIMIT)}`,
  )
    .bind('active', now)
    .all<{ id: unknown }>()

  let woken = 0
  let failed = 0
  for (const row of due.results) {
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
  return { due: due.results.length, woken, failed }
}
