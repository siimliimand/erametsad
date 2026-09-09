import { describe, expect, it } from 'vitest'

import {
  detectAnomalies,
  detectIpClusters,
  detectNewAccountBursts,
  detectRapidOvertakes,
  IP_CLUSTER_MIN_BIDDERS,
  IP_HASH_PREFIX_LENGTH,
  maskIpHash,
  NEW_ACCOUNT_BURST_MIN_BIDS,
  NEW_ACCOUNT_MAX_AGE_DAYS,
  NEW_ACCOUNT_MAX_AGE_MS,
  RAPID_OVERTAKE_MIN_COUNT,
  RAPID_OVERTAKE_WINDOW_MS,
  RAPID_OVERTAKE_WINDOW_SECONDS,
  TIMELINE_MAX_ENTRIES,
  type AnomalyFeedRow,
} from '../_lib/anomalies'

type Detected = ReturnType<typeof detectAnomalies>[number]

const minuteMs = 60_000
const dayMs = 24 * 60 * minuteMs
const hourMs = 60 * minuteMs
const nowMs = Date.parse('2026-09-08T12:00:00.000Z')
const youngAccountCreatedAt = new Date(nowMs - 2 * dayMs).toISOString()
const oldAccountCreatedAt = '2020-01-01T00:00:00.000Z'

// 32-hex stand-ins for the salted SHA-256 IP hashes; the evidence may only
// ever carry the first IP_HASH_PREFIX_LENGTH characters.
const sharedHash = 'f47ac10b58cc4372a5670e02b2c3d479'
const otherHash = '9f86d081884c7d659a2feaa0c55ad015'

function feedRow(placedAtMs: number, overrides: Partial<AnomalyFeedRow> = {}): AnomalyFeedRow {
  return {
    key: `bid-${String(placedAtMs)}`,
    bidId: `bid-${String(placedAtMs)}`,
    bidderId: 'bidder-young',
    bidderAlias: 9,
    bidderAccountCreatedAt: youngAccountCreatedAt,
    ipHash: null,
    placedAt: new Date(placedAtMs).toISOString(),
    source: 'manual',
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
    status: 'leading',
    ...overrides,
  })
}

/**
 * Alternating leading rows between two bidders: countRows rows produce
 * countRows - 1 bidder flips. Each flip is `gapMs` apart unless `gaps`
 * overrides the gap before that row.
 */
function alternation(
  countRows: number,
  gapMs: number,
  overrides: Partial<AnomalyFeedRow> = {},
  gaps: readonly number[] = [],
): AnomalyFeedRow[] {
  const rows: AnomalyFeedRow[] = []
  let atMs = nowMs - 60_000
  for (let index = 0; index < countRows; index += 1) {
    if (index > 0) {
      atMs += gaps[index - 1] ?? gapMs
    }
    rows.push(
      leadRow(atMs, index % 2 === 0 ? 'bidder-a' : 'bidder-b', index % 2 === 0 ? 1 : 2, {
        key: `alt-${String(index)}`,
        bidId: `alt-${String(index)}`,
        ...overrides,
      }),
    )
  }
  return rows
}

function firstOf(results: readonly Detected[]): Detected {
  const first = results[0]
  if (first === undefined) throw new Error('expected one anomaly')
  return first
}

describe('anomaly threshold constants (spec-aligned)', () => {
  it('keeps the spec thresholds: cluster ≥ 2 bidders, burst < 7 d & ≥ 3 bids, overtake < 10 s × 5', () => {
    expect(IP_CLUSTER_MIN_BIDDERS).toBe(2)
    expect(NEW_ACCOUNT_MAX_AGE_MS).toBe(7 * dayMs)
    expect(NEW_ACCOUNT_MAX_AGE_DAYS).toBe(7)
    expect(NEW_ACCOUNT_BURST_MIN_BIDS).toBe(3)
    expect(RAPID_OVERTAKE_WINDOW_MS).toBe(10_000)
    expect(RAPID_OVERTAKE_WINDOW_SECONDS).toBe(10)
    expect(RAPID_OVERTAKE_MIN_COUNT).toBe(5)
  })
})

