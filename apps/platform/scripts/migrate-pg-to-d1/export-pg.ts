/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { TABLES, insertOrder, requireTable } from './tables'

// Dumps every Postgres table that exists in the D1 schema to NDJSON (one
// JSON object per line, Postgres snake_case keys, driver-native values:
// numerics arrive as strings, timestamptz as ISO strings, jsonb as parsed
// objects). The transform step applies the mapping rules afterwards.
//
// Usage:
//   SOURCE_DATABASE_URL=postgres://... pnpm migrate:pg:export [--out dir] [--tables a,b]

const BATCH_SIZE = 1000

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

async function tableExists(client: { query: (sql: string) => Promise<{ rows: unknown[] }> }, table: string) {
  const result = await client.query(
    `SELECT to_regclass('public."${table}"') AS oid`,
  )
  return Boolean((result.rows[0] as { oid: string | null } | undefined)?.oid)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const flag = (name: string, fallback: string): string => {
    const index = args.indexOf(name)
    const value = index !== -1 ? args[index + 1] : undefined
    return value ?? fallback
  }
  const url = process.env.SOURCE_DATABASE_URL
  if (!url) {
    throw new Error('Set SOURCE_DATABASE_URL to the Postgres connection string.')
  }
  const outDir = resolve(process.cwd(), flag('--out', '.export/pg'))
  const tablesFlag = flag('--tables', '')
  const wanted = tablesFlag
    ? tablesFlag.split(',').map((t) => t.trim()).filter(Boolean)
    : insertOrder()
  for (const table of wanted) requireTable(table)

  const { Client } = await import('pg')
  const client = new Client({ connectionString: url })
  await client.connect()
  mkdirSync(outDir, { recursive: true })

  try {
    for (const table of wanted) {
      if (!(await tableExists(client, table))) {
        console.warn(`${table}: no such table in Postgres, skipped`)
        continue
      }
      let offset = 0
      let count = 0
      const chunks: string[] = []
      for (;;) {
        const result = await client.query(`SELECT * FROM "${table}" LIMIT ${BATCH_SIZE} OFFSET ${offset}`)
        const rows = result.rows as Record<string, unknown>[]
        if (rows.length === 0) break
        for (const row of rows) chunks.push(JSON.stringify(row))
        count += rows.length
        offset += rows.length
        if (rows.length < BATCH_SIZE) break
      }
      writeFileSync(resolve(outDir, `${table}.ndjson`), chunks.join('\n') + (count > 0 ? '\n' : ''))
      console.log(`${table}: ${count} rows exported`)
    }
    console.log(`Exported ${wanted.length} table(s) to ${outDir} (schema knows ${TABLES.size})`)
  } finally {
    await client.end()
  }
}

if (isMain) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
