interface RateLimitConfig {
  tokensPerInterval: number
  intervalMs: number
}

interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  reset: number
}

interface Bucket {
  tokens: number
  lastRefill: number
}

// Minimal DO namespace surface (same local-declaration approach as db.ts,
// so lib code never imports cloudflare:workers at runtime).
interface RateLimiterNamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: string): Promise<Response> }
}

declare global {
  interface CloudflareEnv {
    /** RateLimiterDO binding from wrangler.jsonc durable_objects (task 3.7). */
    RATE_LIMITER?: RateLimiterNamespace
  }
}

interface WorkersContext {
  env?: CloudflareEnv
  ctx?: { waitUntil?(promise: Promise<unknown>): void }
}

function workersContext(): WorkersContext | null {
  const globalScope = globalThis as unknown as Record<string | symbol, unknown>
  const probes = [
    globalScope[Symbol.for('__cloudflare-context__')],
    globalScope.__opennext_ctx__,
  ]
  for (const probe of probes) {
    if (probe && typeof probe === 'object') {
      const candidate = probe as WorkersContext
      if (candidate.env?.RATE_LIMITER) return candidate
    }
  }
  return null
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private tokensPerInterval: number
  private intervalMs: number

  constructor(config: RateLimitConfig) {
    this.tokensPerInterval = config.tokensPerInterval
    this.intervalMs = config.intervalMs
  }

  /**
   * Synchronous decision from the local mirror, then a fire-and-forget DO
   * consume that adopts the authoritative cross-isolate counters. Call
   * sites stay sync (unchanged API); the mirror converges on the DO within
   * one round trip, so the DO remains the single serialization point.
   */
  check(key: string): RateLimitResult {
    const result = this.checkLocal(key)
    this.reconcile(key)
    return result
  }

  private checkLocal(key: string): RateLimitResult {
    const now = Date.now()
    let bucket = this.buckets.get(key)

    if (!bucket) {
      bucket = { tokens: this.tokensPerInterval, lastRefill: now }
      this.buckets.set(key, bucket)
    }

    const elapsed = now - bucket.lastRefill
    const refill = Math.floor(elapsed / this.intervalMs) * this.tokensPerInterval

    if (refill > 0) {
      bucket.tokens = Math.min(bucket.tokens + refill, this.tokensPerInterval)
      bucket.lastRefill = now
    }

    const reset = bucket.lastRefill + this.intervalMs

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1
      return {
        allowed: true,
        limit: this.tokensPerInterval,
        remaining: bucket.tokens,
        reset,
      }
    }

    return {
      allowed: false,
      limit: this.tokensPerInterval,
      remaining: 0,
      reset,
    }
  }

  private reconcile(key: string): void {
    const context = workersContext()
    const namespace = context?.env?.RATE_LIMITER
    if (!namespace) return

    // Config prefix keeps same-key buckets of differently configured
    // limiters apart inside the shared "global" object.
    const doKey = `${String(this.tokensPerInterval)}/${String(this.intervalMs)}/${key}`
    const stub = namespace.get(namespace.idFromName('global'))
    const url = `https://rate-limiter/consume?key=${encodeURIComponent(doKey)}&capacity=${String(this.tokensPerInterval)}&interval=${String(this.intervalMs)}&tokens=1`

    const sync = stub
      .fetch(url)
      .then((response) => (response.ok ? response.json() : null))
      .then((remote) => {
        if (!remote) return
        const authoritative = remote as RateLimitResult
        this.buckets.set(key, { tokens: authoritative.remaining, lastRefill: Date.now() })
      })
      .catch(() => {
        // DO unreachable: keep local-only behavior until it comes back.
      })
    context.ctx?.waitUntil?.(sync)
  }
}

export const apiRateLimiter = new RateLimiter({ tokensPerInterval: 100, intervalMs: 60_000 })
export const authRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })
export const leadsRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })
export const consentRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })
// Events are click-level traffic: higher ceiling than form endpoints.
export const eventsRateLimiter = new RateLimiter({ tokensPerInterval: 30, intervalMs: 60_000 })
export const newsletterRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })
