/// <reference types="@cloudflare/vitest-pool-workers" />

// Bindings for the queue consumer test worker (wrangler.jsonc in this
// directory). The `DB` and `D1_MIGRATIONS` types come from the ambient
// declarations in spikes/d1-drizzle/spike-env.d.ts, merged into the same
// ProvidedEnv interface.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    KV: import('../types').QueueKvNamespace
    BUCKET: import('../types').QueueR2Bucket
    DB: D1Database
    D1_MIGRATIONS: { name: string; queries: string[] }[]
  }
}
