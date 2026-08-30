import { and, eq, inArray, isNotNull, isNull, lte, ne, or, sql } from 'drizzle-orm'
import type { Column, SQL } from 'drizzle-orm'

import { UnknownFieldError, UnknownOperatorError } from './errors'

export type WhereValue = string | number | boolean

export interface WhereEquals {
  equals: WhereValue
}

export interface WhereNotEquals {
  not_equals: WhereValue
}

export interface WhereExists {
  exists: boolean
}

export interface WhereIn {
  in: readonly WhereValue[]
}

export interface WhereLessThanEqual {
  less_than_equal: string | number
}

export type WhereField =
  | WhereEquals
  | WhereNotEquals
  | WhereExists
  | WhereIn
  | WhereLessThanEqual

export interface WhereAnd {
  and: readonly WhereClause[]
}

export interface WhereOr {
  or: readonly WhereClause[]
}

export type WhereClause = Partial<Record<string, WhereField>> | WhereAnd | WhereOr

export type ColumnMap = Record<string, Column>
export type FieldAliases = Readonly<Record<string, string>>

export function resolveColumn(columns: ColumnMap, aliases: FieldAliases, field: string): Column {
  const column = columns[aliases[field] ?? field]
  if (!column) {
    throw new UnknownFieldError('where clause', field)
  }
  return column
}

function translateField(
  columns: ColumnMap,
  aliases: FieldAliases,
  field: string,
  condition: WhereField | undefined,
): SQL {
  const column = resolveColumn(columns, aliases, field)
  if (!condition || typeof condition !== 'object') {
    throw new UnknownOperatorError(field, String(condition))
  }
  if ('equals' in condition) {
    return eq(column, condition.equals)
  }
  if ('not_equals' in condition) {
    return ne(column, condition.not_equals)
  }
  if ('exists' in condition) {
    return condition.exists ? isNotNull(column) : isNull(column)
  }
  if ('in' in condition) {
    if (condition.in.length === 0) {
      return sql`false`
    }
    return inArray(column, [...condition.in])
  }
  if ('less_than_equal' in condition) {
    return lte(column, condition.less_than_equal)
  }
  throw new UnknownOperatorError(field, Object.keys(condition).join(', '))
}

function joinWith(
  combine: (parts: SQL[]) => SQL | undefined,
  parts: readonly (SQL | undefined)[],
): SQL | undefined {
  const defined = parts.filter((part): part is SQL => part !== undefined)
  if (defined.length === 0) {
    return undefined
  }
  if (defined.length === 1) {
    return defined[0]
  }
  return combine(defined)
}

function isWhereAnd(where: WhereClause): where is WhereAnd {
  return Array.isArray((where as WhereAnd).and)
}

function isWhereOr(where: WhereClause): where is WhereOr {
  return Array.isArray((where as WhereOr).or)
}

export function translateWhere(
  columns: ColumnMap,
  where: WhereClause | undefined,
  aliases: FieldAliases = {},
): SQL | undefined {
  if (!where) {
    return undefined
  }
  if (isWhereAnd(where)) {
    return joinWith((parts) => and(...parts), where.and.map((clause) => translateWhere(columns, clause, aliases)))
  }
  if (isWhereOr(where)) {
    return joinWith((parts) => or(...parts), where.or.map((clause) => translateWhere(columns, clause, aliases)))
  }
  return joinWith(
    (parts) => and(...parts),
    Object.entries(where).map(([field, condition]) => translateField(columns, aliases, field, condition)),
  )
}
