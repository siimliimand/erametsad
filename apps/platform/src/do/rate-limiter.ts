import { DurableObject } from 'cloudflare:workers'

// Ephemeral DO: token buckets live in DO storage only; no D1 dependency.
export type Env = Record<string, never>

interface BucketState {
  tokens: number
  lastRefillAt: number
  capacity: number
  /** Whole-window chunky refill (capacity tokens per window), matching src/lib/rate-limit.ts. */
  refillIntervalMs: number
}

interface ConsumeResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
}

const BUCKET_PREFIX = 'bucket:'
const SWEEP_FLOOR_MS = 100
const SWEEP_CEILING_MS = 60_000

/**
 * Authoritative token bucket behind `src/lib/rate-limit.ts`. One object
 * (`idFromName('global')`) serializes every key, so the limit holds across
 * Worker isolates. Buckets expire through alarm sweeps once fully refilled
 * and idle, which keeps storage bounded without a D1 round trip.
 */
export class RateLimiterDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)

    if (pathname === '/stats') {
      if (request.method !== 'GET') {
        return errorResponse(405, `method ${request.method} not allowed on /stats`)
      }
      const prefix = BUCKET_PREFIX + (new URL(request.url).searchParams.get('prefix') ?? '')
      const buckets = await this.ctx.storage.list<BucketState>({ prefix })
      return jsonResponse({ keys: buckets.size, alarmAt: await this.ctx.storage.getAlarm() })
    }

    if (pathname !== '/consume') {
      return errorResponse(404, `unknown path ${pathname}`)
    }
    if (request.method !== 'POST') {
      return errorResponse(405, `method ${request.method} not allowed on /consume`)
    }

    const params = new URL(request.url).searchParams
    const key = params.get('key')
    const capacity = numberParam(params, 'capacity')
    const intervalMs = numberParam(params, 'interval')
    const cost = numberParam(params, 'tokens', 1)
    if (!key || capacity === null || intervalMs === null || cost === null) {
      return errorResponse(400, 'expected key, capacity, interval, and optional tokens > 0')
    }

    const result = await this.consume(key, capacity, intervalMs, cost)
    return jsonResponse(result)
  }

  /** Deletes buckets that have fully refilled and stayed idle; reschedules itself while keys remain. */
  async alarm(): Promise<void> {
    const now = Date.now()
    const buckets = await this.ctx.storage.list<BucketState>({ prefix: BUCKET_PREFIX })
    const survivorIntervals: number[] = []
    for (const [storageKey, bucket] of buckets) {
      if (now - bucket.lastRefillAt >= bucket.refillIntervalMs * 2) {
        await this.ctx.storage.delete(storageKey)
      } else {
        survivorIntervals.push(bucket.refillIntervalMs)
      }
    }
    if (survivorIntervals.length > 0) {
      await this.ctx.storage.setAlarm(now + sweepDelay(Math.min(...survivorIntervals)))
    }
  }

  private async consume(
    key: string,
    capacity: number,
    intervalMs: number,
    cost: number,
  ): Promise<ConsumeResult> {
    const storageKey = `${BUCKET_PREFIX}${key}`
    const now = Date.now()
    const bucket =
      (await this.ctx.storage.get<BucketState>(storageKey)) ??
      ({ tokens: capacity, lastRefillAt: now } as BucketState)
    bucket.capacity = capacity
    bucket.refillIntervalMs = intervalMs

    const elapsed = now - bucket.lastRefillAt
    const refill = Math.floor(elapsed / intervalMs) * capacity
    if (refill > 0) {
      bucket.tokens = Math.min(bucket.tokens + refill, capacity)
      bucket.lastRefillAt = now
    }

    const allowed = bucket.tokens >= cost
    if (allowed) {
      bucket.tokens -= cost
    }
    await this.ctx.storage.put(storageKey, bucket)

    // Sweep no later than this bucket's staleness horizon; keep any earlier alarm.
    const target = now + sweepDelay(intervalMs)
    const current = await this.ctx.storage.getAlarm()
    if (current === null || current > target) {
      await this.ctx.storage.setAlarm(target)
    }

    return {
      allowed,
      limit: capacity,
      remaining: bucket.tokens,
      reset: bucket.lastRefillAt + intervalMs,
    }
  }
}

function numberParam(params: URLSearchParams, name: string, fallback?: number): number | null {
  const raw = params.get(name)
  if (raw === null) {
    return fallback ?? null
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    return null
  }
  return value
}

function sweepDelay(intervalMs: number): number {
  return Math.min(Math.max(intervalMs * 2, SWEEP_FLOOR_MS), SWEEP_CEILING_MS)
}

function errorResponse(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'content-type': 'application/json' },
  })
}
