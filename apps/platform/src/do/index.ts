// Wrangler entry shim. OpenNext generates .open-next/worker.js as a fetch-only
// module and cannot export our Durable Object classes, so `main` points here:
// the OpenNext fetch handler re-exported alongside the DO classes and the
// queue consumer, giving one Worker for HTTP, DOs, and queues.
// The import target is written only after a completed build: absent on clean
// builds, present on rebuilds. That is why this is ts-ignore and not
// ts-expect-error, which would flag as unused on rebuilds. Wrangler and
// vitest resolve the real file at bundle time.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore generated .open-next output, see above
export { default } from '../../.open-next/worker.js'
export { queue } from '../workers/queue-consumer'
export { AuctionDO } from './auction'
export { RateLimiterDO } from './rate-limiter'
