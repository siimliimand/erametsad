/* eslint-disable no-console */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getTableColumns, type Column, type Table } from 'drizzle-orm'

import { TABLES, insertOrder, requireTable } from './tables'

// Pure Postgres-row -> D1-row mapping per the Option B design rules:
//   numeric money (euros) -> INTEGER cents   (target column `*_cents`)
//   timestamptz            -> TEXT ISO-8601 UTC (target column `*_at`)
//   jsonb                  -> TEXT JSON string
//   enum / uuid / other    -> TEXT, values and ids unchanged
// Column lists are derived from the D1 Drizzle schema, so the transform
// cannot drift from it. Source rows use the Postgres snake_case names; for a
// `x_cents` target the source value is looked up as `x_cents` (already cents),
// then `x_eur` (euros), then `x` (euros).

export type PgValue = string | number | boolean | null | PgJsonObject | PgJsonValue[]
export interface PgJsonObject {
  [key: string]: PgJsonValue
}
export type PgJsonValue = PgValue
export type PgRow = Record<string, PgValue>
export type D1Value = string | number | null
export type D1Row = Record<string, D1Value>

const CENTS_SUFFIX = '_cents'
const EUR_SUFFIX = '_eur'
const TIME_SUFFIX = '_at'

export function eurosToCents(value: number | string): number {
  const euros = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(euros)) {
    throw new Error(`Not a finite euro amount: ${JSON.stringify(value)}`)
  }
  // Half-up rounding with an epsilon guard: 10.005 * 100 must become 1001,
  // not 1000, even though the float product is 1000.4999999999999.
  return Math.round(euros * 100 * (1 + Number.EPSILON))
}

export function toIsoUtc(value: string | number | Date): string {
  let text = String(value).trim()
  // Postgres text output separates date and time with a space, may put a
  // space before the offset, and may shorten the offset to hours or drop the
  // colon; normalize all of that before Date parsing.
  text = text.replace(/^(\d{4}-\d{2}-\d{2}) /, '$1T')
  text = text.replace(/\s+([+-]\d{2}:?\d{2}|Z)$/, '$1')
  text = text.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  text = text.replace(/([+-]\d{2})$/, '$1:00')
  const time = (typeof value === 'number' ? new Date(value) : new Date(text)).getTime()
  if (Number.isNaN(time)) {
    throw new Error(`Not a parseable timestamp: ${JSON.stringify(value)}`)
  }
  return new Date(time).toISOString()
}

export function toJsonText(value: PgJsonObject | PgJsonValue[]): string {
  return JSON.stringify(value)
}

export function boolToInt(value: boolean | number | string): 0 | 1 {
  if (value === true || value === 1 || value === 'true') return 1
  return 0
}

/** Source-key candidates for one D1 column, most specific first. */
export function sourceCandidates(targetName: string): readonly string[] {
  if (targetName.endsWith(CENTS_SUFFIX)) {
    const base = targetName.slice(0, -CENTS_SUFFIX.length)
    return [targetName, `${base}${EUR_SUFFIX}`, base]
  }
  return [targetName]
}

interface ColumnRule {
  kind: 'money' | 'timestamp' | 'boolean' | 'numeric' | 'passthrough'
}

function ruleFor(column: Column, name: string): ColumnRule {
  const dataType = (column as unknown as { dataType: string }).dataType
  if (name.endsWith(CENTS_SUFFIX)) return { kind: 'money' }
  if (dataType === 'boolean') return { kind: 'boolean' }
  if (name.endsWith(TIME_SUFFIX)) return { kind: 'timestamp' }
  if (dataType === 'number') return { kind: 'numeric' }
  return { kind: 'passthrough' }
}

