import type { BidSource, BidStatus } from '@/lib/data/schema'

/**
 * Pure anomaly heuristics for the bid monitor (spec: "Anomaly heuristics").
 * Advisory only — they never block bids; bid admission stays
 * server-authoritative in AuctionDO. Every function is pure so the spec
 * thresholds stay directly testable.
 *
 * Thresholds from the spec delta:
 * - IP cluster: two or more bidders sharing one IP hash on the auction.
 * - New-account burst: an account younger than 7 days placing 3 or more
 *   bids inside the auction window.
 * - Rapid overtake: the leading bidder flips between the same two bidders
 *   with less than 10 seconds between the bids, 5 times.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export const IP_CLUSTER_MIN_BIDDERS = 2

export const NEW_ACCOUNT_MAX_AGE_MS = 7 * DAY_MS
export const NEW_ACCOUNT_BURST_MIN_BIDS = 3

export const RAPID_OVERTAKE_WINDOW_MS = 10_000
export const RAPID_OVERTAKE_MIN_COUNT = 5

export const NEW_ACCOUNT_MAX_AGE_DAYS = NEW_ACCOUNT_MAX_AGE_MS / DAY_MS
export const RAPID_OVERTAKE_WINDOW_SECONDS = RAPID_OVERTAKE_WINDOW_MS / 1000

// Only a masked prefix of an IP hash leaves this module; the full hash
// stays behind the audited CSV export.
export const IP_HASH_PREFIX_LENGTH = 12

// Evidence timelines cap at the most recent entries; counts stay complete.
export const TIMELINE_MAX_ENTRIES = 20

export interface AnomalyFeedRow {
  key: string
  bidId: string | null
  bidderId: string | null
  bidderAlias: number | null
  bidderAccountCreatedAt: string | null
  /** Salted IP hash from the bid row; null when the bid carries none. */
  ipHash: string | null
  placedAt: string
  source: BidSource
  status: BidStatus
}

export interface AnomalyTimelineEntry {
  bidId: string | null
  bidderId: string | null
  /** Feed-local masked alias label, e.g. "Pakkuja #3". */
  label: string
  placedAt: string
  /** Gap to the previous involved bid; null on the first entry. */
  deltaMs: number | null
}

interface AnomalyBase {
  /** Stable identity for React keys, per-card flag state, and audit trails. */
  id: string
  /** Involved bidder labels, parallel to `bidCounts`. */
  labels: string[]
  /** Involved bid counts per label, parallel to `labels`. */
  bidCounts: number[]
  /** Total involved bids (timeline caps independently). */
  bidCount: number
  /** Masked IP-hash prefixes; empty when the heuristic uses no IP data. */
  ipPrefixes: string[]
  /** Involved bids oldest-first with the gap to the previous entry. */
  timeline: AnomalyTimelineEntry[]
}

export interface IpClusterAnomaly extends AnomalyBase {
  kind: 'ip-cluster'
}

export interface NewAccountBurstAnomaly extends AnomalyBase {
  kind: 'new-account-burst'
  bidderId: string
  accountAgeDays: number
}

export interface RapidOvertakeAnomaly extends AnomalyBase {
  kind: 'rapid-overtake'
  bidderIdA: string
  bidderIdB: string
  /** Overtake events between the pair, each under the 10 s window. */
  overtakes: number
}

export type DetectedAnomaly = IpClusterAnomaly | NewAccountBurstAnomaly | RapidOvertakeAnomaly

/** Masked IP-hash prefix — never the full hash. */
export function maskIpHash(ipHash: string): string {
  return ipHash.slice(0, IP_HASH_PREFIX_LENGTH)
}

function aliasLabel(alias: number | null): string {
  return alias === null ? 'Pakkuja' : `Pakkuja #${String(alias)}`
}

function parseTime(iso: string): number {
  return Date.parse(iso)
}

/**
 * Builds the capped oldest-first evidence timeline from chronologically
 * ascending rows, recomputing deltas over the kept entries only.
 */
function buildTimeline(
  entries: readonly {
    bidId: string | null
    bidderId: string | null
    label: string
    placedAt: string
  }[],
): { timeline: AnomalyTimelineEntry[]; total: number } {
  const capped = entries.slice(Math.max(0, entries.length - TIMELINE_MAX_ENTRIES))
  const timeline: AnomalyTimelineEntry[] = []
  let previousMs: number | null = null
  for (const entry of capped) {
    const atMs = parseTime(entry.placedAt)
    timeline.push({
      bidId: entry.bidId,
      bidderId: entry.bidderId,
      label: entry.label,
      placedAt: entry.placedAt,
      deltaMs: previousMs === null || Number.isNaN(atMs) ? null : atMs - previousMs,
    })
    previousMs = Number.isNaN(atMs) ? previousMs : atMs
  }
  return { timeline, total: entries.length }
}

