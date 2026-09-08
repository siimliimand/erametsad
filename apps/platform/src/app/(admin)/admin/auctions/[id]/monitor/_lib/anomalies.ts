import type { BidSource, BidStatus } from '@/lib/data/schema'

/**
 * Pure anomaly heuristics for the bid monitor (spec: bid monitor parity).
 * These are advisory only — they never block bids; bid admission stays
 * server-authoritative in AuctionDO. Every function is pure so the
 * thresholds are directly testable.
 */

// New-account burst: an account younger than the age threshold placing at
// least NEW_ACCOUNT_BURST_MIN_BIDS bids within one burst window.
export const NEW_ACCOUNT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000
export const NEW_ACCOUNT_BURST_WINDOW_MS = 30 * 60 * 1000
export const NEW_ACCOUNT_BURST_MIN_BIDS = 4

// Rapid overtake: two bidders flipping the leading status at least
// RAPID_OVERTAKE_MIN_FLIPS times within one overtake window.
export const RAPID_OVERTAKE_WINDOW_MS = 5 * 60 * 1000
export const RAPID_OVERTAKE_MIN_FLIPS = 3

export const NEW_ACCOUNT_MAX_AGE_DAYS = NEW_ACCOUNT_MAX_AGE_MS / (24 * 60 * 60 * 1000)
export const NEW_ACCOUNT_BURST_WINDOW_MINUTES = NEW_ACCOUNT_BURST_WINDOW_MS / (60 * 1000)
export const RAPID_OVERTAKE_WINDOW_MINUTES = RAPID_OVERTAKE_WINDOW_MS / (60 * 1000)

export interface AnomalyFeedRow {
  key: string
  bidId: string | null
  bidderId: string | null
  bidderAlias: number | null
  bidderAccountCreatedAt: string | null
  placedAt: string
  source: BidSource
  status: BidStatus
}

export interface NewAccountBurstAnomaly {
  kind: 'new-account-burst'
  bidderId: string
  bidderAlias: number | null
  bidCount: number
  accountAgeDays: number
}

export interface RapidOvertakeAnomaly {
  kind: 'rapid-overtake'
  bidderIdA: string
  bidderIdB: string
  bidderAliasA: number | null
  bidderAliasB: number | null
  flips: number
}

export type DetectedAnomaly = NewAccountBurstAnomaly | RapidOvertakeAnomaly

interface BidderTimeline {
  bidderId: string
  bidderAlias: number | null
  accountCreatedAt: string | null
  placedAtMs: number[]
}

function groupRowsByBidder(rows: readonly AnomalyFeedRow[]): BidderTimeline[] {
  const byBidder = new Map<string, BidderTimeline>()
  for (const row of rows) {
    if (row.bidderId === null) continue
    let timeline = byBidder.get(row.bidderId)
    if (timeline === undefined) {
      timeline = {
        bidderId: row.bidderId,
        bidderAlias: row.bidderAlias,
        accountCreatedAt: row.bidderAccountCreatedAt,
        placedAtMs: [],
      }
      byBidder.set(row.bidderId, timeline)
    }
    timeline.placedAtMs.push(Date.parse(row.placedAt))
  }
  for (const timeline of byBidder.values()) {
    timeline.placedAtMs.sort((a, b) => a - b)
  }
  return [...byBidder.values()]
}

