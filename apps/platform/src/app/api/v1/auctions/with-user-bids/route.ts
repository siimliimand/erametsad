import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { AuctionDoc, CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories'
import type {
  AuctionObjectType,
  AuctionStatus,
  Bid,
  BidStatus,
  County,
} from '@/lib/data/schema'
import { getRepositories } from '@/lib/data/runtime'

// Bids carry only userId (no profile column), so this endpoint scopes to the
// session user, not the active profile — the data model cannot express
// profile-level bid rows.

const ACTIVE_GROUP_STATUSES: readonly AuctionStatus[] = ['scheduled', 'active']

interface WithUserBidsRow {
  auction: {
    id: string
    title: string
    objectType: AuctionObjectType
    auctionStatus: AuctionStatus
    endsAt: string | null
    county: { id: string; name: string; code: string } | null
  }
  myBid: { amountEur: number; status: BidStatus; createdAt: string } | null
  leadingAmountEur: number | null
  outcome?: 'won' | 'lost' | 'unsold'
  finalPriceEur?: number | null
}

/** Current effective bid: leading first, then pending alapakkumine, then the newest other non-rejected bid. */
function standingBid(auctionBids: Bid[]): Bid | null {
  const candidates = auctionBids.filter((bid) => bid.status !== 'rejected')
  const byNewest = [...candidates].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1
    return a.id < b.id ? 1 : -1
  })
  return (
    byNewest.find((bid) => bid.status === 'leading') ??
    byNewest.find((bid) => bid.status === 'pending_approval') ??
    byNewest[0] ??
    null
  )
}

/**
 * Outcome from the auction's final state: `unsold` wins over everything,
 * ceremony-set bid statuses (sealed) next, then the winningBid id. Sealed
 * auctions waiting for the admin opening ceremony have no outcome yet.
 */
function outcomeOf(
  auction: AuctionDoc,
  auctionBids: Bid[],
): 'won' | 'lost' | 'unsold' | undefined {
  if (auction.status === 'unsold') return 'unsold'
  if (auctionBids.some((bid) => bid.status === 'won')) return 'won'
  if (auctionBids.some((bid) => bid.status === 'lost')) return 'lost'
  if (auction.winningBid !== null) {
    return auctionBids.some((bid) => bid.id === auction.winningBid) ? 'won' : 'lost'
  }
  return undefined
}

async function loadRows(
  repos: CoreRepositories,
  userId: string,
): Promise<WithUserBidsRow[]> {
  const [bidsResult, countiesResult] = await Promise.all([
    repos.find({
      collection: 'bids',
      where: { user: { equals: userId } },
      pagination: false,
      sort: 'createdAt',
    }),
    repos.find({ collection: 'counties', pagination: false }),
  ])

  const bidsByAuction = new Map<string, Bid[]>()
  for (const bid of bidsResult.docs) {
    const group = bidsByAuction.get(bid.auctionId)
    if (group) group.push(bid)
    else bidsByAuction.set(bid.auctionId, [bid])
  }
  const auctionIds = [...bidsByAuction.keys()]
  if (auctionIds.length === 0) return []

  const countyById = new Map<string, County>(countiesResult.docs.map((c) => [c.id, c]))

  const [auctionsResult, leadingResult] = await Promise.all([
    repos.find({
      collection: 'auctions',
      where: { id: { in: auctionIds } },
      pagination: false,
      sort: 'id',
    }),
    repos.find({
      collection: 'bids',
      where: { auction: { in: auctionIds }, status: { equals: 'leading' } },
      pagination: false,
    }),
  ])

  const leadingCentsByAuction = new Map<string, number>()
  for (const bid of leadingResult.docs) {
    leadingCentsByAuction.set(bid.auctionId, bid.amountCents)
  }

  const rows: WithUserBidsRow[] = []
  for (const auction of auctionsResult.docs) {
    if (auction.status === 'draft') continue
    const auctionBids = bidsByAuction.get(auction.id) ?? []
    const standing = standingBid(auctionBids)
    const leadingCents = leadingCentsByAuction.get(auction.id)
    const row: WithUserBidsRow = {
      auction: {
        id: auction.id,
        title: auction.title,
        objectType: auction.objectType,
        auctionStatus: auction.status,
        endsAt: auction.endsAt,
        county: auction.countyId === null ? null : (countyById.get(auction.countyId) ?? null),
      },
      myBid: standing
        ? {
            amountEur: centsToEuros(standing.amountCents),
            status: standing.status,
            createdAt: standing.createdAt,
          }
        : null,
      // Open auctions only — never disclose any amounts for sealed.
      leadingAmountEur:
        auction.type === 'open' && leadingCents !== undefined
          ? centsToEuros(leadingCents)
          : null,
    }
    if (!ACTIVE_GROUP_STATUSES.includes(auction.status)) {
      const outcome = outcomeOf(auction, auctionBids)
      if (outcome !== undefined) row.outcome = outcome
      row.finalPriceEur =
        auction.finalPriceCents === null ? null : centsToEuros(auction.finalPriceCents)
    }
    rows.push(row)
  }
  return rows
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  try {
    const repos = await getRepositories()
    const rows = await loadRows(repos, payload.userId)
    const active = rows.filter((row) => ACTIVE_GROUP_STATUSES.includes(row.auction.auctionStatus))
    const ended = rows.filter(
      (row) => !ACTIVE_GROUP_STATUSES.includes(row.auction.auctionStatus),
    )
    return NextResponse.json({ active, ended })
  } catch (error) {
    console.error('[auctions/with-user-bids] query failed', error)
    return NextResponse.json({ error: 'Serveri viga' }, { status: 500 })
  }
}
