import type { Metadata } from 'next'

import { UserPageHead } from '../_components/UserPageHead'
import { BidsView } from './_components/bids-view'
import {
  ACTIVE_GROUP_STATUSES,
  filtersFromOlek,
  filtersFromTab,
  type BidFilterId,
  type MyBidRow,
} from './_components/types'

import { requirePortalSession } from '@/app/(portal)/_lib/session'
import type { AuctionDoc, CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { Bid, County } from '@/lib/data/schema'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Minu pakkumised',
}

interface BidsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// Same shaping as GET /api/v1/auctions/with-user-bids, read directly from
// the repositories to avoid a self-fetch (profile page pattern). Four row
// fields the API row omits are added for this page: auctionType (AVATUD/
// SULETUD badge, sealed masking), minBidEur and bidStepEur (autobidder
// floor hint) and areaHa (demo sub line). Reads run as system context
// scoped by the verified session user id — the guarded repositories would
// hide rival leading bids. Bids carry only userId, so scoping is by user,
// not the active profile.
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

function outcomeOf(
  auction: AuctionDoc,
  auctionBids: Bid[],
): 'won' | 'lost' | 'unsold' | undefined {
  if (auction.status === 'unsold') return 'unsold'
  if (auctionBids.some((bid) => bid.status === 'won')) return 'won'
  if (auctionBids.some((bid) => bid.status === 'lost')) return 'lost'
  if (auction.winningBid !== null) {
    return auctionBids.some((bid) => bid.id === auction.winningBid)
      ? 'won'
      : 'lost'
  }
  return undefined
}

function toRow(
  auction: AuctionDoc,
  auctionBids: Bid[],
  leadingCents: number | undefined,
  countyById: Map<string, County>,
): MyBidRow {
  const standing = standingBid(auctionBids)
  const row: MyBidRow = {
    auction: {
      id: auction.id,
      title: auction.title,
      objectType: auction.objectType,
      auctionStatus: auction.status,
      auctionType: auction.type,
      endsAt: auction.endsAt,
      minBidEur: centsToEuros(auction.minBidCents),
      bidStepEur:
        auction.bidStepCents === null
          ? null
          : centsToEuros(auction.bidStepCents),
      areaHa: auction.areaHa ?? null,
      county:
        auction.countyId === null
          ? null
          : (countyById.get(auction.countyId) ?? null),
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
      auction.finalPriceCents === null
        ? null
        : centsToEuros(auction.finalPriceCents)
  }
  return row
}

function byEndsAtAsc(a: MyBidRow, b: MyBidRow): number {
  if (a.auction.endsAt === null || b.auction.endsAt === null) {
    return a.auction.endsAt === null ? 1 : -1
  }
  return a.auction.endsAt < b.auction.endsAt ? -1 : 1
}

function byEndsAtDesc(a: MyBidRow, b: MyBidRow): number {
  return byEndsAtAsc(b, a)
}

// A won auction whose contract is prepared but not yet signed shows the
// "Leping allkirja ootel" pill and the signing action on its card. Prepare
// binds the owner at creation, so signedBy scopes live rows (same query as
// the /lepingud list).
async function markPendingContracts(
  repos: CoreRepositories,
  userId: string,
  rows: MyBidRow[],
): Promise<void> {
  const wonIds = rows
    .filter((row) => row.outcome === 'won')
    .map((row) => row.auction.id)
  if (wonIds.length === 0) return

  const pendingResult = await repos.find({
    collection: 'contracts',
    where: {
      and: [
        { signedBy: { equals: userId } },
        { status: { in: ['prepared', 'sent'] } },
        { lot: { in: wonIds } },
      ],
    },
    pagination: false,
  })
  const pendingLots = new Set(
    pendingResult.docs.map((contract) => contract.lotId),
  )
  for (const row of rows) {
    if (row.outcome === 'won' && pendingLots.has(row.auction.id)) {
      row.contractPending = true
    }
  }
}

async function loadRows(
  repos: CoreRepositories,
  userId: string,
): Promise<{ active: MyBidRow[]; ended: MyBidRow[] }> {
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
  if (auctionIds.length === 0) return { active: [], ended: [] }

  const countyById = new Map<string, County>(
    countiesResult.docs.map((county) => [county.id, county]),
  )

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

  const rows: MyBidRow[] = []
  for (const auction of auctionsResult.docs) {
    if (auction.status === 'draft') continue
    rows.push(
      toRow(
        auction,
        bidsByAuction.get(auction.id) ?? [],
        leadingCentsByAuction.get(auction.id),
        countyById,
      ),
    )
  }

  await markPendingContracts(repos, userId, rows)

  return {
    active: rows
      .filter((row) =>
        ACTIVE_GROUP_STATUSES.includes(row.auction.auctionStatus),
      )
      .sort(byEndsAtAsc),
    ended: rows
      .filter(
        (row) => !ACTIVE_GROUP_STATUSES.includes(row.auction.auctionStatus),
      )
      .sort(byEndsAtDesc),
  }
}

// Chips keep the filter URL-addressable: `olek` carries the pressed chip ids,
// the removed tab values map onto chips for old deep links.
function initialFiltersOf(params: Record<string, string | string[] | undefined>): BidFilterId[] {
  const rawOlek = Array.isArray(params.olek) ? params.olek[0] : params.olek
  if (rawOlek !== undefined) return filtersFromOlek(rawOlek)
  const rawTab = Array.isArray(params.tab) ? params.tab[0] : params.tab
  return filtersFromTab(rawTab)
}

export default async function UserBidsPage({ searchParams }: BidsPageProps) {
  const { session } = await requirePortalSession('/user/bids')
  const params = await searchParams
  const initialFilters = initialFiltersOf(params)

  const repos = await getRepositories()
  const { active, ended } = await loadRows(repos, session.userId)

  return (
    <>
      <UserPageHead
        title="Minu pakkumised"
        summary="Ülevaade sinu osalemisest oksjonitel — käimasolevad pakkumised, tulemused ja automaatpakkuja seaded."
      />
      <section className="py-6 md:py-8">
        <BidsView
          initialFilters={initialFilters}
          initialActive={active}
          ended={ended}
        />
      </section>
    </>
  )
}
