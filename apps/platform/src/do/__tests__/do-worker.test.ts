import { expect, test } from 'vitest'

import { scheduled, sweepDueAuctions } from '../../lib/workers/auction-ending'
import { AuctionDO } from '../auction'
import shimSource from '../index.ts?raw'
import { RateLimiterDO } from '../rate-limiter'

// The shim's whole job is wiring: it re-exports the built OpenNext fetch
// handler (loadable only after `build:cf`, so asserted as source wiring
// below) alongside the DO classes, the queue consumer, and the cron sweep.
test('shim wires fetch, both DO classes, queue consumer, and cron sweep', () => {
  expect(shimSource).toContain("export { default } from '../../.open-next/worker.js'")
  expect(shimSource).toContain("export { AuctionDO } from './auction'")
  expect(shimSource).toContain("export { RateLimiterDO } from './rate-limiter'")
  expect(shimSource).toContain("export { scheduled } from '../lib/workers/auction-ending'")
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
