import { getTableName, is, Table } from 'drizzle-orm'
import { getTableConfig } from 'drizzle-orm/sqlite-core'

import * as schemaNs from '../../src/lib/data/schema'

// Single source of truth for the migration pipeline: which tables exist in
// the D1 schema and in which order rows must be inserted (FK parents first)
// and deleted (children first). Derived from the live Drizzle schema, so a
// new table joins the pipeline the moment it joins the schema.
export const TABLES: ReadonlyMap<string, Table> = (() => {
  const map = new Map<string, Table>()
  for (const value of Object.values(schemaNs)) {
    if (is(value, Table)) map.set(getTableName(value), value)
  }
  return map
})()

export function requireTable(name: string): Table {
  const table = TABLES.get(name)
  if (!table) {
    throw new Error(
      `Unknown table "${name}". Known tables: ${[...TABLES.keys()].sort().join(', ')}`,
    )
  }
  return table
}

export function tableNames(): string[] {
  return [...TABLES.keys()].sort()
}

/** FK dependencies of a table: names of tables it references via D1 FKs. */
export function dependenciesOf(name: string): string[] {
  const table = requireTable(name)
  const deps = new Set<string>()
  for (const fk of getTableConfig(table as never).foreignKeys) {
    const reference =
      typeof fk.reference === 'function' ? fk.reference() : (fk.reference as unknown)
    const foreignTable = (reference as { foreignTable?: Table }).foreignTable
    const foreignName = foreignTable ? getTableName(foreignTable) : undefined
    if (foreignName && foreignName !== name) deps.add(foreignName)
  }
  return [...deps]
}

/**
 * Topological insert order over the FK graph. Deterministic: siblings are
 * sorted alphabetically, so the output only changes when the graph does.
 */
export function insertOrder(): string[] {
  const sorted: string[] = []
  const state = new Map<string, 'visiting' | 'done'>()
  const visit = (name: string, trail: readonly string[]): void => {
    if (state.get(name) === 'done') return
    if (state.get(name) === 'visiting') {
      throw new Error(`Foreign-key cycle in schema: ${[...trail, name].join(' -> ')}`)
    }
    state.set(name, 'visiting')
    for (const dep of dependenciesOf(name).sort()) visit(dep, [...trail, name])
    state.set(name, 'done')
    sorted.push(name)
  }
  for (const name of tableNames()) visit(name, [])
  return sorted
}

/** Reverse of insertOrder(): children first, so DELETE never trips an FK. */
export function deleteOrder(): string[] {
  return [...insertOrder()].reverse()
}