describe('detectIpClusters (IP cluster)', () => {
  it('flags two bidders sharing an ip hash with labels, counts, masked prefix, and timeline', () => {
    const rows = [
      feedRow(nowMs - 8_000, {
        bidderId: 'bidder-a',
        bidderAlias: 1,
        ipHash: sharedHash,
      }),
      feedRow(nowMs, { bidderId: 'bidder-b', bidderAlias: 2, ipHash: sharedHash }),
      feedRow(nowMs - 3_000, {
        bidderId: 'bidder-a',
        bidderAlias: 1,
        ipHash: sharedHash,
      }),
    ]

    expect(detectIpClusters(rows)).toEqual([
      {
        kind: 'ip-cluster',
        id: `ip-cluster:${maskIpHash(sharedHash)}`,
        labels: ['Pakkuja #1', 'Pakkuja #2'],
        bidCounts: [2, 1],
        bidCount: 3,
        ipPrefixes: [maskIpHash(sharedHash)],
        timeline: [
          {
            bidId: 'bid-' + String(nowMs - 8_000),
            bidderId: 'bidder-a',
            label: 'Pakkuja #1',
            placedAt: new Date(nowMs - 8_000).toISOString(),
            deltaMs: null,
          },
          {
            bidId: 'bid-' + String(nowMs - 3_000),
            bidderId: 'bidder-a',
            label: 'Pakkuja #1',
            placedAt: new Date(nowMs - 3_000).toISOString(),
            deltaMs: 5_000,
          },
          {
            bidId: 'bid-' + String(nowMs),
            bidderId: 'bidder-b',
            label: 'Pakkuja #2',
            placedAt: new Date(nowMs).toISOString(),
            deltaMs: 3_000,
          },
        ],
      },
    ])
  })

  it('never exposes more than the masked ip-hash prefix', () => {
    const rows = [
      feedRow(nowMs - 1_000, { bidderId: 'bidder-a', bidderAlias: 1, ipHash: sharedHash }),
      feedRow(nowMs, { bidderId: 'bidder-b', bidderAlias: 2, ipHash: sharedHash }),
    ]

    expect(maskIpHash(sharedHash)).toHaveLength(IP_HASH_PREFIX_LENGTH)
    expect(JSON.stringify(detectIpClusters(rows))).not.toContain(sharedHash)
  })

  it('stays silent while a single bidder uses the hash alone', () => {
    const rows = [
      feedRow(nowMs - 2_000, { ipHash: sharedHash }),
      feedRow(nowMs - 1_000, { ipHash: sharedHash }),
      feedRow(nowMs, { ipHash: sharedHash }),
    ]

    expect(detectIpClusters(rows)).toEqual([])
  })

  it('ignores rows without an ip hash or a bidder identity', () => {
    const rows = [
      feedRow(nowMs - 1_000, { bidderId: 'bidder-a', bidderAlias: 1, ipHash: null }),
      feedRow(nowMs, { bidderId: 'bidder-b', bidderAlias: 2, ipHash: null }),
      feedRow(nowMs - 2_000, { bidderId: null, bidId: null, ipHash: sharedHash }),
      feedRow(nowMs - 3_000, { bidderId: 'bidder-a', bidderAlias: 1, ipHash: '' }),
    ]

    expect(detectIpClusters(rows)).toEqual([])
  })

  it('flags each shared hash separately in a stable order', () => {
    const rows = [
      feedRow(nowMs - 1_000, { bidderId: 'bidder-a', bidderAlias: 1, ipHash: sharedHash }),
      feedRow(nowMs, { bidderId: 'bidder-b', bidderAlias: 2, ipHash: sharedHash }),
      feedRow(nowMs - 1_000, { bidderId: 'bidder-c', bidderAlias: 3, ipHash: otherHash }),
      feedRow(nowMs, { bidderId: 'bidder-d', bidderAlias: 4, ipHash: otherHash }),
    ]

    // Sorted by id: the 9f… hash sorts before the f4… hash.
    expect(detectIpClusters(rows).map((anomaly) => anomaly.id)).toEqual([
      `ip-cluster:${maskIpHash(otherHash)}`,
      `ip-cluster:${maskIpHash(sharedHash)}`,
    ])
  })
})

