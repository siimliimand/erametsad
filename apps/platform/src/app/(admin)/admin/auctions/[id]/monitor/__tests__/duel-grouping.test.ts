import { describe, expect, it } from 'vitest'

import { groupAutobidderBursts, type MonitorBidRow } from '../bid-monitor'

// The feed is newest-first, so offsets count backwards from the base time.
const baseMs = Date.parse('2026-09-08T10:00:00.000Z')
const burstGapMs = 30_000

function feedRow(offsetMs: number, overrides: Partial<MonitorBidRow> = {}): MonitorBidRow {
  return {
    key: `bid-${String(offsetMs)}`,
    bidId: `bid-${String(offsetMs)}`,
    amountEur: 500,
    placedAt: new Date(baseMs - offsetMs).toISOString(),
    source: 'autobidder',
    status: 'leading',
    backfilled: false,
    bidderId: 'bidder-1',
    bidderAlias: 7,
    bidderAccountCreatedAt: '2020-01-01T00:00:00.000Z',
    ipHash: null,
    ...overrides,
  }
}

describe('groupAutobidderBursts (autobidder duel collapse)', () => {
  it('collapses a rapid autobid run into one burst entry keyed by the newest row', () => {
    const entries = groupAutobidderBursts([
      feedRow(0),
      feedRow(5_000),
      feedRow(10_000),
      feedRow(15_000),
    ])

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    if (entry === undefined) throw new Error('expected one feed entry')
    if (entry.kind !== 'burst') throw new Error('expected a burst entry')
    expect(entry.key).toBe('burst-bid-0')
    expect(entry.rows.map((row) => row.key)).toEqual([
      'bid-0',
      'bid-5000',
      'bid-10000',
      'bid-15000',
    ])
  })

  it('keeps a run below the minimum step count as plain rows', () => {
    const entries = groupAutobidderBursts([feedRow(0), feedRow(5_000)])

    expect(entries.map((entry) => entry.kind)).toEqual(['row', 'row'])
  })

  it('starts a new run after a gap beyond the burst window', () => {
    const entries = groupAutobidderBursts([
      feedRow(0),
      feedRow(10_000),
      feedRow(80_000),
      feedRow(90_000),
      feedRow(100_000),
    ])

    // The two-row head stays plain; the three-row tail collapses.
    expect(entries.map((entry) => entry.kind)).toEqual(['row', 'row', 'burst'])
    const tail = entries[2]
    if (tail?.kind !== 'burst') throw new Error('expected a burst entry')
    expect(tail.key).toBe('burst-bid-80000')
    expect(tail.rows.map((row) => row.key)).toEqual(['bid-80000', 'bid-90000', 'bid-100000'])
  })

  it('keeps manual bids out of the autobid run', () => {
    const entries = groupAutobidderBursts([
      feedRow(0),
      feedRow(10_000),
      feedRow(20_000, { source: 'manual', bidderId: 'bidder-2', bidderAlias: 4 }),
      feedRow(30_000),
      feedRow(40_000),
      feedRow(50_000),
    ])

    expect(entries.map((entry) => entry.kind)).toEqual(['row', 'row', 'row', 'burst'])
    const burst = entries[3]
    if (burst?.kind !== 'burst') throw new Error('expected a burst entry')
    expect(burst.rows.map((row) => row.key)).toEqual(['bid-30000', 'bid-40000', 'bid-50000'])
  })

  it('keeps gaps exactly at the burst window edge in one run', () => {
    const entries = groupAutobidderBursts([
      feedRow(0),
      feedRow(burstGapMs),
      feedRow(2 * burstGapMs),
    ])

    expect(entries).toHaveLength(1)
    const entry = entries[0]
    if (entry?.kind !== 'burst') throw new Error('expected a burst entry')
    expect(entry.rows).toHaveLength(3)
  })

  it('splits the run when a consecutive gap exceeds the burst window', () => {
    const entries = groupAutobidderBursts([
      feedRow(0),
      feedRow(burstGapMs),
      feedRow(2 * burstGapMs + 1),
    ])

    expect(entries.map((entry) => entry.kind)).toEqual(['row', 'row', 'row'])
  })

  it('returns no entries for an empty feed', () => {
    expect(groupAutobidderBursts([])).toEqual([])
  })
})
