// Round-trips the query params that parseAuctionSearchParams in
// @/lib/auction/queries accepts: county, parish, species, loggingType, q,
// areaMin/areaMax, priceMin/priceMax, sort, order. The server parser stays
// the single source of truth; this module only mirrors its param names and
// defaults so panel state survives reload.
//
// Demo parity (design Decision 6): the panel dropped the Maht (m³) range
// and gained Raietähtaeg (aasta). volumeMin/volumeMax stay parsed and
// serialized so shared legacy links keep applying server-side, but the
// panel no longer edits or counts them. cutDeadlineYear applies
// server-side against auctions.cut_deadline_year (migration 0028).

export const LISTING_SORT_FIELDS = ['startPrice', 'endPrice', 'endTime'] as const

export type ListingSortField = (typeof LISTING_SORT_FIELDS)[number]
export type ListingSortDirection = 'asc' | 'desc'

export const DEFAULT_SORT_FIELD: ListingSortField = 'endTime'
export const DEFAULT_SORT_DIRECTION: ListingSortDirection = 'asc'

export interface ListingFilterState {
  county: string[]
  parish: string[]
  species: string[]
  loggingTypes: string[]
  /** Free-text quick-search term from the shell header; '' disables it. */
  q: string
  areaMin?: number | undefined
  areaMax?: number | undefined
  /** Legacy URL round-trip only: the demo panel has no Maht (m³) range. */
  volumeMin?: number | undefined
  volumeMax?: number | undefined
  priceMin?: number | undefined
  priceMax?: number | undefined
  /** Raietähtaeg (aasta); the query layer has no matching filter yet. */
  cutDeadlineYear?: number | undefined
  sortField: ListingSortField
  sortDirection: ListingSortDirection
}

export const DEFAULT_LISTING_FILTERS: ListingFilterState = {
  county: [],
  parish: [],
  species: [],
  loggingTypes: [],
  q: '',
  sortField: DEFAULT_SORT_FIELD,
  sortDirection: DEFAULT_SORT_DIRECTION,
}

// Slider bounds for the dual range inputs. A bound resting at the slider
// extreme means "no limit", and serializeListingFilters omits it so the
// URL never carries meaningless bounds. VOLUME_RANGE stays only as the
// legacy round-trip bound for the dropped Maht (m³) range.
export const AREA_RANGE = { min: 0, max: 500 }
export const VOLUME_RANGE = { min: 0, max: 10000 }
export const PRICE_RANGE = { min: 0, max: 1000000 }

/** Minimal shape shared by URLSearchParams and Next's ReadonlyURLSearchParams. */
interface SearchParamBag {
  get(key: string): string | null
  getAll(key: string): string[]
}

function csvTokens(bag: SearchParamBag, key: string): string[] {
  const tokens: string[] = []
  for (const value of bag.getAll(key)) {
    for (const part of value.split(',')) {
      const token = part.trim()
      if (token !== '' && !tokens.includes(token)) tokens.push(token)
    }
  }
  return tokens
}

function numberToken(bag: SearchParamBag, key: string): number | undefined {
  const raw = bag.get(key)
  if (raw === null || raw.trim() === '') return undefined
  const value = Number(raw)
  if (!Number.isFinite(value) || value < 0 || value > 1e9) return undefined
  return value
}

function yearToken(bag: SearchParamBag, key: string): number | undefined {
  const value = numberToken(bag, key)
  return value !== undefined && Number.isInteger(value) ? value : undefined
}

