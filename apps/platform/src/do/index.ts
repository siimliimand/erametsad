// Wrangler entry shim. OpenNext generates .open-next/worker.js as a fetch-only
// module and cannot export our Durable Object classes, so `main` points here:
// the OpenNext fetch handler re-exported alongside the DO classes, the queue
// consumer, and the cron sweep, giving one Worker for HTTP, DOs, queues, and
// cron triggers.
import {
  sweepDueAuctions,
  type SweepEnv,
  type SweepExecutionContext,
} from '../lib/workers/auction-ending'

// The .open-next import target is written only after a completed build:
// absent on clean builds, present on rebuilds. That is why this is ts-ignore
// and not ts-expect-error, which would flag as unused on rebuilds. Wrangler
// and vitest resolve the real file at bundle time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated .open-next output, see above
export { default } from '../../.open-next/worker.js'
export { queue } from '../workers/queue-consumer'
export { AuctionDO } from './auction'
export { RateLimiterDO } from './rate-limiter'

interface CronController {
  cron: string
  scheduledTime: number
  noRetry(): void
}

/**
 * Cron trigger entry (task 6.2): the every-minute sweep that wakes due
 * auctions whose DO alarm was lost to eviction. The DO alarm owns the end
 * transition; the sweep only wakes objects.
 */
export function scheduled(
  _controller: CronController,
  env: SweepEnv,
  ctx: SweepExecutionContext,
): void {
  ctx.waitUntil(sweepDueAuctions(env, ctx))
}