/**
 * Pure: flags IP hashes shared by two or more bidders on the same auction
 * (spec scenario "IP cluster flagged"). Rows without a usable bidder
 * identity or IP hash cannot form a cluster and stay out.
 */
export function detectIpClusters(rows: readonly AnomalyFeedRow[]): IpClusterAnomaly[] {
  interface Cluster {
    bidders: Map<string, { label: string; bids: number }>
    entries: {
      bidId: string | null
      bidderId: string | null
      label: string
      placedAt: string
    }[]
  }
  const clusters = new Map<string, Cluster>()

  for (const row of rows) {
    if (row.bidderId === null) continue
    if (row.ipHash === null || row.ipHash === '') continue
    let cluster = clusters.get(row.ipHash)
    if (cluster === undefined) {
      cluster = { bidders: new Map(), entries: [] }
      clusters.set(row.ipHash, cluster)
    }
    const bidder =
      cluster.bidders.get(row.bidderId) ?? { label: aliasLabel(row.bidderAlias), bids: 0 }
    bidder.bids += 1
    cluster.bidders.set(row.bidderId, bidder)
    cluster.entries.push({
      bidId: row.bidId,
      bidderId: row.bidderId,
      label: aliasLabel(row.bidderAlias),
      placedAt: row.placedAt,
    })
  }

  const anomalies: IpClusterAnomaly[] = []
  for (const [ipHash, cluster] of clusters) {
    if (cluster.bidders.size < IP_CLUSTER_MIN_BIDDERS) continue
    const ordered = [...cluster.entries].sort((a, b) => parseTime(a.placedAt) - parseTime(b.placedAt))
    const { timeline, total } = buildTimeline(ordered)
    const labels: string[] = []
    const bidCounts: number[] = []
    for (const bidderId of [...cluster.bidders.keys()].sort()) {
      const bidder = cluster.bidders.get(bidderId)
      if (bidder === undefined) continue
      labels.push(bidder.label)
      bidCounts.push(bidder.bids)
    }
    anomalies.push({
      kind: 'ip-cluster',
      id: `ip-cluster:${maskIpHash(ipHash)}`,
      labels,
      bidCounts,
      bidCount: total,
      ipPrefixes: [maskIpHash(ipHash)],
      timeline,
    })
  }
  return anomalies.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Pure: flags accounts younger than 7 days that placed 3 or more bids
 * inside the auction window. Account ages are advisory input; rows
 * without a usable account timestamp stay out.
 */
export function detectNewAccountBursts(
  rows: readonly AnomalyFeedRow[],
  nowMs: number,
): NewAccountBurstAnomaly[] {
  interface Timeline {
    bidderId: string
    label: string
    accountCreatedAt: string | null
    entries: {
      bidId: string | null
      bidderId: string | null
      label: string
      placedAt: string
    }[]
  }
  const byBidder = new Map<string, Timeline>()
  for (const row of rows) {
    if (row.bidderId === null) continue
    let timeline = byBidder.get(row.bidderId)
    if (timeline === undefined) {
      timeline = {
        bidderId: row.bidderId,
        label: aliasLabel(row.bidderAlias),
        accountCreatedAt: row.bidderAccountCreatedAt,
        entries: [],
      }
      byBidder.set(row.bidderId, timeline)
    }
    timeline.entries.push({
      bidId: row.bidId,
      bidderId: row.bidderId,
      label: timeline.label,
      placedAt: row.placedAt,
    })
  }

  const bursts: NewAccountBurstAnomaly[] = []
  for (const timeline of byBidder.values()) {
    if (timeline.accountCreatedAt === null) continue
    const createdAtMs = parseTime(timeline.accountCreatedAt)
    if (Number.isNaN(createdAtMs)) continue
    const ageMs = nowMs - createdAtMs
    // The spec age limit is strict: an account at exactly 7 days is no
    // longer "younger than 7 days".
    if (ageMs < 0 || ageMs >= NEW_ACCOUNT_MAX_AGE_MS) continue
    if (timeline.entries.length < NEW_ACCOUNT_BURST_MIN_BIDS) continue

    const ordered = [...timeline.entries].sort(
      (a, b) => parseTime(a.placedAt) - parseTime(b.placedAt),
    )
    const { timeline: capped, total } = buildTimeline(ordered)
    bursts.push({
      kind: 'new-account-burst',
      id: `new-account-burst:${timeline.bidderId}`,
      bidderId: timeline.bidderId,
      labels: [timeline.label],
      bidCounts: [total],
      bidCount: total,
      ipPrefixes: [],
      timeline: capped,
      accountAgeDays: Math.floor(ageMs / DAY_MS),
    })
  }
  return bursts.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/**
 * Pure: flags bidder pairs that re-overtake each other rapidly — the
 * leading status flips between the same two bidders with less than 10
 * seconds between the bids, 5 or more times (spec: rapid overtakes).
 * Only leading rows participate; flips slower than the window never count.
 */
export function detectRapidOvertakes(rows: readonly AnomalyFeedRow[]): RapidOvertakeAnomaly[] {
  const leading = rows
    .filter(
      (row): row is AnomalyFeedRow & { bidderId: string } =>
        row.status === 'leading' && row.bidderId !== null,
    )
    .sort((a, b) => parseTime(a.placedAt) - parseTime(b.placedAt))

  interface PairEvents {
    idA: string
    idB: string
    aliases: Map<string, number | null>
    events: { previous: AnomalyFeedRow; current: AnomalyFeedRow }[]
  }
  const eventsByPair = new Map<string, PairEvents>()
  let previous: (AnomalyFeedRow & { bidderId: string }) | null = null
  for (const row of leading) {
    const previousBidderId = previous?.bidderId
    if (previous !== null && previousBidderId !== undefined && previousBidderId !== row.bidderId) {
      const gap = parseTime(row.placedAt) - parseTime(previous.placedAt)
      // NaN gaps (invalid timestamps) never qualify; the window is strict:
      // a gap of exactly 10 s is not an overtake.
      if (!Number.isNaN(gap) && gap >= 0 && gap < RAPID_OVERTAKE_WINDOW_MS) {
        const sorted = [previousBidderId, row.bidderId].sort()
        const idA = sorted[0] ?? previousBidderId
        const idB = sorted[1] ?? row.bidderId
        const pairKey = `${idA}::${idB}`
        let pair = eventsByPair.get(pairKey)
        if (pair === undefined) {
          pair = {
            idA,
            idB,
            aliases: new Map([
              [previousBidderId, previous.bidderAlias],
              [row.bidderId, row.bidderAlias],
            ]),
            events: [],
          }
          eventsByPair.set(pairKey, pair)
        }
        pair.aliases.set(previousBidderId, previous.bidderAlias)
        pair.aliases.set(row.bidderId, row.bidderAlias)
        pair.events.push({ previous, current: row })
      }
    }
    previous = row
  }

  const overtakes: RapidOvertakeAnomaly[] = []
  for (const pair of eventsByPair.values()) {
    if (pair.events.length < RAPID_OVERTAKE_MIN_COUNT) continue

    // Deduplicate involved rows (each leading row is the current of one
    // event and the previous of the next), then cap like every timeline.
    const byKey = new Map<string, AnomalyFeedRow>()
    for (const event of pair.events) {
      byKey.set(event.previous.key, event.previous)
      byKey.set(event.current.key, event.current)
    }
    const ordered = [...byKey.values()].sort(
      (a, b) => parseTime(a.placedAt) - parseTime(b.placedAt),
    )
    const { timeline, total } = buildTimeline(
      ordered.map((row) => ({
        bidId: row.bidId,
        bidderId: row.bidderId,
        label: aliasLabel(row.bidderAlias),
        placedAt: row.placedAt,
      })),
    )

    const labels: string[] = []
    const bidCounts: number[] = []
    for (const bidderId of [pair.idA, pair.idB]) {
      const alias = pair.aliases.get(bidderId) ?? null
      labels.push(aliasLabel(alias))
      bidCounts.push(ordered.filter((row) => row.bidderId === bidderId).length)
    }
    overtakes.push({
      kind: 'rapid-overtake',
      id: `rapid-overtake:${pair.idA}:${pair.idB}`,
      bidderIdA: pair.idA,
      bidderIdB: pair.idB,
      labels,
      bidCounts,
      bidCount: total,
      ipPrefixes: [],
      timeline,
      overtakes: pair.events.length,
    })
  }
  return overtakes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Pure: combined advisory anomaly list for the monitor panel. */
export function detectAnomalies(
  rows: readonly AnomalyFeedRow[],
  nowMs: number,
): DetectedAnomaly[] {
  return [
    ...detectIpClusters(rows),
    ...detectNewAccountBursts(rows, nowMs),
    ...detectRapidOvertakes(rows),
  ]
}
