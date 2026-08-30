/**
 * Estonian summary sentence for the portal listing, generated from active
 * statistics of one tab. Pure and unit-testable: no React, no I/O, and the
 * number formatting is hand-rolled (space group separator) so tests do not
 * depend on host ICU data.
 */

import type { AuctionObjectType } from '@/lib/data/schema'

export type ListingTabId =
  | 'koik'
  | 'raieoigused'
  | 'metskinnistud'
  | 'polumaad'
  | 'paketid'
  | 'kiiroksjonid'

export interface ActiveListingStats {
  count: number
  areaHa: number
  volumeM3: number
  minBidEur: number
}

export type ActiveStatsByObjectType = Record<AuctionObjectType, ActiveListingStats>

// Partitive noun phrase completing "aktiivseid {…}"; Kõik carries no
// qualifier, so its phrase is just "oksjoneid".
const TAB_NOUN_PHRASE: Record<ListingTabId, string> = {
  koik: 'oksjoneid',
  raieoigused: 'raieõiguste oksjoneid',
  metskinnistud: 'metskinnistute oksjoneid',
  polumaad: 'põllumaade oksjoneid',
  paketid: 'kinnistute pakettide oksjoneid',
  kiiroksjonid: 'kiiroksjonide oksjoneid',
}

/** Estonian integer format: non-negative, space as the group separator. */
export function formatEstonianInteger(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0)
  return String(Math.max(rounded, 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Totals for one tab: the given objectTypes' buckets, or every bucket for
 * 'all' (the Kõik tab). minBidEur stays a sum of start prices, matching
 * activeStatsByObjectType.
 */
export function sumStats(
  objectTypes: readonly AuctionObjectType[] | 'all',
  stats: ActiveStatsByObjectType,
): ActiveListingStats {
  const buckets =
    objectTypes === 'all' ? Object.values(stats) : objectTypes.map((objectType) => stats[objectType])
  return buckets.reduce(
    (total, bucket) => ({
      count: total.count + bucket.count,
      areaHa: total.areaHa + bucket.areaHa,
      volumeM3: total.volumeM3 + bucket.volumeM3,
      minBidEur: total.minBidEur + bucket.minBidEur,
    }),
    { count: 0, areaHa: 0, volumeM3: 0, minBidEur: 0 },
  )
}

/**
 * Forest tab (raieoigused) uses the volume pattern; every other tab omits
 * volume — for Kõik the summed m³ would mix non-forest area into the
 * "raiutav maht" phrase. Zero count falls back to the empty-state sentence.
 */
export function buildActiveSummary(tab: ListingTabId, stats: ActiveListingStats): string {
  const phrase = TAB_NOUN_PHRASE[tab]
  if (stats.count <= 0) {
    return `Hetkel ei ole aktiivseid ${phrase}.`
  }
  const count = formatEstonianInteger(stats.count)
  const area = formatEstonianInteger(stats.areaHa)
  const value = formatEstonianInteger(stats.minBidEur)
  if (tab === 'raieoigused') {
    const volume = formatEstonianInteger(stats.volumeM3)
    return `Hetkel on aktiivseid raieõiguste oksjoneid ${count}, kokku ${area} ha raiutavat mahtu ${volume} m³ ja ${value} € väärtuses.`
  }
  return `Hetkel on aktiivseid ${phrase} ${count}, kokku ${area} ha ja ${value} € väärtuses.`
}