function convert(rule: ColumnRule, name: string, value: PgValue, centsKey: string): D1Value {
  if (value === null) return null
  switch (rule.kind) {
    case 'money':
      // A source column that already carries the `_cents` suffix is cents;
      // every other candidate (`x_eur`, `x`) is euros.
      if (centsKey.endsWith(CENTS_SUFFIX) && centsKey === name) {
        return Math.round(Number(value))
      }
      return typeof value === 'number' || typeof value === 'string'
        ? eurosToCents(value)
        : fail(name, value)
    case 'timestamp':
      return typeof value === 'string' || typeof value === 'number'
        ? toIsoUtc(value)
        : fail(name, value)
    case 'boolean':
      return typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string'
        ? boolToInt(value)
        : fail(name, value)
    case 'numeric': {
      if (typeof value === 'number') return value
      if (typeof value === 'string') {
        const parsed = Number(value)
        if (!Number.isNaN(parsed)) return parsed
      }
      return fail(name, value)
    }
    default:
      // jsonb arrives as a parsed object/array; TEXT stays TEXT. A stray
      // boolean on a non-boolean column still lands as a SQLite integer.
      if (typeof value === 'object') return toJsonText(value)
      if (typeof value === 'boolean') return boolToInt(value)
      return value
  }
}

function fail(name: string, value: PgValue): never {
  throw new Error(`Column "${name}" cannot take value ${JSON.stringify(value)}`)
}

export interface TransformResult {
  row: D1Row
  /** Source keys present in the input but absent from the D1 schema. */
  droppedSourceKeys: string[]
}

/** Transform one exported Postgres row into a D1-shaped row. */
export function transformRow(tableName: string, source: PgRow): TransformResult {
  const table = requireTable(tableName) as Table
  const columns = getTableColumns(table)
  const columnMeta = Object.values(columns).map(
    (column) =>
      column as unknown as {
        name: string
        dataType: string
        notNull: boolean
        hasDefault: boolean
      },
  )
  const row: D1Row = {}
  const missing: string[] = []
  for (const column of columnMeta) {
    const candidates = sourceCandidates(column.name)
    const found = candidates.find((key) => source[key] !== undefined)
    if (!found) {
      if (column.notNull && !column.hasDefault) missing.push(column.name)
      // Columns with a schema default are omitted entirely so the INSERT
      // lets D1 apply it; writing NULL would violate NOT NULL.
      else if (!column.notNull) row[column.name] = null
      continue
    }
    const rule = ruleFor(column as Column, column.name)
    row[column.name] = convert(rule, column.name, source[found] as PgValue, found)
  }
  if (missing.length > 0) {
    throw new Error(
      `Table "${tableName}": no source value for NOT NULL column(s): ${missing.join(', ')}`,
    )
  }
  const known = new Set(columnMeta.map((column) => column.name))
  const droppedSourceKeys = Object.keys(source).filter(
    (key) => !key.endsWith(EUR_SUFFIX) && !known.has(key) && !sourceCandidatesAny(known, key),
  )
  return { row, droppedSourceKeys }
}

function sourceCandidatesAny(known: ReadonlySet<string>, key: string): boolean {
  for (const target of known) {
    for (const candidate of sourceCandidates(target)) {
      if (candidate === key) return true
    }
  }
  return false
}

/** Transform NDJSON lines (one Postgres row per line) for one table. */
export function transformNdjson(tableName: string, lines: readonly string[]): D1Row[] {
  const rows: D1Row[] = []
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return
    try {
      rows.push(transformRow(tableName, JSON.parse(trimmed) as PgRow).row)
    } catch (error) {
      throw new Error(
        `Table "${tableName}" line ${index + 1}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  })
  return rows
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
  const inDir = resolve(process.cwd(), flag('--in', '.export/pg'))
  const outDir = resolve(process.cwd(), flag('--out', '.export/transformed'))
  const tablesFlag = flag('--tables', '')
  const wanted = tablesFlag
    ? tablesFlag.split(',').map((t) => t.trim()).filter(Boolean)
    : insertOrder()
  mkdirSync(outDir, { recursive: true })
  const available = new Set(readdirSync(inDir).map((name) => name.replace(/\.ndjson$/, '')))
  for (const table of wanted) {
    requireTable(table)
    if (!available.has(table)) continue
    const rows = transformNdjson(
      table,
      readFileSync(resolve(inDir, `${table}.ndjson`), 'utf8').split('\n'),
    )
    writeFileSync(
      resolve(outDir, `${table}.ndjson`),
      rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length > 0 ? '\n' : ''),
    )
    console.log(`${table}: ${rows.length} rows transformed`)
  }
}

if (isMain) {
  try {
    main()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

export { TABLES }
