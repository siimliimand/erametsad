import { afterEach, describe, expect, it } from 'vitest'

import { RateLimiter, apiRateLimiter, authRateLimiter, leadsRateLimiter } from '@/lib/rate-limit'

interface RemoteResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
}

const contextKey = Symbol.for('__cloudflare-context__')
const calls: string[] = []
const captured: Promise<unknown>[] = []
let responder: (url: string) => Response = () => successResponse({ allowed: true, limit: 5, remaining: 2, reset: 0 })

function successResponse(result: RemoteResult): Response {
  return new Response(JSON.stringify(result), {
    headers: { 'content-type': 'application/json' },
  })
}

function installWorkersContext(): void {
  const namespace = {
    idFromName: (name: string) => ({ name }),
    get: () => ({
      fetch: (url: string) => {
        calls.push(url)
        return Promise.resolve(responder(url))
      },
    }),
  }
  ;(globalThis as unknown as Record<string | symbol, unknown>)[contextKey] = {
    env: { RATE_LIMITER: namespace },
    ctx: { waitUntil: (promise: Promise<unknown>) => captured.push(promise) },
  }
}

function removeWorkersContext(): void {
  ;(globalThis as unknown as Record<string | symbol, unknown>)[contextKey] = undefined
}

async function flush(): Promise<void> {
  await Promise.allSettled(captured)
}

afterEach(() => {
  removeWorkersContext()
  calls.length = 0
  captured.length = 0
  responder = () => successResponse({ allowed: true, limit: 5, remaining: 2, reset: 0 })
})

describe('RateLimiter without a Workers context', () => {
  it('keeps the in-memory token bucket behavior', () => {
    const limiter = new RateLimiter({ tokensPerInterval: 3, intervalMs: 60_000 })

    const first = limiter.check('ip')
    expect(first).toMatchObject({ allowed: true, limit: 3, remaining: 2 })
    expect(first.reset).toBeGreaterThan(Date.now())

    expect(limiter.check('ip')).toMatchObject({ allowed: true, remaining: 1 })
    expect(limiter.check('ip')).toMatchObject({ allowed: true, remaining: 0 })
    expect(limiter.check('ip')).toMatchObject({ allowed: false, remaining: 0, limit: 3 })
  })

  it('tracks keys independently', () => {
    const limiter = new RateLimiter({ tokensPerInterval: 1, intervalMs: 60_000 })

    expect(limiter.check('a').allowed).toBe(true)
    expect(limiter.check('b').allowed).toBe(true)
    expect(limiter.check('a').allowed).toBe(false)
  })
})

describe('RateLimiter delegating to RateLimiterDO', () => {
  it('consumes on the global DO object with config-namespaced keys', async () => {
    installWorkersContext()
    const limiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })

    limiter.check('leads:1.2.3.4')
    await flush()

    expect(calls).toHaveLength(1)
    const firstCall = calls[0]
    expect(firstCall).toBeDefined()
    const request = new URL(firstCall ?? '')
    expect(request.pathname).toBe('/consume')
    expect(request.searchParams.get('key')).toBe('5/60000/leads:1.2.3.4')
    expect(request.searchParams.get('capacity')).toBe('5')
    expect(request.searchParams.get('interval')).toBe('60000')
    expect(request.searchParams.get('tokens')).toBe('1')
  })

  it('returns the local decision synchronously, then adopts the DO counters', async () => {
    installWorkersContext()
    const limiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })

    const optimistic = limiter.check('ip')
    expect(optimistic).toMatchObject({ allowed: true, remaining: 4 })
    await flush()

    expect(limiter.check('ip')).toMatchObject({ allowed: true, remaining: 1 })
  })

  it('clamps the local bucket when the DO denies', async () => {
    installWorkersContext()
    responder = () => successResponse({ allowed: false, limit: 5, remaining: 0, reset: 0 })
    const limiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })

    limiter.check('ip')
    await flush()

    expect(limiter.check('ip')).toMatchObject({ allowed: false, remaining: 0 })
  })

  it('keeps local behavior when the DO call fails', async () => {
    installWorkersContext()
    responder = () => new Response('boom', { status: 500 })
    const limiter = new RateLimiter({ tokensPerInterval: 2, intervalMs: 60_000 })

    expect(limiter.check('ip')).toMatchObject({ allowed: true, remaining: 1 })
    await flush()

    expect(limiter.check('ip')).toMatchObject({ allowed: true, remaining: 0 })
  })

  it('routes the reconcile promise through waitUntil', () => {
    installWorkersContext()
    const limiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })

    limiter.check('ip')

    expect(captured).toHaveLength(1)
  })
})

describe('exported limiter instances', () => {
  it('exposes the api, auth, and leads limiters', () => {
    expect(apiRateLimiter).toBeInstanceOf(RateLimiter)
    expect(authRateLimiter).toBeInstanceOf(RateLimiter)
    expect(leadsRateLimiter).toBeInstanceOf(RateLimiter)
  })
})
