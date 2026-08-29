/* eslint-disable no-console */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

import { deleteOrder, insertOrder, requireTable } from './tables'

// Imports transformed NDJSON rows into D1. Two execution targets:
//   default          the local wrangler D1 sqlite file (same store as
//                    `pnpm db:migrate:local` / `pnpm seed:reset`)
//   --db-file <path> any sqlite file; pair with --migrate to apply the
//                    drizzle/ migrations first (scratch-database smoke runs)
// Alternatively, --sql-file <path> emits one .sql file (idempotent
// DELETE-then-INSERT, FK order) for `wrangler d1 execute DB --local|--remote
// --file`, which is the only path for a remote D1 database.
//
// Re-running is safe: every imported table is wiped (children first) before
// its rows insert (parents first), one transaction per table.

const BATCH_ROWS = 500
const D1_OBJECT_DIR = ['.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject']
const D1_FILE_PATTERN = /^[0-9a-f]{64}\.sqlite$/
const DEFAULT_IN = '.export/transformed'

export function sqlLiteral(value: string | number | null): string {
  if (value === null) return 'NULL'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Cannot render number ${value} as SQL`)
    return String(value)
  }
  return `'${value.replace(/'/g, "''")}'`
}

interface LoadedTable {
  table: string
  columns: string[]
  rows: (string | number | null)[][]
}

function readTable(inDir: string, table: string): LoadedTable | null {
  const file = resolve(inDir, `${table}.ndjson`)
  if (!existsSync(file)) return null
  const rows: (string | number | null)[][] = []
  let columns: string[] = []
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const parsed = JSON.parse(trimmed) as Record<string, string | number | null>
    if (columns.length === 0) columns = Object.keys(parsed)
    rows.push(columns.map((column) => parsed[column] ?? null))
  }
  return { table, columns, rows }
}

function insertChunks(loaded: LoadedTable, batchRows: number): { sql: string; params: unknown[] }[] {
  const columnList = loaded.columns.map((column) => `"${column}"`).join(', ')
  const placeholders = `(${loaded.columns.map(() => '?').join(', ')})`
  const chunks: { sql: string; params: unknown[] }[] = []
  for (let start = 0; start < loaded.rows.length; start += batchRows) {
    const chunk = loaded.rows.slice(start, start + batchRows)
    chunks.push({
      sql: `INSERT INTO "${loaded.table}" (${columnList}) VALUES ${chunk.map(() => placeholders).join(', ')}`,
      params: chunk.flat(),
    })
  }
  return chunks
}

function runAgainstSqlite(
  loadedTables: readonly LoadedTable[],
  dbFile: string,
  options: { migrate: boolean; enforceFk: boolean; batchRows: number },
): void {
  mkdirSync(dirname(dbFile), { recursive: true })
  const fresh = !existsSync(dbFile)
  const raw = new DatabaseSync(dbFile)
  if (options.migrate || fresh) applyMigrations(raw)
  if (options.enforceFk) raw.exec('PRAGMA foreign_keys = ON')

  try {
    for (const { table } of [...loadedTables].reverse()) {
      raw.exec('BEGIN')
      try {
        raw.prepare(`DELETE FROM "${table}"`).run()
        raw.exec('COMMIT')
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
    }
    for (const loaded of loadedTables) {
      raw.exec('BEGIN')
      try {
        for (const chunk of insertChunks(loaded, options.batchRows)) {
          raw.prepare(chunk.sql).run(...(chunk.params as never[]))
        }
        raw.exec('COMMIT')
      } catch (error) {
        raw.exec('ROLLBACK')
        throw error
      }
      console.log(`${loaded.table}: deleted + inserted ${loaded.rows.length} rows`)
    }
  } finally {
    raw.close()
  }
}

function applyMigrations(raw: DatabaseSync): void {
  const drizzleDir = resolve(process.cwd(), 'drizzle')
  if (!existsSync(drizzleDir)) throw new Error(`No drizzle/ migrations directory at ${drizzleDir}`)
  const files = readdirSync(drizzleDir).filter((name) => /^\d{4}_.*\.sql$/.test(name)).sort()
  for (const file of files) {
    for (const statement of readFileSync(resolve(drizzleDir, file), 'utf8').split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) raw.exec(trimmed)
    }
  }
  console.log(`Applied ${files.length} drizzle migration(s)`)
}

