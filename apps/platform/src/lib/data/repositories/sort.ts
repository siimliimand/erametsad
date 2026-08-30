import { asc, desc } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'

import { InvalidSortError } from './errors'
import { resolveColumn, type ColumnMap, type FieldAliases } from './where'

export type SortDirection = 'asc' | 'desc'
export type SortField = string

export interface ParsedSort {
  field: string
  direction: SortDirection
}

export function parseSort(sort: SortField): ParsedSort {
  if (sort.startsWith('-')) {
    const field = sort.slice(1)
    if (!field) {
      throw new InvalidSortError(sort)
    }
    return { field, direction: 'desc' }
  }
  if (!sort) {
    throw new InvalidSortError(sort)
  }
  return { field: sort, direction: 'asc' }
}

export function sortExpression(
  columns: ColumnMap,
  aliases: FieldAliases,
  sort: SortField,
): SQL {
  const { field, direction } = parseSort(sort)
  const column = resolveColumn(columns, aliases, field)
  return direction === 'desc' ? desc(column) : asc(column)
}
