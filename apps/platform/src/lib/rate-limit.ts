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

export class RateLimiter {
  private buckets = new Map<string, Bucket>()
  private tokensPerInterval: number
  private intervalMs: number

  constructor(config: RateLimitConfig) {
    this.tokensPerInterval = config.tokensPerInterval
    this.intervalMs = config.intervalMs
  }

  check(key: string): RateLimitResult {
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
}

export const apiRateLimiter = new RateLimiter({ tokensPerInterval: 100, intervalMs: 60_000 })
export const authRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })
export const leadsRateLimiter = new RateLimiter({ tokensPerInterval: 5, intervalMs: 60_000 })