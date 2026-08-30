import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { DbDatabase, DbPreparedStatement, DbResult, SqlParam } from '../../db'
import type { BatchRunner, CoreDatabase } from '../repositories'
import * as schema from '../schema'

const DRIZZLE_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../../drizzle')

interface Compilable {
  toSQL(): { sql: string; params: unknown[] }
}

export interface SqliteTestDb {
  /** Drizzle over better-sqlite3, widened to the async core database type. */
  database: CoreDatabase
  /** Raw better-sqlite3 handle for direct SQL assertions and seeding. */
  raw: Database.Database
  /** D1-shaped adapter for the raw executor (`db.query` in src/lib/db.ts). */
  d1: DbDatabase
  close(): void
}

function migrationStatements(): string[] {
  const files = readdirSync(DRIZZLE_DIR)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort()
  const statements: string[] = []
  for (const file of files) {
    const content = readFileSync(path.join(DRIZZLE_DIR, file), 'utf8')
    for (const statement of content.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) statements.push(trimmed)
    }
  }
  return statements
}

/**
 * better-sqlite3 backing for the batch option: one real transaction over
 * the compiled statements, returning each statement's rows like D1 batch.
 */
export function sqliteBatchRunner(raw: Database.Database): BatchRunner {
  // Fully synchronous: better-sqlite3 runs the whole batch in one real
  // transaction; the Promise wrapper only satisfies the batch option type.
  return (statements) => {
    const compiled = statements.map((statement) =>
      (statement as unknown as Compilable).toSQL(),
    )
    const run = raw.transaction(() =>
      compiled.map(({ sql, params }) => {
        const prepared = raw.prepare(sql)
        if (prepared.reader) {
          return prepared.all(...(params as never[]))
        }
        prepared.run(...(params as never[]))
        return []
      }),
    )
    return Promise.resolve(run())
  }
}

function sqliteD1(raw: Database.Database): DbDatabase {
  const prepare = (sqlText: string): DbPreparedStatement => {
    const statement = raw.prepare(sqlText)
    let params: SqlParam[] = []
    const bound: DbPreparedStatement = {
      bind(...values: SqlParam[]) {
        params = values
        return bound
      },
      all<T>(): Promise<DbResult<T>> {
        if (statement.reader) {
          return Promise.resolve({
            results: statement.all(...(params as never[])) as T[],
            success: true,
            meta: {},
          })
        }
        const run = statement.run(...(params as never[]))
        return Promise.resolve({ results: [], success: true, meta: { changes: run.changes } })
      },
    }
    return bound
  }
  return {
    prepare,
    async batch<T>(prepared: DbPreparedStatement[]): Promise<DbResult<T>[]> {
      return Promise.all(prepared.map((statement) => statement.all<T>()))
    },
  }
}

/** In-memory SQLite with the production D1 migrations applied. */
export function createSqliteTestDb(): SqliteTestDb {
  const raw = new Database(':memory:')
  for (const statement of migrationStatements()) {
    raw.exec(statement)
  }
  const local = drizzle(raw, { schema })
  return {
    database: local as unknown as CoreDatabase,
    raw,
    d1: sqliteD1(raw),
    close() {
      raw.close()
    },
  }
}