function writeSqlFile(loadedTables: readonly LoadedTable[], sqlFile: string, batchRows: number): void {
  const parts: string[] = []
  for (const { table } of [...loadedTables].reverse()) {
    parts.push(`DELETE FROM "${table}";`)
  }
  for (const loaded of loadedTables) {
    for (let start = 0; start < loaded.rows.length; start += batchRows) {
      const chunk = loaded.rows.slice(start, start + batchRows)
      const columnList = loaded.columns.map((column) => `"${column}"`).join(', ')
      const values = chunk
        .map((row) => `(${row.map(sqlLiteral).join(', ')})`)
        .join(',\n  ')
      parts.push(`INSERT INTO "${loaded.table}" (${columnList}) VALUES\n  ${values};`)
    }
  }
  mkdirSync(dirname(sqlFile), { recursive: true })
  // The file must be self-contained if --tables was scoped: FK deletes are
  // emitted only for the tables present in this run.
  writeFileSync(sqlFile, `${parts.join('\n\n')}\n`)
  console.log(`Wrote ${sqlFile} (${loadedTables.length} table(s))`)
}

function discoverLocalD1File(appRoot: string): string {
  const objectDir = resolve(appRoot, ...D1_OBJECT_DIR)
  if (!existsSync(objectDir) || !statSync(objectDir).isDirectory()) {
    throw new Error(
      `No local D1 state at ${objectDir}. Run "pnpm db:migrate:local" first, or point --db-file at a sqlite file.`,
    )
  }
  const candidates = readdirSync(objectDir).filter((name) => D1_FILE_PATTERN.test(name))
  const candidate = candidates[0]
  if (candidates.length !== 1 || candidate === undefined) {
    throw new Error(
      `Expected exactly one local D1 database under ${objectDir}, found ${candidates.length}. Use --db-file to name one.`,
    )
  }
  return resolve(objectDir, candidate)
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

function main(): void {
  const args = process.argv.slice(2)
  const flag = (name: string, fallback: string): string => {
    const index = args.indexOf(name)
    const value = index !== -1 ? args[index + 1] : undefined
    return value ?? fallback
  }
  const has = (name: string): boolean => args.includes(name)
  const inDir = resolve(process.cwd(), flag('--in', DEFAULT_IN))
  const tablesFlag = flag('--tables', '')
  const batchRows = Number(flag('--batch-rows', String(BATCH_ROWS)))
  if (!Number.isInteger(batchRows) || batchRows < 1) throw new Error('--batch-rows must be a positive integer')
  const sqlFile = has('--sql-file') ? flag('--sql-file', 'import-d1.sql') : null

  const wanted = tablesFlag ? tablesFlag.split(',').map((t) => t.trim()).filter(Boolean) : insertOrder()
  const loadedTables: LoadedTable[] = []
  for (const table of wanted) {
    requireTable(table)
    const loaded = readTable(inDir, table)
    if (loaded && loaded.rows.length > 0) loadedTables.push(loaded)
    else console.log(`${table}: no transformed rows, skipped`)
  }
  if (loadedTables.length === 0) throw new Error(`No transformed rows found under ${inDir}`)

  if (sqlFile) {
    writeSqlFile(loadedTables, resolve(process.cwd(), sqlFile), batchRows)
    return
  }
  const dbFile = has('--db-file')
    ? resolve(process.cwd(), flag('--db-file', 'scratch.sqlite'))
    : discoverLocalD1File(process.cwd())
  runAgainstSqlite(loadedTables, dbFile, {
    migrate: has('--migrate'),
    enforceFk: !has('--no-fk-check'),
    batchRows,
  })
  console.log(`Imported into ${dbFile}`)
}

if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
