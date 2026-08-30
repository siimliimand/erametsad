import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories'
import type { AuctionDoc } from '@/lib/data/repositories/registry'
import type { Bid } from '@/lib/data/schema'

// Mirrors the STATUS_TABS mapping in /api/v1/my-auctions; the page and the
// API must agree on which auction statuses each seller tab covers.
export type StatusTab = 'all' | 'draft' | 'scheduled' | 'active' | 'ended'

export const STATUS_TABS: readonly StatusTab[] = [
  'all',
  'draft',
  'scheduled',
  'active',
  'ended',
]

const STATUS_TAB_FILTERS: Record<StatusTab, readonly string[]> = {
  all: [],
  draft: ['draft'],
  scheduled: ['scheduled'],
  active: ['active'],
  ended: ['ended', 'appraised', 'unsold', 'contract', 'completed', 'archived'],
}

export type StatusTabCounts = Record<StatusTab, number>

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
  views: null
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

function buildRow(doc: AuctionDoc, bids: Bid[]): SellerAuctionRow {
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

  return auctions.map((doc) => buildRow(doc, bidsByAuction.get(doc.id) ?? []))
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

export function countRowsByStatus(rows: SellerAuctionRow[]): StatusTabCounts {
  const counts: StatusTabCounts = {
    all: rows.length,
    draft: 0,
    scheduled: 0,
    active: 0,
    ended: 0,
  }
  for (const [tab, statuses] of Object.entries(STATUS_TAB_FILTERS)) {
    if (tab === 'all') continue
    counts[tab as Exclude<StatusTab, 'all'>] = rows.filter((row) =>
      statuses.includes(row.status),
    ).length
  }
  return counts
}
