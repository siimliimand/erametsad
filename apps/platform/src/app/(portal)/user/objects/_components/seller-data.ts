import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories'
import type { AuctionDoc } from '@/lib/data/repositories/registry'
import type { Bid } from '@/lib/data/schema'

// Mirrors the STATUS_TABS mapping in /api/v1/my-auctions; the page and the
// API must agree on which auction statuses each seller tab covers. 'ongoing'
// is a page-level composite (design D9): the demo chip "Käimasolevad" folds
// the pre-end states scheduled + active into one chip, while the legacy
// ?status=scheduled|active values keep resolving for URL stability.
export type StatusTab = 'all' | 'ongoing' | 'draft' | 'scheduled' | 'active' | 'ended'

export const STATUS_TABS: readonly StatusTab[] = [
  'all',
  'ongoing',
  'draft',
  'scheduled',
  'active',
  'ended',
]

const STATUS_TAB_FILTERS: Record<StatusTab, readonly string[]> = {
  all: [],
  ongoing: ['scheduled', 'active'],
  draft: ['draft'],
  scheduled: ['scheduled'],
  active: ['active'],
  ended: ['ended', 'appraised', 'unsold', 'contract', 'completed', 'archived'],
}

export interface BidLogEntry {
  bidId: string
  amount: number
  label: string
  createdAt: string
  isAutobid: boolean
}

export interface UnderbidEntry {
  bidId: string
  amount: number
  label: string
  createdAt: string
  isAutobid: boolean
}

export interface SellerAuctionRow {
  id: string
  title: string
  slug: string
  objectType: string
  type: string
  status: string
  startPrice: number
  finalPrice: number | null
  leadingPrice: number | null
  bidCount: number
  pendingApprovalCount: number
  views: number | null
  countyName: string | null
  areaHa: number | null
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
  pending: UnderbidEntry[]
  bidLog: BidLogEntry[]
  [key: string]: unknown
}

export interface PendingBannerGroup {
  auctionId: string
  title: string
  count: number
}

const BID_LOG_LIMIT = 50

function anonymizedLabels(bids: Bid[]): Map<string, number> {
  const ordered = [...bids].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? -1 : 1
    return a.id < b.id ? -1 : 1
  })
  return new Map(ordered.map((bid, index) => [bid.id, index + 1]))
}

function byNewestFirst(a: Bid, b: Bid): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
  return a.id < b.id ? 1 : -1
}

function buildRow(
  doc: AuctionDoc,
  bids: Bid[],
  countyName: string | null,
): SellerAuctionRow {
  const liveBids = bids.filter((bid) => bid.status !== 'rejected')
  const leading =
    doc.type === 'open'
      ? (liveBids.find((bid) => bid.status === 'leading') ?? null)
      : null
  const labels = anonymizedLabels(bids)
  const toEntry = (bid: Bid): BidLogEntry => ({
    bidId: bid.id,
    amount: centsToEuros(bid.amountCents),
    label: `Pakkuja #${String(labels.get(bid.id) ?? 0)}`,
    createdAt: bid.createdAt,
    isAutobid: bid.source === 'autobidder',
  })

  const pending = liveBids
    .filter((bid) => bid.status === 'pending_approval')
    .sort(byNewestFirst)
    .map(toEntry)
  const bidLog = [...liveBids]
    .sort(byNewestFirst)
    .slice(0, BID_LOG_LIMIT)
    .map(toEntry)

  return {
    id: doc.id,
    title: doc.title,
    slug: doc.slug,
    objectType: doc.objectType,
    type: doc.type,
    status: doc.status,
    startPrice: centsToEuros(doc.minBidCents),
    finalPrice: doc.finalPriceCents === null ? null : centsToEuros(doc.finalPriceCents),
    leadingPrice: leading === null ? null : centsToEuros(leading.amountCents),
    bidCount: liveBids.length,
    pendingApprovalCount: pending.length,
    views: null,
    countyName,
    areaHa: doc.areaHa,
    startsAt: doc.startsAt,
    endsAt: doc.endsAt,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    pending,
    bidLog,
  }
}

export async function loadSellerOverview(
  repositories: CoreRepositories,
  sellerId: string,
): Promise<SellerAuctionRow[]> {
  const auctionsResult = await repositories.find({
    collection: 'auctions',
    where: { seller: { equals: sellerId } },
    sort: '-createdAt',
    pagination: false,
  })
  const auctions = auctionsResult.docs

  // County names for the demo card sub line ("<county> · <area> · <type>");
  // lots without a county simply omit the part.
  const countyIds = [
    ...new Set(auctions.map((auction) => auction.countyId).filter((id) => id !== null)),
  ]
  const countyNames = new Map<string, string>()
  if (countyIds.length > 0) {
    const countiesResult = await repositories.find({
      collection: 'counties',
      pagination: false,
    })
    for (const county of countiesResult.docs) {
      if (countyIds.includes(county.id)) countyNames.set(county.id, county.name)
    }
  }

  const bidsByAuction = new Map<string, Bid[]>()
  if (auctions.length > 0) {
    const bidsResult = await repositories.find({
      collection: 'bids',
      where: { auction: { in: auctions.map((auction) => auction.id) } },
      pagination: false,
    })
    for (const bid of bidsResult.docs) {
      const list = bidsByAuction.get(bid.auctionId) ?? []
      list.push(bid)
      bidsByAuction.set(bid.auctionId, list)
    }
  }

  return auctions.map((doc) =>
    buildRow(
      doc,
      bidsByAuction.get(doc.id) ?? [],
      doc.countyId === null ? null : (countyNames.get(doc.countyId) ?? null),
    ),
  )
}

export function parseStatusTab(raw: string | null): StatusTab {
  const value = (raw ?? 'all').trim().toLowerCase()
  return (STATUS_TABS as readonly string[]).includes(value)
    ? (value as StatusTab)
    : 'all'
}

export function filterRowsByStatus(
  rows: SellerAuctionRow[],
  tab: StatusTab,
): SellerAuctionRow[] {
  if (tab === 'all') return rows
  const allowed = STATUS_TAB_FILTERS[tab]
  return rows.filter((row) => allowed.includes(row.status))
}