/** Pure: flags young accounts whose bid rate forms a burst inside a window. */
export function detectNewAccountBursts(
  rows: readonly AnomalyFeedRow[],
  nowMs: number,
): NewAccountBurstAnomaly[] {
  const bursts: NewAccountBurstAnomaly[] = []
  for (const timeline of groupRowsByBidder(rows)) {
    if (timeline.accountCreatedAt === null) continue
    const createdAtMs = Date.parse(timeline.accountCreatedAt)
    if (Number.isNaN(createdAtMs)) continue
    const ageMs = nowMs - createdAtMs
    if (ageMs >= NEW_ACCOUNT_MAX_AGE_MS) continue

    let windowStart = 0
    let maxInWindow = 0
    for (let windowEnd = 0; windowEnd < timeline.placedAtMs.length; windowEnd += 1) {
      const windowEndMs = timeline.placedAtMs[windowEnd]
      if (windowEndMs === undefined) break
      // Re-read the window start each step; a stale value here never
      // converges and hangs the render.
      while (
        windowEndMs - (timeline.placedAtMs[windowStart] ?? windowEndMs) >
        NEW_ACCOUNT_BURST_WINDOW_MS
      ) {
        windowStart += 1
      }
      maxInWindow = Math.max(maxInWindow, windowEnd - windowStart + 1)
    }
    if (maxInWindow >= NEW_ACCOUNT_BURST_MIN_BIDS) {
      bursts.push({
        kind: 'new-account-burst',
        bidderId: timeline.bidderId,
        bidderAlias: timeline.bidderAlias,
        bidCount: maxInWindow,
        accountAgeDays: Math.floor(ageMs / (24 * 60 * 60 * 1000)),
      })
    }
  }
  return bursts
}

/**
 * Pure: flags bidder pairs that rapidly re-overtake each other — the
 * leading status flips between the same two bidders repeatedly inside one
 * window (alternating leading rows).
 */
export function detectRapidOvertakes(rows: readonly AnomalyFeedRow[]): RapidOvertakeAnomaly[] {
  const leading = rows
    .filter((row) => row.status === 'leading' && row.bidderId !== null)
    .sort((a, b) => Date.parse(a.placedAt) - Date.parse(b.placedAt))

  interface PairFlips {
    bidderIdA: string
    bidderIdB: string
    bidderAliasA: number | null
    bidderAliasB: number | null
    flipAtMs: number[]
  }
  const flipsByPair = new Map<string, PairFlips>()
  let previous: AnomalyFeedRow | null = null
  for (const row of leading) {
    const previousBidderId = previous?.bidderId
    if (
      previous !== null &&
      previousBidderId !== null &&
      previousBidderId !== undefined &&
      previousBidderId !== row.bidderId
    ) {
      const ids = [previousBidderId, row.bidderId].filter((id): id is string => id !== null).sort()
      const idA = ids[0] ?? ''
      const idB = ids[1] ?? ''
      const pairKey = `${idA}::${idB}`
      let pair = flipsByPair.get(pairKey)
      if (pair === undefined) {
        pair = {
          bidderIdA: idA,
          bidderIdB: idB,
          bidderAliasA: previous.bidderAlias,
          bidderAliasB: row.bidderAlias,
          flipAtMs: [],
        }
        flipsByPair.set(pairKey, pair)
      }
      pair.flipAtMs.push(Date.parse(row.placedAt))
    }
    previous = row
  }

  const overtakes: RapidOvertakeAnomaly[] = []
  for (const pair of flipsByPair.values()) {
    let windowStart = 0
    let maxInWindow = 0
    for (let windowEnd = 0; windowEnd < pair.flipAtMs.length; windowEnd += 1) {
      const windowEndMs = pair.flipAtMs[windowEnd]
      if (windowEndMs === undefined) break
      // Re-read the window start each step; a stale value here never
      // converges and hangs the render.
      while (
        windowEndMs - (pair.flipAtMs[windowStart] ?? windowEndMs) >
        RAPID_OVERTAKE_WINDOW_MS
      ) {
        windowStart += 1
      }
      maxInWindow = Math.max(maxInWindow, windowEnd - windowStart + 1)
    }
    if (maxInWindow >= RAPID_OVERTAKE_MIN_FLIPS) {
      overtakes.push({
        kind: 'rapid-overtake',
        bidderIdA: pair.bidderIdA,
        bidderIdB: pair.bidderIdB,
        bidderAliasA: pair.bidderAliasA,
        bidderAliasB: pair.bidderAliasB,
        flips: maxInWindow,
      })
    }
  }
  return overtakes
}

/** Pure: combined advisory anomaly list for the shill-warning panel. */
export function detectAnomalies(
  rows: readonly AnomalyFeedRow[],
  nowMs: number,
): DetectedAnomaly[] {
  return [...detectNewAccountBursts(rows, nowMs), ...detectRapidOvertakes(rows)]
}
