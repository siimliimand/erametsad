import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories'
import type { AuctionDoc } from '@/lib/data/repositories/registry'
import { getRepositories } from '@/lib/data/runtime'
import type { AuctionStatus, Bid } from '@/lib/data/schema'

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

// Seller status tabs (Kõik/Mustand/Plaanis/Aktiivsed/Lõppenud) mapped onto
// the auctionStatus values from status-transitions.ts.
const STATUS_TABS: Readonly<Record<string, readonly AuctionStatus[] | undefined>> = {
  all: undefined,
  draft: ['draft'],
  scheduled: ['scheduled'],
  active: ['active'],
  ended: ['ended', 'appraised', 'unsold', 'contract', 'completed', 'archived'],
}

interface MyAuctionRow {
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
}

async function authenticate(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload.userId
}

async function loadSellerAuctionRows(
  repos: CoreRepositories,
  sellerId: string,
  statuses: readonly AuctionStatus[] | undefined,
): Promise<MyAuctionRow[]> {
  const result = await repos.find({
    collection: 'auctions',
    where: {
      seller: { equals: sellerId },
      ...(statuses ? { status: { in: [...statuses] } } : {}),
    },
    sort: '-createdAt',
    pagination: false,
  })
  const auctions = result.docs

  const auctionIds = auctions.map((doc) => doc.id)
  const bidsByAuction = new Map<string, Bid[]>()
  if (auctionIds.length > 0) {
    const bidsResult = await repos.find({
      collection: 'bids',
      where: { auction: { in: auctionIds } },
      pagination: false,
    })
    for (const bid of bidsResult.docs) {
      const list = bidsByAuction.get(bid.auctionId) ?? []
      list.push(bid)
      bidsByAuction.set(bid.auctionId, list)
    }
  }

  return auctions.map((doc: AuctionDoc) => {
    const bids = bidsByAuction.get(doc.id) ?? []
    const liveBids = bids.filter((bid) => bid.status !== 'rejected')
    const leading =
      doc.type === 'open'
        ? (liveBids.find((bid) => bid.status === 'leading') ?? null)
        : null
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
      pendingApprovalCount: liveBids.filter((bid) => bid.status === 'pending_approval').length,
      // No per-auction view counter exists: the auctions table has no views
      // column and statistics_snapshots aggregates by date+objectType only.
      views: null,
      startsAt: doc.startsAt,
      endsAt: doc.endsAt,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  })
}

export async function GET(request: NextRequest) {
  const sellerId = await authenticate(request)
  if (!sellerId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const rawStatus = (searchParams.get('status') ?? 'all').trim().toLowerCase()
  const statuses = STATUS_TABS[rawStatus]
  if (statuses === undefined && rawStatus !== 'all') {
    return NextResponse.json({ error: 'Vale oleku filter' }, { status: 400 })
  }

  const rawPage = Number(searchParams.get('page') ?? '1')
  const rawLimit = Number(searchParams.get('limit') ?? String(DEFAULT_LIMIT))
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.floor(rawLimit), 1), MAX_LIMIT)
    : DEFAULT_LIMIT

  const repos = await getRepositories()
  const rows = await loadSellerAuctionRows(repos, sellerId, statuses ?? undefined)

  const total = rows.length
  const totalPages = Math.max(Math.ceil(total / limit), 1)
  const currentPage = Math.min(page, totalPages)
  const start = (currentPage - 1) * limit

  return NextResponse.json({
    items: rows.slice(start, start + limit),
    total,
    page: currentPage,
    limit,
    totalPages,
  })
}
