/// <reference types="@cloudflare/vitest-pool-workers" />

// Minimal ambient types for the D1 spike. The full @cloudflare/workers-types
// package conflicts with src/lib/storage.ts's own R2 declarations (it turns
// wrangler's unresolvable workers-types import into real globals), so the
// spike declares only the runtime shapes it uses.
declare module 'cloudflare:test' {
  interface ProvidedEnv {
    DB: D1Database
    D1_MIGRATIONS: { name: string; queries: string[] }[]
  }
}

interface D1Result<T = unknown> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = unknown>(colName?: string): Promise<T | null>
  all<T = unknown>(): Promise<D1Result<T>>
  run<T = unknown>(): Promise<D1Result<T>>
  raw<T = unknown>(): Promise<T[]>
}

interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>
  exec(sql: string): Promise<Record<string, unknown>>
}