describe('detectNewAccountBursts (burst < 7 d, ≥ 3 bids)', () => {
  it('stays silent at two bids and flags three (spec boundary)', () => {
    const twoBids = [feedRow(nowMs - 10 * hourMs), feedRow(nowMs - 12 * hourMs)]
    expect(detectNewAccountBursts(twoBids, nowMs)).toEqual([])

    const threeBids = [
      feedRow(nowMs - 10 * hourMs),
      feedRow(nowMs - 12 * hourMs),
      feedRow(nowMs - 14 * hourMs),
    ]
    const anomaly = firstOf(detectNewAccountBursts(threeBids, nowMs))
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.bidCount).toBe(3)
    expect(anomaly.accountAgeDays).toBe(2)
  })

  it('counts bids across the whole auction window, not a short burst window', () => {
    const rows = [
      feedRow(nowMs - 10 * hourMs),
      feedRow(nowMs - 20 * hourMs),
      feedRow(nowMs - 30 * hourMs),
    ]

    const anomaly = firstOf(detectNewAccountBursts(rows, nowMs))
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.bidCount).toBe(3)
  })

  it('honours the strict account-age limit: 7 days exact is out, 1 ms younger is in', () => {
    const atLimit = [
      feedRow(nowMs - 10 * hourMs, {
        bidderAccountCreatedAt: new Date(nowMs - NEW_ACCOUNT_MAX_AGE_MS).toISOString(),
      }),
      feedRow(nowMs - 11 * hourMs, {
        bidderAccountCreatedAt: new Date(nowMs - NEW_ACCOUNT_MAX_AGE_MS).toISOString(),
      }),
      feedRow(nowMs - 12 * hourMs, {
        bidderAccountCreatedAt: new Date(nowMs - NEW_ACCOUNT_MAX_AGE_MS).toISOString(),
      }),
    ]
    expect(detectNewAccountBursts(atLimit, nowMs)).toEqual([])

    const underLimitCreatedAt = new Date(nowMs - NEW_ACCOUNT_MAX_AGE_MS + 1).toISOString()
    const underLimit = [
      feedRow(nowMs - 10 * hourMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
      feedRow(nowMs - 11 * hourMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
      feedRow(nowMs - 12 * hourMs, { bidderAccountCreatedAt: underLimitCreatedAt }),
    ]
    const anomaly = firstOf(detectNewAccountBursts(underLimit, nowMs))
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.accountAgeDays).toBe(6)
  })

  it('skips rows without a usable account timestamp and never flags old accounts', () => {
    const burstRows = [
      feedRow(nowMs - 10 * hourMs),
      feedRow(nowMs - 11 * hourMs),
      feedRow(nowMs - 12 * hourMs),
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
    expect(
      detectNewAccountBursts(
        burstRows.map((row) => ({ ...row, bidderAccountCreatedAt: oldAccountCreatedAt })),
        nowMs,
      ),
    ).toEqual([])
  })

  it('reports each qualifying bidder separately with evidence', () => {
    const rows = [
      feedRow(nowMs - 10 * hourMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 11 * hourMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 12 * hourMs, { bidderId: 'bidder-young-b', bidderAlias: 10 }),
      feedRow(nowMs - 13 * hourMs, { bidderId: 'bidder-young-a' }),
      feedRow(nowMs - 14 * hourMs, { bidderId: 'bidder-young-a' }),
      feedRow(nowMs - 15 * hourMs, { bidderId: 'bidder-young-a' }),
    ]

    const result = detectNewAccountBursts(rows, nowMs)
    expect(result.map((anomaly) => anomaly.bidderId)).toEqual([
      'bidder-young-a',
      'bidder-young-b',
    ])
    const anomaly = firstOf(result)
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.labels).toEqual(['Pakkuja #9'])
    expect(anomaly.bidCounts).toEqual([3])
    expect(anomaly.timeline.map((entry) => entry.deltaMs)).toEqual([null, hourMs, hourMs])
  })

  it('caps the evidence timeline but keeps the full bid count', () => {
    const rows: AnomalyFeedRow[] = []
    for (let index = 0; index < 25; index += 1) {
      rows.push(feedRow(nowMs - index * minuteMs, { key: `c-${String(index)}`, bidId: `c-${String(index)}` }))
    }

    const anomaly = firstOf(detectNewAccountBursts(rows, nowMs))
    if (anomaly.kind !== 'new-account-burst') throw new Error('expected a burst anomaly')
    expect(anomaly.bidCount).toBe(25)
    expect(anomaly.timeline).toHaveLength(TIMELINE_MAX_ENTRIES)
  })
})

