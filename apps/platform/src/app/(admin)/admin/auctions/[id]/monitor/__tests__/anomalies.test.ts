import { describe, expect, it } from 'vitest'

import {
  detectAnomalies,
  detectNewAccountBursts,
  detectRapidOvertakes,
  NEW_ACCOUNT_BURST_MIN_BIDS,
  NEW_ACCOUNT_BURST_WINDOW_MS,
  NEW_ACCOUNT_MAX_AGE_MS,
  RAPID_OVERTAKE_MIN_FLIPS,
  RAPID_OVERTAKE_WINDOW_MS,
  type AnomalyFeedRow,
} from '../_lib/anomalies'

type Detected = ReturnType<typeof detectAnomalies>[number]

const minuteMs = 60_000
const dayMs = 24 * 60 * minuteMs
const nowMs = Date.parse('2026-09-08T12:00:00.000Z')
const youngAccountCreatedAt = new Date(nowMs - 2 * dayMs).toISOString()
const oldAccountCreatedAt = '2020-01-01T00:00:00.000Z'

function feedRow(placedAtMs: number, overrides: Partial<AnomalyFeedRow> = {}): AnomalyFeedRow {
  return {
    key: `bid-${String(placedAtMs)}`,
    bidId: `bid-${String(placedAtMs)}`,
    bidderId: 'bidder-young',
    bidderAlias: 9,
    bidderAccountCreatedAt: youngAccountCreatedAt,
    placedAt: new Date(placedAtMs).toISOString(),
    source: 'autobidder',
    status: 'outbid',
    ...overrides,
  }
}

function leadRow(
  placedAtMs: number,
  bidderId: string,
  bidderAlias: number,
  overrides: Partial<AnomalyFeedRow> = {},
): AnomalyFeedRow {
  return feedRow(placedAtMs, {
    bidderId,
    bidderAlias,
    bidderAccountCreatedAt: oldAccountCreatedAt,
    source: 'manual',
    status: 'leading',
    ...overrides,
  })
}

function firstOf(results: readonly Detected[]): Detected {
  const first = results[0]
  if (first === undefined) throw new Error('expected one anomaly')
  return first
}

describe('anomaly threshold constants', () => {
  it('keeps the documented heuristic thresholds', () => {
    expect(NEW_ACCOUNT_MAX_AGE_MS).toBe(7 * dayMs)
    expect(NEW_ACCOUNT_BURST_WINDOW_MS).toBe(30 * minuteMs)
    expect(NEW_ACCOUNT_BURST_MIN_BIDS).toBe(4)
    expect(RAPID_OVERTAKE_WINDOW_MS).toBe(5 * minuteMs)
    expect(RAPID_OVERTAKE_MIN_FLIPS).toBe(3)
  })
})

