import { env } from 'cloudflare:test'
import { expect, test } from 'vitest'

interface ConsumeResponse {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
}

interface StatsResponse {
  keys: number
  alarmAt: number | null
}

function consume(
  key: string,
  options?: { capacity?: number; interval?: number; tokens?: number },
): Promise<Response> {
  const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'))
  const params = new URLSearchParams({
    key,
    capacity: String(options?.capacity ?? 5),
    interval: String(options?.interval ?? 60_000),
  })
  if (options?.tokens !== undefined) {
    params.set('tokens', String(options.tokens))
  }
  return stub.fetch(`https://rate-limiter/consume?${params}`, { method: 'POST' })
}

async function stats(prefix?: string): Promise<StatsResponse> {
  const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'))
  const query = prefix ? `?prefix=${encodeURIComponent(prefix)}` : ''
  const response = await stub.fetch(`https://rate-limiter/stats${query}`)
  return (await response.json()) as StatsResponse
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function readConsume(response: Response): Promise<ConsumeResponse> {
  expect(response.status).toBe(200)
  return (await response.json()) as ConsumeResponse
}

test('consume decrements tokens within capacity', async () => {
  const key = 'decrement-test'
  const first = await readConsume(await consume(key, { capacity: 3 }))
  expect(first).toMatchObject({ allowed: true, limit: 3, remaining: 2 })
  expect(first.reset).toBeGreaterThan(Date.now())

  expect(await readConsume(await consume(key, { capacity: 3 }))).toMatchObject({ allowed: true, remaining: 1 })
  expect(await readConsume(await consume(key, { capacity: 3 }))).toMatchObject({ allowed: true, remaining: 0 })
})

test('consume denies once the bucket is empty', async () => {
  const key = 'deny-test'
  expect(await readConsume(await consume(key, { capacity: 1 }))).toMatchObject({ allowed: true, remaining: 0 })

  const denied = await readConsume(await consume(key, { capacity: 1 }))
  expect(denied).toMatchObject({ allowed: false, limit: 1, remaining: 0 })
  expect(denied.reset).toBeGreaterThan(Date.now())
})

test('bucket refills after a full interval', async () => {
  const key = 'refill-test'
  await consume(key, { capacity: 2, interval: 50 })
  await consume(key, { capacity: 2, interval: 50 })

  const denied = await readConsume(await consume(key, { capacity: 2, interval: 50 }))
  expect(denied.allowed).toBe(false)

  await sleep(120)
  expect(await readConsume(await consume(key, { capacity: 2, interval: 50 }))).toMatchObject({
    allowed: true,
    remaining: 1,
  })
})

test('keys hold independent buckets', async () => {
  await consume('isolation-a', { capacity: 1 })
  const denied = await readConsume(await consume('isolation-a', { capacity: 1 }))
  const other = await readConsume(await consume('isolation-b', { capacity: 1 }))

  expect(denied.allowed).toBe(false)
  expect(other.allowed).toBe(true)
})

test('multi-token costs consume atomically', async () => {
  const key = 'cost-test'
  expect(await readConsume(await consume(key, { capacity: 5, tokens: 3 }))).toMatchObject({
    allowed: true,
    remaining: 2,
  })
  expect(await readConsume(await consume(key, { capacity: 5, tokens: 3 }))).toMatchObject({
    allowed: false,
    remaining: 2,
  })
})

test('malformed requests are rejected', async () => {
  const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName('global'))

  const missingKey = await stub.fetch('https://rate-limiter/consume?capacity=5&interval=60000', { method: 'POST' })
  expect(missingKey.status).toBe(400)

  const badCapacity = await stub.fetch('https://rate-limiter/consume?key=x&capacity=0&interval=60000', { method: 'POST' })
  expect(badCapacity.status).toBe(400)

  const wrongMethod = await stub.fetch('https://rate-limiter/consume?key=x&capacity=5&interval=60000')
  expect(wrongMethod.status).toBe(405)

  const unknownPath = await stub.fetch('https://rate-limiter/nope')
  expect(unknownPath.status).toBe(404)
})

test('stats reports tracked keys and the scheduled alarm', async () => {
  await consume('stats-test', { capacity: 2, interval: 60_000 })

  const before = await stats('stats-test')
  expect(before.keys).toBe(1)
  expect(before.alarmAt).not.toBeNull()
})

test('alarm sweeps stale keys, then fresh consumes restart clean', async () => {
  const key = 'sweep-test'
  await consume(key, { capacity: 2, interval: 50 })
  expect((await stats(key)).keys).toBe(1)

  const deadline = Date.now() + 5_000
  let after: StatsResponse = { keys: -1, alarmAt: null }
  while (Date.now() < deadline) {
    after = await stats(key)
    if (after.keys === 0) break
    await sleep(50)
  }

  expect(after.keys).toBe(0)

  const fresh = await readConsume(await consume(key, { capacity: 2, interval: 50 }))
  expect(fresh).toMatchObject({ allowed: true, remaining: 1 })
})