export function parseListingFilters(bag: SearchParamBag): ListingFilterState {
  const rawSort = (bag.get('sort') ?? '').trim().toLowerCase()
  const sortDescending = rawSort.startsWith('-')
  const rawSortField = sortDescending ? rawSort.slice(1) : rawSort
  const rawOrder = (bag.get('order') ?? '').trim().toLowerCase()

  const sortField =
    LISTING_SORT_FIELDS.find((field) => field.toLowerCase() === rawSortField) ??
    DEFAULT_SORT_FIELD
  const sortDirection: ListingSortDirection =
    rawOrder === 'desc'
      ? 'desc'
      : rawOrder === 'asc'
        ? 'asc'
        : sortDescending
          ? 'desc'
          : DEFAULT_SORT_DIRECTION

  return {
    county: csvTokens(bag, 'county'),
    parish: csvTokens(bag, 'parish'),
    species: csvTokens(bag, 'species'),
    loggingTypes: csvTokens(bag, 'loggingType'),
    q: (bag.get('q') ?? '').trim(),
    areaMin: numberToken(bag, 'areaMin'),
    areaMax: numberToken(bag, 'areaMax'),
    volumeMin: numberToken(bag, 'volumeMin'),
    volumeMax: numberToken(bag, 'volumeMax'),
    priceMin: numberToken(bag, 'priceMin'),
    priceMax: numberToken(bag, 'priceMax'),
    cutDeadlineYear: yearToken(bag, 'cutDeadlineYear'),
    sortField,
    sortDirection,
  }
}

function setRange(
  search: URLSearchParams,
  key: string,
  min: number | undefined,
  max: number | undefined,
  bounds: { min: number; max: number },
): void {
  if (min !== undefined && min > bounds.min) search.set(`${key}Min`, String(min))
  if (max !== undefined && max < bounds.max) search.set(`${key}Max`, String(max))
}

/**
 * Serializes filter state (plus tab and optional page) to a query string.
 * Defaults are omitted; page is omitted when 1 so a filter change resets
 * pagination by simply not carrying the param forward.
 */
export function serializeListingFilters(
  state: ListingFilterState,
  tab: string,
  page = 1,
): string {
  const search = new URLSearchParams()
  search.set('tab', tab)
  const csvEntries: [string, string[]][] = [
    ['county', state.county],
    ['parish', state.parish],
    ['species', state.species],
    ['loggingType', state.loggingTypes],
  ]
  for (const [key, values] of csvEntries) {
    if (values.length > 0) search.set(key, values.join(','))
  }
  if (state.q !== '') search.set('q', state.q)
  setRange(search, 'area', state.areaMin, state.areaMax, AREA_RANGE)
  setRange(search, 'volume', state.volumeMin, state.volumeMax, VOLUME_RANGE)
  setRange(search, 'price', state.priceMin, state.priceMax, PRICE_RANGE)
  if (state.cutDeadlineYear !== undefined) {
    search.set('cutDeadlineYear', String(state.cutDeadlineYear))
  }
  if (
    state.sortField !== DEFAULT_SORT_FIELD ||
    state.sortDirection !== DEFAULT_SORT_DIRECTION
  ) {
    search.set('sort', state.sortField)
    search.set('order', state.sortDirection)
  }
  if (page > 1) search.set('page', String(page))
  return search.toString()
}

export function countActiveFilters(state: ListingFilterState): number {
  let count = 0
  if (state.county.length > 0) count += 1
  if (state.parish.length > 0) count += 1
  if (state.species.length > 0) count += 1
  if (state.loggingTypes.length > 0) count += 1
  if (state.q !== '') count += 1
  if (state.areaMin !== undefined || state.areaMax !== undefined) count += 1
  // volumeMin/volumeMax are legacy link state only, so they stay out of
  // the count the demo "Filtrid (n)" badge shows.
  if (state.priceMin !== undefined || state.priceMax !== undefined) count += 1
  if (state.cutDeadlineYear !== undefined) count += 1
  if (
    state.sortField !== DEFAULT_SORT_FIELD ||
    state.sortDirection !== DEFAULT_SORT_DIRECTION
  ) {
    count += 1
  }
  return count
}

export function listingFiltersEqual(
  a: ListingFilterState,
  b: ListingFilterState,
): boolean {
  return serializeListingFilters(a, '') === serializeListingFilters(b, '')
}
