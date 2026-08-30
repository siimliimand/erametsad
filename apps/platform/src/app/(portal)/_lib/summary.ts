/**
 * Estonian summary sentence for the portal listing, generated from active
 * statistics of one tab. Pure and unit-testable: no React, no I/O, and the
 * number formatting is hand-rolled (space group separator) so tests do not
 * depend on host ICU data.
 */

export type ListingTabId =
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

// Genitive plural forms for "aktiivseid {…} oksjoneid".
const TAB_GENITIVE: Record<ListingTabId, string> = {
  raieoigused: 'raieõiguste',
  metskinnistud: 'metskinnistute',
  polumaad: 'põllumaade',
  paketid: 'kinnistute pakettide',
  kiiroksjonid: 'kiiroksjonide',
}

/** Estonian integer format: non-negative, space as the group separator. */
export function formatEstonianInteger(value: number): string {
  const rounded = Math.round(Number.isFinite(value) ? value : 0)
  return String(Math.max(rounded, 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Forest tab (raieoigused) uses the volume pattern; every other tab omits
 * volume. Zero count falls back to the empty-state sentence.
 */
export function buildActiveSummary(tab: ListingTabId, stats: ActiveListingStats): string {
  const genitive = TAB_GENITIVE[tab]
  if (stats.count <= 0) {
    return `Hetkel ei ole aktiivseid ${genitive} oksjoneid.`
  }
  const count = formatEstonianInteger(stats.count)
  const area = formatEstonianInteger(stats.areaHa)
  const value = formatEstonianInteger(stats.minBidEur)
  if (tab === 'raieoigused') {
    const volume = formatEstonianInteger(stats.volumeM3)
    return `Hetkel on aktiivseid raieõiguste oksjoneid ${count}, kokku ${area} ha raiutavat mahtu ${volume} m³ ja ${value} € väärtuses.`
  }
  return `Hetkel on aktiivseid ${genitive} oksjoneid ${count}, kokku ${area} ha ja ${value} € väärtuses.`
}
