import { expect, test } from 'vitest'

import { AuctionDO } from '../auction'
import { RateLimiterDO } from '../rate-limiter'

// The shim statically re-exports `.open-next/worker.js`, which exists only
// after `build:cf`. Clean checkouts (CI lint, pre-build) cannot load it, so
// the shim test skips on exactly that resolution failure and rethrows
// anything else.
test('entry exports both Durable Object classes', () => {
  expect(AuctionDO).toBeTypeOf('function')
  expect(AuctionDO.name).toBe('AuctionDO')
  expect(RateLimiterDO).toBeTypeOf('function')
  expect(RateLimiterDO.name).toBe('RateLimiterDO')
})

test('shim re-exports fetch, queue consumer, and cron sweep when built', async () => {
  let shim: {
    default: { fetch: (request: Request) => Promise<Response> }
    queue: unknown
    scheduled: unknown
  }
  try {
    shim = await import('../index')
  } catch (err) {
    const msg = String(err)
    if (/\.open-next|worker\.js|Failed to resolve import|Cannot find/.test(msg)) {
      console.warn('[do-worker] .open-next/worker.js not built; skipping shim export assertions')
      return
    }
    throw err
  }
  expect(typeof shim.default.fetch).toBe('function')
  expect(typeof shim.queue).toBe('function')
  expect(typeof shim.scheduled).toBe('function')
})
