import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { existsSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

import type { BatchStatement, CoreDatabase } from '../repositories'
import * as schema from '../schema'

// Wrangler keeps local D1 databases as plain SQLite files under the miniflare
// state directory (same embedded engine as `wrangler d1 --local`, per the
// d1-drizzle spike report). The `<sha256>.sqlite` object id is derived inside
// workerd, so the runner discovers the file instead of recomputing the hash.
const D1_OBJECT_DIR = ['.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject']
const D1_FILE_PATTERN = /^[0-9a-f]{64}\.sqlite$/

export interface LocalD1Handle {
  db: CoreDatabase
  raw: DatabaseSync
  filePath: string
  /** Atomic multi-statement executor bound to the same connection. */
  batch(statements: readonly [BatchStatement, ...BatchStatement[]]): Promise<readonly unknown[]>
  close(): void
}

function tableExists(raw: DatabaseSync, name: string): boolean {
  const row = raw
    .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name) as { n: number } | undefined
  return (row?.n ?? 0) > 0
}

function executeOne(
  raw: DatabaseSync,
  sql: string,
  params: readonly unknown[],
  method: 'run' | 'all' | 'values' | 'get',
): { rows: unknown[] } {
  const stmt = raw.prepare(sql)
  if (method === 'run') {
    stmt.run(...params)
    return { rows: [] }
  }
  // The sqlite-proxy session maps result rows by column position, so the
  // statement must return arrays instead of keyed objects.
  stmt.setReturnArrays(true)
  if (method === 'get') {
    const row = stmt.get(...params)
    return { rows: row === undefined ? [] : [row] }
  }
  return { rows: stmt.all(...params) }
}

export function openLocalD1(appRoot = process.cwd()): LocalD1Handle {
  const objectDir = resolve(appRoot, ...D1_OBJECT_DIR)
  if (!existsSync(objectDir)) {
    throw new Error(
      `No local D1 state found at ${objectDir}. Run "pnpm db:migrate:local" (wrangler d1 migrations apply DB --local) first.`,
    )
  }

  const candidates = readdirSync(objectDir).filter((name) => D1_FILE_PATTERN.test(name))
  const candidate = candidates[0]
  if (!candidate) {
    throw new Error(
      `No local D1 database file found under ${objectDir}. Run "pnpm db:migrate:local" first.`,
    )
  }
  if (candidates.length > 1) {
    throw new Error(
      `Expected exactly one local D1 database, found: ${candidates.join(', ')}. Remove the unused ones and retry.`,
    )
  }

  const filePath = resolve(objectDir, candidate)
  const raw = new DatabaseSync(filePath)
  if (!tableExists(raw, 'users')) {
    raw.close()
    throw new Error(
      `Local D1 file ${filePath} has no schema tables. Run "pnpm db:migrate:local" before seeding.`,
    )
  }

  const remote = (sql: string, params: unknown[], method: 'run' | 'all' | 'values' | 'get') =>
    Promise.resolve(executeOne(raw, sql, params, method))

  // One BEGIN/COMMIT block per batch keeps the repository batch contract
  // (all-or-nothing) on the direct file handle, mirroring D1 batch().
  const batchRemote = (items: { sql: string; params: unknown[]; method: 'run' | 'all' | 'values' | 'get' }[]) => {
    raw.exec('BEGIN')
    try {
      const results = items.map((item) => executeOne(raw, item.sql, item.params, item.method))
      raw.exec('COMMIT')
      return Promise.resolve(results)
    } catch (error) {
      raw.exec('ROLLBACK')
      return Promise.reject(error instanceof Error ? error : new Error(String(error)))
    }
  }

  const remoteDb = drizzle(remote, batchRemote, { schema })
  const db: CoreDatabase = remoteDb

  return {
    db,
    raw,
    filePath,
    batch: (statements) => remoteDb.batch(statements),
    close() {
      raw.close()
    },
  }
}
