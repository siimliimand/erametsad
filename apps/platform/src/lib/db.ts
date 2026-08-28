import { getCloudflareContext } from '@opennextjs/cloudflare'

/**
 * Minimal D1 runtime surface for direct SQL. Declared locally because the
 * full @cloudflare/workers-types package conflicts with src/lib/storage.ts's
 * own R2 declarations (same approach as the spike env types).
 */
export type SqlParam = string | number | boolean | null
export type SqlParams = readonly SqlParam[]

export interface DbResult<T = unknown> {
  results: T[]
  success: boolean
  meta: Record<string, unknown>
}

export interface DbPreparedStatement {
  bind(...values: SqlParam[]): DbPreparedStatement
  all<T = unknown>(): Promise<DbResult<T>>
}

export interface DbDatabase {
  prepare(query: string): DbPreparedStatement
  batch<T = unknown>(statements: DbPreparedStatement[]): Promise<DbResult<T>[]>
}

declare global {
  interface CloudflareEnv {
    /** D1 binding from wrangler.jsonc d1_databases. */
    DB?: DbDatabase
  }
}

// Test seam: inject a D1-compatible stub before a suite runs, clear with
// null afterwards. When set, the Cloudflare context is never touched, so
// unit tests run in plain Node without workerd.
let d1ForTests: DbDatabase | null = null

export function setD1ForTests(d1: DbDatabase | null): void {
  d1ForTests = d1
}

async function getD1(): Promise<DbDatabase> {
  if (d1ForTests) return d1ForTests
  // Fetched per call, never cached as a module singleton: isolates are
  // reused across requests and a cached binding could outlive its
  // invocation. The context getter itself is cheap and per-request.
  const context = await getCloudflareContext({ async: true })
  const d1 = context.env.DB
  if (!d1) {
    throw new Error(
      'D1 binding "DB" is not available; check d1_databases in wrangler.jsonc',
    )
  }
  return d1
}

export interface SqlStatement {
  sql: string
  params?: SqlParams
}

function prepare(
  d1: DbDatabase,
  sql: string,
  params?: SqlParams,
): DbPreparedStatement {
  return params && params.length > 0
    ? d1.prepare(sql).bind(...params)
    : d1.prepare(sql)
}

/**
 * SQLite-dialect executor over the D1 `DB` binding. `batch` maps to D1
 * batch, which runs its statements as one atomic transaction.
 */
export const db = {
  async query<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams,
  ): Promise<DbResult<T>> {
    const d1 = await getD1()
    return prepare(d1, sql, params).all<T>()
  },

  async batch<T = unknown>(
    statements: readonly SqlStatement[],
  ): Promise<DbResult<T>[]> {
    if (statements.length === 0) return []
    const d1 = await getD1()
    return d1.batch<T>(
      statements.map((statement) =>
        prepare(d1, statement.sql, statement.params),
      ),
    )
  },
}

export type DbExecutor = typeof db
