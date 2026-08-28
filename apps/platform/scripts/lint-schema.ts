// Schema linter for the Drizzle SQLite schema in src/lib/data/schema.
// Guards two invariants from the Option B design:
//   1. money is stored as INTEGER `_cents` columns, never as REAL
//   2. enum-like TEXT columns carry a `CHECK (col IN (...))` constraint
// Usage: pnpm exec tsx scripts/lint-schema.ts [--list] [--self-test]
import { is, Table } from 'drizzle-orm'
import {
  check,
  getTableConfig,
  integer,
  real,
  sqliteTable,
  text,
  SQLiteSyncDialect,
  type SQLiteColumn,
  type SQLiteTable,
} from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

import * as schemaNs from '../src/lib/data/schema'

// Heuristic for "money-like" column names: case-insensitive substring match
// against these fragments, or a `_cents` suffix. Drizzle cannot see intent, so
// name shape is the enforceable proxy the team settled on. Extend the list when
// new money vocabulary enters the domain (e.g. `deposit`, `commission`).
const MONEY_NAME_FRAGMENTS = ['price', 'amount', 'fee', 'vat', 'bid', 'sum', 'eur'] as const

// Heuristic for "enum-like" TEXT columns: exact column-name matches. Derived
// from the schema source plus the standard set (status/role/type/state/
// visibility). A column with a Drizzle `enum: [...]` declaration is enum-like
// regardless of its name.
const ENUM_LIKE_NAMES = new Set(['status', 'role', 'type', 'state', 'visibility'])

// Curated-name columns that are intentionally free text (no TS union, no
// check). The allowlist only suppresses the name-based signal: if someone adds
// an `enum:` to one of these columns, the check requirement comes back. Keep
// this list short and justified.
const FREE_TEXT_ALLOWLIST = new Set(['specialists.role', 'testimonials.role'])

type RuleId = 'money-integer' | 'no-real-money' | 'enum-check'

type Violation = {
  rule: RuleId
  table: string
  column: string
  detail: string
}

const dialect = new SQLiteSyncDialect()

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function columnIsReal(col: SQLiteColumn): boolean {
  return col.getSQLType().toLowerCase().startsWith('real')
}

function isMoneyName(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.endsWith('_cents') || MONEY_NAME_FRAGMENTS.some((f) => lower.includes(f))
}

// A column is "covered" when a table-level check serializes to an IN-style
// membership test that references it. Range checks (>= 0) do not count: they
// constrain values, not the allowed set.
function coveredByInCheck(columnName: string, checkSqls: string[]): boolean {
  const pattern = new RegExp(`"${escapeRegExp(columnName)}"\\s+IN\\s*\\(`, 'i')
  return checkSqls.some((s) => pattern.test(s))
}

function lintTable(table: SQLiteTable): Violation[] {
  const { name, columns, checks } = getTableConfig(table)
  const checkSqls = checks.map((c) => dialect.sqlToQuery(c.value).sql)
  const violations: Violation[] = []

  for (const col of columns) {
    const colName = col.name

    if (colName.endsWith('_cents') && col.getSQLType() !== 'integer') {
      violations.push({
        rule: 'money-integer',
        table: name,
        column: colName,
        detail: `is ${col.getSQLType()}, must be integer (money is stored in cents)`,
      })
    }

    if (columnIsReal(col) && isMoneyName(colName)) {
      violations.push({
        rule: 'no-real-money',
        table: name,
        column: colName,
        detail: 'is REAL with a money-like name; use an INTEGER `_cents` column instead',
      })
    }

    if (col.getSQLType() === 'text') {
      const hasEnum = (col.enumValues?.length ?? 0) > 0
      const enumLike = hasEnum || ENUM_LIKE_NAMES.has(colName)
      const allowlisted = FREE_TEXT_ALLOWLIST.has(`${name}.${colName}`)
      const needsCheck = enumLike && (hasEnum || !allowlisted)
      if (needsCheck && !coveredByInCheck(colName, checkSqls)) {
        const why = hasEnum ? 'declares an enum union' : 'has an enum-like name'
        const hint = hasEnum
          ? `add check(name, sql\`... ${colName} IN (...)\`)`
          : 'add an enum + check, or list it in FREE_TEXT_ALLOWLIST if it is free text'
        violations.push({
          rule: 'enum-check',
          table: name,
          column: colName,
          detail: `${why} but no IN (...) check covers it; ${hint}`,
        })
      }
    }
  }

  return violations
}

type ScanResult = {
  violations: Violation[]
  tableCount: number
  columnCount: number
  checkCount: number
  enumLikeCount: number
  moneyCount: number
  realCount: number
}

