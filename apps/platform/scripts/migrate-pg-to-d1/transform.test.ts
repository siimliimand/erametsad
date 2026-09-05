import { readFileSync, readdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  boolToInt,
  eurosToCents,
  sourceCandidates,
  toJsonText,
  toIsoUtc,
  transformNdjson,
  transformRow,
} from './transform'
import { deleteOrder, insertOrder, requireTable, tableNames } from './tables'

describe('eurosToCents', () => {
  it('converts plain euro amounts', () => {
    expect(eurosToCents(12.34)).toBe(1234)
    expect(eurosToCents(0)).toBe(0)
  })

  it('converts Postgres numeric strings', () => {
    expect(eurosToCents('1499.99')).toBe(149999)
    expect(eurosToCents('1834000.00')).toBe(183400000)
  })

  it('rounds half-up with a float-epsilon guard', () => {
    // 10.005 * 100 is 1000.4999999999999 in IEEE 754; must still round to 1001
    expect(eurosToCents(10.005)).toBe(1001)
    expect(eurosToCents('8100.005')).toBe(810001)
  })

  it('rejects non-finite input', () => {
    expect(() => eurosToCents('abc')).toThrow()
    expect(() => eurosToCents(Number.NaN)).toThrow()
  })
})

describe('toIsoUtc', () => {
  it('normalizes offsets to UTC', () => {
    expect(toIsoUtc('2026-05-01T09:00:00+03:00')).toBe('2026-05-01T06:00:00.000Z')
    expect(toIsoUtc('2026-05-15T13:00:00-05:00')).toBe('2026-05-15T18:00:00.000Z')
  })

  it('keeps UTC and millisecond precision', () => {
    expect(toIsoUtc('2026-05-10T08:00:00Z')).toBe('2026-05-10T08:00:00.000Z')
    expect(toIsoUtc('2026-05-10T11:00:00.123+03:00')).toBe('2026-05-10T08:00:00.123Z')
  })

  it('parses Postgres text output', () => {
    expect(toIsoUtc('2026-06-14 17:00:03+03')).toBe('2026-06-14T14:00:03.000Z')
    expect(toIsoUtc('2026-06-14 17:00:03 +0300')).toBe('2026-06-14T14:00:03.000Z')
  })

  it('accepts Date objects and epoch numbers', () => {
    expect(toIsoUtc(new Date('2026-05-10T08:00:00Z'))).toBe('2026-05-10T08:00:00.000Z')
    expect(toIsoUtc(Date.UTC(2026, 4, 10, 8))).toBe('2026-05-10T08:00:00.000Z')
  })

  it('throws on unparseable input', () => {
    expect(() => toIsoUtc('not a date')).toThrow()
  })
})

describe('toJsonText / boolToInt', () => {
  it('stringifies jsonb objects and arrays', () => {
    expect(toJsonText({ a: 1 })).toBe('{"a":1}')
    expect(toJsonText([1, 2])).toBe('[1,2]')
    expect(toJsonText([])).toBe('[]')
  })

  it('maps booleans to SQLite integers', () => {
    expect(boolToInt(true)).toBe(1)
    expect(boolToInt(1)).toBe(1)
    expect(boolToInt('true')).toBe(1)
    expect(boolToInt(false)).toBe(0)
    expect(boolToInt(0)).toBe(0)
  })
})

describe('sourceCandidates', () => {
  it('prefers an already-cents column, then _eur, then the bare name', () => {
    expect(sourceCandidates('amount_cents')).toEqual(['amount_cents', 'amount_eur', 'amount'])
    expect(sourceCandidates('eur_cents')).toEqual(['eur_cents', 'eur_eur', 'eur'])
  })

  it('leaves non-money columns alone', () => {
    expect(sourceCandidates('email')).toEqual(['email'])
  })
})

