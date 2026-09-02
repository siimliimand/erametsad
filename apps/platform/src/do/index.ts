// Wrangler entry shim. OpenNext generates .open-next/worker.js as a fetch-only
// module and cannot export our Durable Object classes, so `main` points here:
// the OpenNext fetch handler re-exported alongside the DO classes, the queue
// consumer, and the cron sweep, giving one Worker for HTTP, DOs, queues, and
// cron triggers.
// The .open-next import target is written only after a completed build:
// absent on clean builds, present on rebuilds. That is why this is ts-ignore
// and not ts-expect-error, which would flag as unused on rebuilds. Wrangler
// and vitest resolve the real file at bundle time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated .open-next output, see above
import openNextWorker from '../../.open-next/worker.js'
import { sweepDueAuctions } from '../lib/workers/auction-ending'
import type {
  CronController,
  SweepEnv,
  SweepExecutionContext,
} from '../lib/workers/auction-ending'

export { AuctionDO } from './auction'
export { RateLimiterDO } from './rate-limiter'

// Cron handler must be DEFINED here, not re-exported: wrangler's static
// detection cannot see handlers through the shim's re-export chain (the
// queue export hit the same wall with deploy error 11001). When detection
// misses, deploy succeeds but the cron trigger has no registered handler
// and every tick throws "Handler does not export a scheduled() function".
// auction-ending.ts keeps its own scheduled export for tests.
export function scheduled(
  controller: CronController,
  env: SweepEnv,
  ctx: SweepExecutionContext,
): void {
  void controller
  ctx.waitUntil(sweepDueAuctions(env, ctx))
}

// Cloudflare registers cron handlers from the default ExportedHandler object
// (its version metadata listed only `fetch` while a bare named `scheduled`
// export sat in the bundle, and every tick threw "Handler does not export a
// scheduled() function"). Attaching scheduled to the default export puts it
// in the handler table; the named export above stays for tests and local dev.
export default Object.assign(openNextWorker, { scheduled })