function scanSchema(): ScanResult {
  const tables = Object.entries(schemaNs)
    .filter(([, value]) => is(value, Table))
    .map(([exportName, value]) => ({ exportName, table: value as SQLiteTable }))
    .sort((a, b) => getTableConfig(a.table).name.localeCompare(getTableConfig(b.table).name))

  const result: ScanResult = {
    violations: [],
    tableCount: tables.length,
    columnCount: 0,
    checkCount: 0,
    enumLikeCount: 0,
    moneyCount: 0,
    realCount: 0,
  }

  for (const { table } of tables) {
    const { columns, checks } = getTableConfig(table)
    result.columnCount += columns.length
    result.checkCount += checks.length
    result.realCount += columns.filter(columnIsReal).length
    result.moneyCount += columns.filter((c) => c.name.endsWith('_cents')).length
    result.enumLikeCount += columns.filter(
      (c) => c.getSQLType() === 'text' && ((c.enumValues?.length ?? 0) > 0 || ENUM_LIKE_NAMES.has(c.name)),
    ).length
    result.violations.push(...lintTable(table))
  }

  return result
}

function printScan(result: ScanResult): number {
  for (const v of result.violations) {
    console.error(`[${v.rule}] ${v.table}.${v.column}: ${v.detail}`)
  }
  if (result.violations.length > 0) {
    console.error(
      `Schema lint failed: ${result.violations.length} violation(s) in ${result.tableCount} table(s) scanned.`,
    )
    return 1
  }
  console.log(
    `Schema lint passed: ${result.tableCount} tables, ${result.columnCount} columns, ` +
      `${result.checkCount} table checks verified (${result.enumLikeCount} enum-like TEXT, ` +
      `${result.moneyCount} _cents, ${result.realCount} REAL).`,
  )
  return 0
}

function printRules(): number {
  console.log('Schema lint rules:')
  console.log('  money-integer  every *_cents column must be INTEGER')
  console.log('  no-real-money  no REAL column with a money-like name (fragments or _cents suffix)')
  console.log('  enum-check     enum-like TEXT columns need a CHECK (col IN (...)) constraint')
  console.log(`\nMoney name fragments: ${[...MONEY_NAME_FRAGMENTS].join(', ')}, _cents suffix`)
  console.log(`Enum-like names (exact): ${[...ENUM_LIKE_NAMES].sort().join(', ')}`)
  console.log(`Free-text allowlist: ${[...FREE_TEXT_ALLOWLIST].sort().join(', ') || '(empty)'}`)
  console.log('\nTo extend: add fragments/names to the sets above and a fixture in selfTest().')
  return 0
}

function selfTest(): number {
  const enumValues = ['a', 'b'] as const
  const fixtures: { name: string; expect: number; table: SQLiteTable }[] = [
    {
      name: 'integer cents passes',
      expect: 0,
      table: sqliteTable('f1', { priceCents: integer('price_cents') }),
    },
    {
      name: 'real price fails',
      expect: 1,
      table: sqliteTable('f2', { totalPrice: real('total_price') }),
    },
    {
      name: 'text cents fails',
      expect: 1,
      table: sqliteTable('f3', { priceCents: text('price_cents') }),
    },
    {
      name: 'real area passes (not money)',
      expect: 0,
      table: sqliteTable('f4', { area: real('area') }),
    },
    {
      name: 'enum with IN check passes',
      expect: 0,
      table: sqliteTable('f5', { status: text('status', { enum: enumValues }).notNull() }, (t) => [
        check('f5_status_check', sql`${t.status} IN ${sql.raw("('a', 'b')")}`),
      ]),
    },
    {
      name: 'enum without check fails',
      expect: 1,
      table: sqliteTable('f6', { status: text('status', { enum: enumValues }) }),
    },
    {
      name: 'range check does not cover enum',
      expect: 1,
      table: sqliteTable('f7', { status: text('status', { enum: enumValues }).notNull() }, (t) => [
        check('f7_len_check', sql`length(${t.status}) > 0`),
      ]),
    },
    {
      name: 'enum-like name without enum fails',
      expect: 1,
      table: sqliteTable('f8', { visibility: text('visibility') }),
    },
    {
      name: 'allowlisted free-text role passes',
      expect: 0,
      table: sqliteTable('specialists', { role: text('role') }),
    },
    {
      name: 'allowlisted role with enum still needs check',
      expect: 1,
      table: sqliteTable('testimonials', { role: text('role', { enum: enumValues }) }),
    },
  ]

  let failures = 0
  for (const f of fixtures) {
    const found = lintTable(f.table)
    const ok = found.length === f.expect
    if (!ok) {
      failures++
      console.error(`self-test FAILED: ${f.name} (expected ${f.expect}, got ${found.length})`)
      for (const v of found) console.error(`  [${v.rule}] ${v.table}.${v.column}: ${v.detail}`)
    } else {
      console.log(`self-test ok: ${f.name}`)
    }
  }
  if (failures > 0) {
    console.error(`${failures} self-test fixture(s) failed.`)
    return 2
  }
  console.log(`Self-test passed: ${fixtures.length} fixtures.`)
  return 0
}

function main(): number {
  const flags = new Set(process.argv.slice(2))
  if (flags.has('--list')) return printRules()
  if (flags.has('--self-test')) return selfTest()
  return printScan(scanSchema())
}

process.exit(main())
