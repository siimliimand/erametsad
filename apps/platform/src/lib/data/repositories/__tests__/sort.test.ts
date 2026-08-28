import { getTableColumns } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import { autobidders } from '../../schema'
import { InvalidSortError, UnknownFieldError } from '../errors'
import { parseSort, sortExpression } from '../sort'

const dialect = new SQLiteSyncDialect()

describe('parseSort', () => {
  it('parses a bare field as ascending', () => {
    expect(parseSort('createdAt')).toEqual({ field: 'createdAt', direction: 'asc' })
  })

  it('parses a leading dash as descending', () => {
    expect(parseSort('-createdAt')).toEqual({ field: 'createdAt', direction: 'desc' })
  })

  it('parses multi-word fields', () => {
    expect(parseSort('-endsAt')).toEqual({ field: 'endsAt', direction: 'desc' })
  })

  it('rejects an empty sort', () => {
    expect(() => parseSort('')).toThrow(InvalidSortError)
  })

  it('rejects a lone dash', () => {
    expect(() => parseSort('-')).toThrow(InvalidSortError)
  })
})

describe('sortExpression', () => {
  const columns = getTableColumns(autobidders)

  it('builds an ascending expression for a bare field', () => {
    const query = dialect.sqlToQuery(sortExpression(columns, {}, 'createdAt'))
    expect(query.sql).toContain('"autobidders"."created_at" asc')
  })

  it('builds a descending expression for a leading dash', () => {
    const query = dialect.sqlToQuery(sortExpression(columns, {}, '-createdAt'))
    expect(query.sql).toContain('"autobidders"."created_at" desc')
  })

  it('resolves aliases', () => {
    const query = dialect.sqlToQuery(sortExpression(columns, { auction: 'auctionId' }, 'auction'))
    expect(query.sql).toContain('"autobidders"."auction_id" asc')
  })

  it('throws on an unknown field', () => {
    expect(() => sortExpression(columns, {}, '-nope')).toThrow(UnknownFieldError)
  })
})
