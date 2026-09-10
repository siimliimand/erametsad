import type {
  AuctionObjectType,
  AuctionStatus,
  BidStatus,
} from '@/lib/data/schema'

/** Pre-end statuses that group under the Käimasolevad chip. */
export const ACTIVE_GROUP_STATUSES: readonly AuctionStatus[] = [
  'scheduled',
  'active',
]

/**
 * Same shaping as the rows of GET /api/v1/auctions/with-user-bids, plus
 * four fields the API row omits but this page needs: auctionType (the
 * Avatud/Suletud badge and sealed masking), minBidEur and bidStepEur
 * (autobidder floor hint), areaHa (demo sub line) and contractPending
 * (won card's "Leping allkirja ootel" state).
 */
export interface MyBidRow {
  auction: {
    id: string
    title: string
    objectType: AuctionObjectType
    auctionStatus: AuctionStatus
    auctionType: 'open' | 'sealed'
    endsAt: string | null
    minBidEur: number
    bidStepEur: number | null
    areaHa: number | null
    county: { id: string; name: string; code: string } | null
  }
  myBid: { amountEur: number; status: BidStatus; createdAt: string } | null
  leadingAmountEur: number | null
  outcome?: 'won' | 'lost' | 'unsold'
  finalPriceEur?: number | null
  contractPending?: boolean
}

// Demo filter chips (09-user-bids.html .filters-row): Käimasolevad covers
// scheduled and active auctions, the outcome chips read from the ended rows.
export const BID_FILTERS = [
  { id: 'active', label: 'Käimasolevad' },
  { id: 'ended', label: 'Lõppenud' },
  { id: 'won', label: 'Võidetud' },
  { id: 'lost', label: 'Kaotatud' },
] as const

export type BidFilterId = (typeof BID_FILTERS)[number]['id']

export function rowCategories(row: MyBidRow): BidFilterId[] {
  const categories: BidFilterId[] = [
    ACTIVE_GROUP_STATUSES.includes(row.auction.auctionStatus)
      ? 'active'
      : 'ended',
  ]
  if (row.outcome === 'won') categories.push('won')
  if (row.outcome === 'lost') categories.push('lost')
  return categories
}

/** Demo chip semantics: no pressed chips shows everything, pressed chips OR-combine. */
export function matchesFilters(
  row: MyBidRow,
  filters: ReadonlySet<BidFilterId>,
): boolean {
  if (filters.size === 0) return true
  return rowCategories(row).some((category) => filters.has(category))
}

/** The removed tab views live on as old deep links; map them onto chips. */
export function filtersFromTab(tab: string | undefined): BidFilterId[] {
  switch (tab) {
    case 'aktiivsed':
    case 'automaatpakkuja':
      return ['active']
    case 'loppenud':
      return ['ended']
    default:
      return []
  }
}

export function filtersFromOlek(raw: string | undefined): BidFilterId[] {
  if (raw === undefined) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is BidFilterId =>
      BID_FILTERS.some((filter) => filter.id === value),
    )
}
