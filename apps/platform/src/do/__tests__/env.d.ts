/// <reference types="@cloudflare/vitest-pool-workers" />

// Bindings for the AuctionDO smoke test worker (wrangler.jsonc in this
// directory). The `DB` type is the ambient D1Database declared by
// spikes/d1-drizzle/spike-env.d.ts, which matches applyD1Migrations.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    AUCTION: import('cloudflare:workers').DurableObjectNamespace<import('../auction').AuctionDO>
    DB: D1Database
    D1_MIGRATIONS: { name: string; queries: string[] }[]
  }
}

declare module '*?raw' {
  const source: string
  export default source
}
