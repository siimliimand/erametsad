import { getTableColumns } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import { auctionRights, auctions, bids, users } from '../../schema'
import { UnknownFieldError, UnknownOperatorError } from '../errors'
import { translateWhere } from '../where'

const dialect = new SQLiteSyncDialect()

function toSql(collection: 'users' | 'bids' | 'auctions' | 'auctionRights', where: Parameters<typeof translateWhere>[1], aliases?: Parameters<typeof translateWhere>[2]) {
  const columns = getTableColumns(
    collection === 'users' ? users : collection === 'bids' ? bids : collection === 'auctions' ? auctions : auctionRights,
  )
  const condition = translateWhere(columns, where, aliases)
  return condition ? dialect.sqlToQuery(condition) : undefined
}

describe('translateWhere', () => {
  it('translates equals', () => {
    const query = toSql('users', { email: { equals: 'a@b.ee' } })
    expect(query?.sql).toContain('"users"."email" = ?')
    expect(query?.params).toEqual(['a@b.ee'])
  })

  it('translates not_equals', () => {
    const query = toSql('bids', { status: { not_equals: 'rejected' } })
    expect(query?.sql).toContain('"bids"."status" <> ?')
    expect(query?.params).toEqual(['rejected'])
  })

  it('translates exists false as IS NULL', () => {
    const query = toSql('auctionRights', { revokedAt: { exists: false } })
    expect(query?.sql).toContain('"auction_rights"."revoked_at" is null')
    expect(query?.params).toEqual([])
  })

  it('translates exists true as IS NOT NULL', () => {
    const query = toSql('auctionRights', { revokedAt: { exists: true } })
    expect(query?.sql).toContain('"auction_rights"."revoked_at" is not null')
  })

  it('translates in', () => {
    const query = toSql('bids', { status: { in: ['leading', 'won'] } })
    expect(query?.sql).toContain('"bids"."status" in (?, ?)')
    expect(query?.params).toEqual(['leading', 'won'])
  })

  it('translates an empty in to a false literal', () => {
    const query = toSql('bids', { status: { in: [] } })
    expect(query?.sql).toContain('false')
    expect(query?.params).toEqual([])
  })

  it('translates less_than_equal', () => {
    const now = '2026-08-28T12:00:00.000Z'
    const query = toSql('auctions', { endsAt: { less_than_equal: now } })
    expect(query?.sql).toContain('"auctions"."ends_at" <= ?')
    expect(query?.params).toEqual([now])
  })

  it('ANDs members of an and clause', () => {
    const query = toSql('auctions', {
      and: [{ status: { equals: 'active' } }, { endsAt: { less_than_equal: '2026-01-01T00:00:00.000Z' } }],
    })
    expect(query?.sql).toContain('"auctions"."status" = ?')
    expect(query?.sql).toContain('and')
    expect(query?.sql).toContain('"auctions"."ends_at" <= ?')
    expect(query?.params).toEqual(['active', '2026-01-01T00:00:00.000Z'])
  })

  it('ORs members of an or clause', () => {
    const query = toSql('auctions', {
      or: [{ specialistId: { equals: 's1' } }, { status: { equals: 'active' } }],
    })
    expect(query?.sql).toContain('or')
    expect(query?.params).toEqual(['s1', 'active'])
  })

  it('ANDs multiple keys in a plain object', () => {
    const query = toSql('bids', {
      auctionId: { equals: 'a1' },
      status: { equals: 'leading' },
    })
    expect(query?.sql).toContain('"bids"."auction_id" = ?')
    expect(query?.sql).toContain('and')
    expect(query?.params).toEqual(['a1', 'leading'])
  })

  it('supports nested and/or combinations', () => {
    const query = toSql('bids', {
      and: [
        { auctionId: { equals: 'a1' } },
        { userId: { equals: 'u1' } },
        { type: { equals: 'sealed' } },
        { status: { not_equals: 'rejected' } },
      ],
    })
    expect(query?.params).toEqual(['a1', 'u1', 'sealed', 'rejected'])
  })

  it('resolves relation aliases through the alias map', () => {
    const columns = getTableColumns(bids)
    const query = translateWhere(columns, { auction: { equals: 'a1' } }, { auction: 'auctionId' })
    expect(query && dialect.sqlToQuery(query).sql).toContain('"bids"."auction_id" = ?')
  })

  it('translates equals on integer-boolean columns', () => {
    const query = toSql('auctions', { vatIncluded: { equals: true } })
    expect(query?.sql).toContain('"auctions"."vat_included" = ?')
  })

  it('returns undefined without a where clause', () => {
    expect(toSql('users', undefined)).toBeUndefined()
    expect(toSql('users', {})).toBeUndefined()
  })

  it('throws on an unknown field', () => {
    expect(() => toSql('users', { nope: { equals: 'x' } })).toThrow(UnknownFieldError)
  })

  it('throws on an unsupported operator', () => {
    expect(() => toSql('users', { email: { greater_than: 1 } as never })).toThrow(UnknownOperatorError)
  })

  it('throws on a non-object operator value', () => {
    expect(() => toSql('users', { email: undefined as never })).toThrow(UnknownOperatorError)
  })
})
