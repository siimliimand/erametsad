/// <reference types="@cloudflare/vitest-pool-workers" />

// Bindings for the RateLimiterDO test worker (wrangler.jsonc in this
// directory). The DO is ephemeral, so no D1 binding is declared here.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    RATE_LIMITER: import('cloudflare:workers').DurableObjectNamespace<import('../../rate-limiter').RateLimiterDO>
  }
}
