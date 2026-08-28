/* eslint-disable no-console */
import { is } from 'drizzle-orm'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'

import { createCoreRepositories, nodeIsikukoodCodec } from '../repositories'
import * as schema from '../schema'
import { openLocalD1 } from './d1-local'
import { seed } from './index'

function schemaTableNames(): string[] {
  const exports = Object.values(schema as Record<string, unknown>)
  return exports
    .filter((value): value is SQLiteTable => is(value, SQLiteTable))
    .map((table) => getTableConfig(table).name)
}

function rowCount(raw: ReturnType<typeof openLocalD1>['raw'], table: string): number {
  const row = raw.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }
  return row.n
}

function wipeAllTables(raw: ReturnType<typeof openLocalD1>['raw'], tables: string[]): void {
  // One wipe batch: FK enforcement off for the duration, every table emptied,
  // enforcement back on. Deletion order is irrelevant with FKs off.
  raw.exec('PRAGMA foreign_keys = OFF')
  try {
    for (const table of tables) {
      const deleted = rowCount(raw, table)
      raw.exec(`DELETE FROM "${table}"`)
      if (deleted > 0) {
        console.log(`  Truncated ${String(deleted)} records from "${table}"`)
      }
    }
  } finally {
    raw.exec('PRAGMA foreign_keys = ON')
  }
}

function logTableCounts(raw: ReturnType<typeof openLocalD1>['raw'], tables: string[]): void {
  const counts = tables
    .map((table) => `${table}=${String(rowCount(raw, table))}`)
    .filter((entry) => !entry.endsWith('=0'))
  console.log(`Row counts: ${counts.join(' ')}`)
}

export async function resetAndSeed(): Promise<void> {
  const handle = openLocalD1()
  console.log(`Resetting database… (${handle.filePath})`)

  try {
    const tables = schemaTableNames()
    wipeAllTables(handle.raw, tables)

    console.log('Database reset complete. Running seed…')

    // Trusted system context: the seed bypasses access guards by design,
    // so no guard context is attached to the repositories.
    const repos = createCoreRepositories(handle.db, {
      isikukoodCodec: nodeIsikukoodCodec,
      batch: (statements) => handle.batch(statements),
    })

    await seed(repos)

    logTableCounts(handle.raw, tables)
  } finally {
    handle.close()
  }
}
