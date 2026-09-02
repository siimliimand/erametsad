import { expect, test } from 'vitest'

import { scheduled, sweepDueAuctions } from '../../lib/workers/auction-ending'
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
