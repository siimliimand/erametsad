import { expect, test } from 'vitest'

import entry, { AuctionDO, RateLimiterDO, queue, scheduled } from '../index'

// The default export comes from generated JS with no resolvable type in the
// lint project (it resolves to any), so type it with this minimal shape.
interface WorkerEntry {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response>
}

const worker: WorkerEntry = entry

// The shim is the wrangler entry point, so it must surface every handler the
// config registers: fetch, both DO classes, the queue consumer, and the
// cron sweep.
test('entry re-exports the OpenNext fetch handler', () => {
  expect(worker.fetch).toBeTypeOf('function')
})

test('entry exports both Durable Object classes', () => {
  expect(AuctionDO).toBeTypeOf('function')
  expect(AuctionDO.name).toBe('AuctionDO')
  expect(RateLimiterDO).toBeTypeOf('function')
  expect(RateLimiterDO.name).toBe('RateLimiterDO')
})

test('entry exports the queue consumer handler for the DLQ retry policy', () => {
  expect(queue).toBeTypeOf('function')
})

test('entry exports the cron sweep handler for the scheduled trigger', () => {
  expect(scheduled).toBeTypeOf('function')
})