describe('transformRow', () => {
  it('maps euros to cents per column suffix', () => {
    const { row } = transformRow('auctions', {
      title: 'T',
      slug: 't',
      object_type: 'raieoigus',
      min_bid: '5000.00',
      bid_step_eur: '50.50',
      reserve_price_cents: 555050,
      created_at: '2026-04-20T10:00:00+03:00',
      updated_at: '2026-04-20T10:00:00+03:00',
    })
    expect(row.min_bid_cents).toBe(500000)
    expect(row.bid_step_cents).toBe(5050)
    // An explicit *_cents source column wins over the euro candidates.
    expect(row.reserve_price_cents).toBe(555050)
  })

  it('keeps ids and enum values unchanged', () => {
    const { row } = transformRow('bids', {
      id: 'b-1',
      auction_id: 'a-1',
      user_id: 'u-1',
      amount: '100.00',
      type: 'open',
      source: 'manual',
      status: 'leading',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    })
    expect(row.id).toBe('b-1')
    expect(row.auction_id).toBe('a-1')
    expect(row.type).toBe('open')
    expect(row.amount_cents).toBe(10000)
  })

  it('stringifies jsonb and converts booleans and timestamps', () => {
    const { row } = transformRow('auctions', {
      title: 'T',
      slug: 't',
      object_type: 'raieoigus',
      min_bid: '1.00',
      is_quick_auction: true,
      vat_included: false,
      cadastres: ['001:001:001'],
      registry_numbers: { register: 'MR-1' },
      ends_at: '2026-05-15T13:00:00+03:00',
      created_at: '2026-04-20T10:00:00Z',
      updated_at: '2026-04-20T10:00:00Z',
    })
    expect(row.cadastres).toBe('["001:001:001"]')
    expect(row.registry_numbers).toBe('{"register":"MR-1"}')
    expect(row.is_quick_auction).toBe(1)
    expect(row.vat_included).toBe(0)
    expect(row.ends_at).toBe('2026-05-15T10:00:00.000Z')
  })

  it('handles null, empty arrays, and numeric strings', () => {
    const { row } = transformRow('statistics_snapshots', {
      id: 's-1',
      date: '2026-06-30',
      object_type: 'raieoigus',
      count: '14',
      area: '120.75',
      volume: null,
      eur: '27500.55',
      created_at: '2026-06-30T23:59:59+03:00',
      updated_at: '2026-06-30T23:59:59+03:00',
    })
    expect(row.count).toBe(14)
    expect(row.area).toBe(120.75)
    expect(row.volume).toBeNull()
    expect(row.eur_cents).toBe(2750055)
  })

  it('fills nullable gaps with null and reports unknown source keys', () => {
    const { row, droppedSourceKeys } = transformRow('users', {
      id: 'u-1',
      email: 'a@b.ee',
      created_at: '2026-01-05 08:00:00+02:00',
      updated_at: '2026-01-05 08:00:00+02:00',
      payload_version: 3,
    })
    expect(row.name).toBeNull()
    expect(row.isikukood_hash).toBeNull()
    expect(row.created_at).toBe('2026-01-05T06:00:00.000Z')
    expect(droppedSourceKeys).toEqual(['payload_version'])
  })

  it('throws when a NOT NULL column has no source', () => {
    expect(() => transformRow('users', { id: 'u-1', email: 'a@b.ee' })).toThrow(
      /NOT NULL column\(s\): created_at/,
    )
  })

  it('rejects unknown tables', () => {
    expect(() => transformRow('nope', {})).toThrow(/Unknown table "nope"/)
  })
})

describe('transformNdjson', () => {
  it('skips blank lines and wraps errors with table and line context', () => {
    const good = JSON.stringify({
      id: 'u-1',
      email: 'a@b.ee',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }) as string
    const rows = transformNdjson('users', ['', good, ''])
    expect(rows).toHaveLength(1)
    expect(() => transformNdjson('users', ['', '{"id": "u-2"}'])).toThrow(
      /users.*line 2.*created_at/s,
    )
  })
})

describe('table graph', () => {
  it('covers all 35 D1 tables (33 + service_requests + partners)', () => {
    expect(tableNames()).toHaveLength(35)
    expect(tableNames()).toContain('sessions')
    expect(tableNames()).toContain('rights_requests')
    expect(tableNames()).toContain('password_reset_tokens')
    expect(tableNames()).toContain('consent_log')
    expect(tableNames()).toContain('newsletter_subscribers')
    expect(tableNames()).toContain('analytics_events')
    expect(tableNames()).toContain('service_requests')
    expect(tableNames()).toContain('partners')
  })

  it('inserts FK parents before children', () => {
    const order = insertOrder()
    const before = (parent: string, child: string): void =>
      expect(order.indexOf(parent)).toBeLessThan(order.indexOf(child))
    before('users', 'sessions')
    before('users', 'profiles')
    before('users', 'auctions')
    before('users', 'rights_requests')
    before('auctions', 'bids')
    before('users', 'bids')
    before('auctions', 'autobidders')
    before('counties', 'parishes')
    before('media', 'articles')
    before('media', 'specialists')
    before('faq_categories', 'faq_items')
    before('contract_templates', 'contracts')
    before('auctions', 'contracts')
  })

  it('deletes in reverse insert order', () => {
    expect(deleteOrder()).toEqual([...insertOrder()].reverse())
  })

  it('requireTable throws for unknown names', () => {
    expect(() => requireTable('does_not_exist')).toThrow(/Unknown table/)
  })
})

describe('fixtures', () => {
  it('transforms every fixture line without throwing', () => {
    const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures')
    for (const file of readdirSync(fixtureDir).filter((name) => name.endsWith('.ndjson')).sort()) {
      const table = file.replace(/\.ndjson$/, '')
      const lines = readFileSync(resolve(fixtureDir, file), 'utf8').split('\n')
      const rows = transformNdjson(table, lines)
      expect(rows.length, `${table} fixture row count`).toBeGreaterThan(0)
    }
  })

  it('spot-checks the money, timestamp, and jsonb rules on fixture auctions', () => {
    const lines = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/auctions.ndjson'),
      'utf8',
    ).split('\n')
    const rows = transformNdjson('auctions', lines)
    expect(rows).toHaveLength(2)
    const [euroSourced, centsSourced] = rows
    if (!euroSourced || !centsSourced) throw new Error('auctions fixture must have 2 rows')
    expect(euroSourced.min_bid_cents).toBe(500000)
    expect(euroSourced.cadastres).toBe('["001:001:001","001:001:002"]')
    expect(euroSourced.starts_at).toBe('2026-05-01T06:00:00.000Z')
    expect(centsSourced.min_bid_cents).toBe(750000)
    expect(centsSourced.ended_at).toBe('2026-06-14T14:00:03.000Z')
    expect(centsSourced.cadastres).toBe('[]')
  })
})
