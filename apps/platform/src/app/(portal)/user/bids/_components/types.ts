import type {
  AuctionObjectType,
  AuctionStatus,
  BidStatus,
} from '@/lib/data/schema'

/**
 * Same shaping as the rows of GET /api/v1/auctions/with-user-bids, plus
 * three fields the API row omits but this page needs: auctionType (the
 * AVATUD/SULETUD badge and sealed masking), minBidEur and bidStepEur
 * (autobidder floor hint).
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
    county: { id: string; name: string; code: string } | null
  }
  myBid: { amountEur: number; status: BidStatus; createdAt: string } | null
  leadingAmountEur: number | null
  outcome?: 'won' | 'lost' | 'unsold'
  finalPriceEur?: number | null
}

export const BIDS_TABS = [
  { id: 'aktiivsed', label: 'Aktiivsed' },
  { id: 'loppenud', label: 'Lõppenud' },
  { id: 'automaatpakkuja', label: 'Automaatpakkuja' },
] as const

export type BidsTabId = (typeof BIDS_TABS)[number]['id']