describe('detectNewAccountBursts (new-account burst)', () => {
  it('flags four bids inside one window from a two-day-old account', () => {
    const rows = [
      feedRow(nowMs - 10 * minuteMs),
      feedRow(nowMs - 12 * minuteMs),
      feedRow(nowMs - 14 * minuteMs),
      feedRow(nowMs - 16 * minuteMs),
    ]

    expect(detectNewAccountBursts(rows, nowMs)).toEqual([
      {
        kind: 'new-account-burst',
        bidderId: 'bidder-young',
        bidderAlias: 9,
        bidCount: 4,
        accountAgeDays: 2,
      },
    ])
  })

  it('stays silent at the minimum-bid threshold', () => {
    const rows = [
      feedRow(nowMs - 10 * minuteMs),
      feedRow(nowMs - 12 * minuteMs),
      feedRow(nowMs - 14 * minuteMs),
    ]

    expect(detectNewAccountBursts(rows, nowMs)).toEqual([])
  })

  it('ignores accounts at the age limit but flags one millisecond younger', () => {
    const atLimit = feedRow(nowMs - 10 * minuteMs, {
      bidderAccountCreatedAt: new Date(nowMs - NEW_ACCOUNT_MAX_AGE_MS).toISOString(),
    })
    expect(detectNewAccountBursts([atLimit], nowMs)).toEqual([])

    const underLimitCreatedAt = new Date(nowMs - NEW_ACCOUNT_MAX_AGE_MS + 1).toISOString()
    const underLimit = [
      feedRow(nowMs - 10 * minuteMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
      feedRow(nowMs - 12 * minuteMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
      feedRow(nowMs - 14 * minuteMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
      feedRow(nowMs - 16 * minuteMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
    ]
    const anomaly = firstOf(detectNewAccountBursts(underLimit, nowMs))
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.accountAgeDays).toBe(6)
  })

  it('stays silent when the bids spread beyond one window', () => {
    const rows = [
      feedRow(nowMs),
      feedRow(nowMs - 20 * minuteMs),
      feedRow(nowMs - 40 * minuteMs),
      feedRow(nowMs - 60 * minuteMs),
      feedRow(nowMs - 80 * minuteMs),
    ]

    expect(detectNewAccountBursts(rows, nowMs)).toEqual([])
  })

  it('counts bids at the exact window edge into one burst', () => {
    const rows = [
      feedRow(nowMs),
      feedRow(nowMs - 10 * minuteMs),
      feedRow(nowMs - 20 * minuteMs),
      feedRow(nowMs - 30 * minuteMs),
    ]

    const anomaly = firstOf(detectNewAccountBursts(rows, nowMs))
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.bidCount).toBe(4)
  })

  it('skips rows without a usable account timestamp', () => {
    const burstRows = [
      feedRow(nowMs - 10 * minuteMs),
      feedRow(nowMs - 12 * minuteMs),
      feedRow(nowMs - 14 * minuteMs),
      feedRow(nowMs - 16 * minuteMs),
    ]
    expect(
      detectNewAccountBursts(
        burstRows.map((row) => ({ ...row, bidderAccountCreatedAt: null })),
        nowMs,
      ),
    ).toEqual([])
    expect(
      detectNewAccountBursts(
        burstRows.map((row) => ({ ...row, bidderAccountCreatedAt: 'not-a-date' })),
        nowMs,
      ),
    ).toEqual([])
  })

  it('reports each qualifying bidder separately', () => {
    const rows = [
      feedRow(nowMs - 10 * minuteMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 12 * minuteMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 14 * minuteMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 16 * minuteMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 1 * minuteMs, {
        bidderId: 'bidder-old',
        bidderAccountCreatedAt: oldAccountCreatedAt,
      }),
      feedRow(nowMs - 2 * minuteMs, {
        bidderId: 'bidder-old',
        bidderAccountCreatedAt: oldAccountCreatedAt,
      }),
      feedRow(nowMs - 3 * minuteMs, {
        bidderId: 'bidder-old',
        bidderAccountCreatedAt: oldAccountCreatedAt,
      }),
      feedRow(nowMs - 4 * minuteMs, {
        bidderId: 'bidder-old',
        bidderAccountCreatedAt: oldAccountCreatedAt,
      }),
      feedRow(nowMs - 11 * minuteMs, { bidderId: 'bidder-young-a' }),
      feedRow(nowMs - 13 * minuteMs, { bidderId: 'bidder-young-a' }),
      feedRow(nowMs - 15 * minuteMs, { bidderId: 'bidder-young-a' }),
      feedRow(nowMs - 17 * minuteMs, { bidderId: 'bidder-young-a' }),
    ]

    const result = detectNewAccountBursts(rows, nowMs)
    expect(result.map((anomaly) => anomaly.bidderId).sort()).toEqual([
      'bidder-young-a',
      'bidder-young-b',
    ])
  })
})

describe('detectRapidOvertakes (rapid overtake)', () => {
  it('flags a pair with three lead flips inside one window', () => {
    const rows = [
      leadRow(nowMs, 'bidder-b', 2),
      leadRow(nowMs - 1 * minuteMs, 'bidder-a', 1),
      leadRow(nowMs - 2 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 3 * minuteMs, 'bidder-a', 1),
    ]

    expect(detectRapidOvertakes(rows)).toEqual([
      {
        kind: 'rapid-overtake',
        bidderIdA: 'bidder-a',
        bidderIdB: 'bidder-b',
        bidderAliasA: 1,
        bidderAliasB: 2,
        flips: 3,
      },
    ])
  })

  it('stays silent below the flip threshold', () => {
    const rows = [
      leadRow(nowMs, 'bidder-a', 1),
      leadRow(nowMs - 1 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 2 * minuteMs, 'bidder-a', 1),
    ]

    expect(detectRapidOvertakes(rows)).toEqual([])
  })

  it('stays silent when the flips spread beyond one window', () => {
    const rows = [
      leadRow(nowMs, 'bidder-a', 1),
      leadRow(nowMs - 1 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 19 * minuteMs, 'bidder-a', 1),
      leadRow(nowMs - 20 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 21 * minuteMs, 'bidder-a', 1),
    ]

    expect(detectRapidOvertakes(rows)).toEqual([])
  })

  it('counts only distinct consecutive leading bidders and ignores other rows', () => {
    const rows = [
      leadRow(nowMs, 'bidder-b', 2),
      leadRow(nowMs - 1 * minuteMs, 'bidder-a', 1),
      leadRow(nowMs - 2 * minuteMs, 'bidder-b', 2),
      feedRow(nowMs - 160 * 1000, { bidderId: 'bidder-c', bidderAlias: 3, status: 'outbid' }),
      leadRow(nowMs - 170 * 1000, 'bidder-a', 1),
      leadRow(nowMs - 180 * 1000, 'bidder-a', 1),
      leadRow(nowMs - 190 * 1000, 'bidder-a', 1),
    ]

    expect(detectRapidOvertakes(rows)).toEqual([
      {
        kind: 'rapid-overtake',
        bidderIdA: 'bidder-a',
        bidderIdB: 'bidder-b',
        bidderAliasA: 1,
        bidderAliasB: 2,
        flips: 3,
      },
    ])
  })

  it('flags each distinct pair separately', () => {
    const rows = [
      leadRow(nowMs - 30 * 1000, 'bidder-d', 4),
      leadRow(nowMs - 60 * 1000, 'bidder-c', 3),
      leadRow(nowMs - 90 * 1000, 'bidder-d', 4),
      leadRow(nowMs - 120 * 1000, 'bidder-c', 3),
      leadRow(nowMs - 3 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 4 * minuteMs, 'bidder-a', 1),
      leadRow(nowMs - 5 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 6 * minuteMs, 'bidder-a', 1),
    ]

    expect(detectRapidOvertakes(rows)).toEqual([
      {
        kind: 'rapid-overtake',
        bidderIdA: 'bidder-a',
        bidderIdB: 'bidder-b',
        bidderAliasA: 1,
        bidderAliasB: 2,
        flips: 3,
      },
      {
        kind: 'rapid-overtake',
        bidderIdA: 'bidder-c',
        bidderIdB: 'bidder-d',
        bidderAliasA: 3,
        bidderAliasB: 4,
        flips: 3,
      },
    ])
  })

  it('ignores leading rows without a bidder identity', () => {
    const anonRow = leadRow(nowMs - 30 * 1000, 'bidder-anon', 0, {
      bidderId: null,
      bidId: null,
    })
    expect(detectRapidOvertakes([anonRow])).toEqual([])

    const rows = [
      leadRow(nowMs, 'bidder-b', 2),
      anonRow,
      leadRow(nowMs - 1 * minuteMs, 'bidder-a', 1),
      leadRow(nowMs - 2 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 3 * minuteMs, 'bidder-a', 1),
    ]

    expect(detectRapidOvertakes(rows)).toEqual([
      {
        kind: 'rapid-overtake',
        bidderIdA: 'bidder-a',
        bidderIdB: 'bidder-b',
        bidderAliasA: 1,
        bidderAliasB: 2,
        flips: 3,
      },
    ])
  })
})

describe('detectAnomalies (combined advisory feed)', () => {
  it('reports the burst and the overtake in one list', () => {
    const rows = [
      leadRow(nowMs, 'bidder-b', 2),
      leadRow(nowMs - 1 * minuteMs, 'bidder-a', 1),
      leadRow(nowMs - 2 * minuteMs, 'bidder-b', 2),
      leadRow(nowMs - 3 * minuteMs, 'bidder-a', 1),
      feedRow(nowMs - 10 * minuteMs),
      feedRow(nowMs - 12 * minuteMs),
      feedRow(nowMs - 14 * minuteMs),
      feedRow(nowMs - 16 * minuteMs),
    ]

    const result = detectAnomalies(rows, nowMs)
    expect(result.map((anomaly) => anomaly.kind)).toEqual(['new-account-burst', 'rapid-overtake'])
  })
})