describe('detectRapidOvertakes (overtake < 10 s × 5)', () => {
  it('stays silent at four fast overtakes and flags five (spec boundary)', () => {
    const fourOvertakes = alternation(5, 1_000)
    expect(detectRapidOvertakes(fourOvertakes)).toEqual([])

    const fiveOvertakes = alternation(6, 1_000)
    const anomaly = firstOf(detectRapidOvertakes(fiveOvertakes))
    if (anomaly.kind !== 'rapid-overtake') throw new Error('expected an overtake anomaly')
    expect(anomaly.id).toBe('rapid-overtake:bidder-a:bidder-b')
    expect(anomaly.bidderIdA).toBe('bidder-a')
    expect(anomaly.bidderIdB).toBe('bidder-b')
    expect(anomaly.labels).toEqual(['Pakkuja #1', 'Pakkuja #2'])
    expect(anomaly.bidCounts).toEqual([3, 3])
    expect(anomaly.bidCount).toBe(6)
    expect(anomaly.ipPrefixes).toEqual([])
    expect(anomaly.overtakes).toBe(5)
    expect(anomaly.timeline).toHaveLength(6)
    expect(anomaly.timeline.at(0)?.deltaMs).toBeNull()
    expect(anomaly.timeline.at(0)?.label).toBe('Pakkuja #1')
    expect(anomaly.timeline.at(-1)?.label).toBe('Pakkuja #2')
    expect(
      anomaly.timeline.every((entry) => entry.deltaMs === null || entry.deltaMs === 1_000),
    ).toBe(true)
  })

  it('honours the strict 10 s window: 10 000 ms is out, 9 999 ms is in', () => {
    const atLimit = alternation(6, 1_000, {}, [1_000, 1_000, 1_000, 1_000, 10_000])
    expect(detectRapidOvertakes(atLimit)).toEqual([])

    const underLimit = alternation(6, 1_000, {}, [1_000, 1_000, 1_000, 1_000, 9_999])
    const anomaly = firstOf(detectRapidOvertakes(underLimit))
    if (anomaly.kind !== 'rapid-overtake') throw new Error('expected an overtake anomaly')
    expect(anomaly.overtakes).toBe(5)
    expect(anomaly.timeline.at(-1)?.deltaMs).toBe(9_999)
  })

  it('never counts slow alternating bids even in volume', () => {
    const slow = alternation(8, 60_000)
    expect(detectRapidOvertakes(slow)).toEqual([])
  })

  it('counts only distinct consecutive leading bidders and ignores other statuses', () => {
    // Duplicate same-bidder leading rows and interleaved outbid rows must
    // not inflate the flip count: five genuine fast flips remain.
    const at = (secondsAgo: number): number => nowMs - secondsAgo * 1_000
    const rows: AnomalyFeedRow[] = [
      leadRow(at(7), 'bidder-a', 1),
      leadRow(at(6), 'bidder-a', 1),
      leadRow(at(5), 'bidder-b', 2),
      feedRow(at(4), { bidderId: 'bidder-c', bidderAlias: 3, status: 'outbid' }),
      leadRow(at(3.5), 'bidder-b', 2),
      leadRow(at(3), 'bidder-a', 1),
      leadRow(at(2), 'bidder-b', 2),
      leadRow(at(1), 'bidder-a', 1),
      leadRow(at(0), 'bidder-b', 2),
    ]

    const anomaly = firstOf(detectRapidOvertakes(rows))
    if (anomaly.kind !== 'rapid-overtake') throw new Error('expected an overtake anomaly')
    expect(anomaly.overtakes).toBe(5)
    expect(anomaly.bidCounts).toEqual([3, 4])
    expect(anomaly.bidCount).toBe(7)
  })

  it('keeps counting across leading rows without a bidder identity', () => {
    const anonRow = leadRow(nowMs - 5_650, 'bidder-anon', 0, {
      bidderId: null,
      bidId: null,
    })
    expect(detectRapidOvertakes([anonRow])).toEqual([])

    // The anonymous row sits mid-chain; the pair counting continues past it.
    const rows = [
      leadRow(nowMs - 6_000, 'bidder-a', 1),
      leadRow(nowMs - 5_000, 'bidder-b', 2),
      leadRow(nowMs - 4_000, 'bidder-a', 1),
      leadRow(nowMs - 3_000, 'bidder-b', 2),
      anonRow,
      leadRow(nowMs - 2_000, 'bidder-a', 1),
      leadRow(nowMs - 1_000, 'bidder-b', 2),
    ]
    const anomaly = firstOf(detectRapidOvertakes(rows))
    if (anomaly.kind !== 'rapid-overtake') throw new Error('expected an overtake anomaly')
    expect(anomaly.overtakes).toBe(5)
  })

  it('flags each distinct pair separately with per-bidder counts', () => {
    const rows = [
      leadRow(nowMs, 'bidder-d', 4),
      leadRow(nowMs - 1_000, 'bidder-c', 3),
      leadRow(nowMs - 2_000, 'bidder-d', 4),
      leadRow(nowMs - 3_000, 'bidder-c', 3),
      leadRow(nowMs - 4_000, 'bidder-d', 4),
      leadRow(nowMs - 5_000, 'bidder-c', 3),
      leadRow(nowMs - 60_000, 'bidder-b', 2),
      leadRow(nowMs - 61_000, 'bidder-a', 1),
      leadRow(nowMs - 62_000, 'bidder-b', 2),
      leadRow(nowMs - 63_000, 'bidder-a', 1),
      leadRow(nowMs - 64_000, 'bidder-b', 2),
      leadRow(nowMs - 65_000, 'bidder-a', 1),
      leadRow(nowMs - 66_000, 'bidder-b', 2),
      leadRow(nowMs - 67_000, 'bidder-a', 1),
    ]

    const result = detectRapidOvertakes(rows)
    expect(result.map((anomaly) => anomaly.id)).toEqual([
      'rapid-overtake:bidder-a:bidder-b',
      'rapid-overtake:bidder-c:bidder-d',
    ])
    const second = result[1]
    if (second?.kind !== 'rapid-overtake') throw new Error('expected an overtake anomaly')
    expect(second.overtakes).toBe(5)
    expect(second.labels).toEqual(['Pakkuja #3', 'Pakkuja #4'])
    expect(second.bidCounts).toEqual([3, 3])
  })
})

describe('detectAnomalies (combined advisory feed)', () => {
  it('reports clusters, bursts, and overtakes in one list', () => {
    const rows = [
      ...alternation(6, 1_000),
      feedRow(nowMs - 10 * hourMs),
      feedRow(nowMs - 11 * hourMs),
      feedRow(nowMs - 12 * hourMs),
      feedRow(nowMs - 20_000, { bidderId: 'bidder-x', bidderAlias: 5, ipHash: sharedHash }),
      feedRow(nowMs - 21_000, { bidderId: 'bidder-y', bidderAlias: 6, ipHash: sharedHash }),
    ]

    const result = detectAnomalies(rows, nowMs)
    expect(result.map((anomaly) => anomaly.kind)).toEqual([
      'ip-cluster',
      'new-account-burst',
      'rapid-overtake',
    ])
  })
})
