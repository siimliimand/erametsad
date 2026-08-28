import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isAdminRole, verifyAccessToken } from '@/lib/auth/jwt'
import { approveAlapakkumine } from '@/lib/bidding/alapakkumine'
import { getRepositories } from '@/lib/data/runtime'
import { pushNotification, pushOutbid } from '@/lib/realtime/my-stream'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; bidId: string }> },
) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  const { id: auctionId, bidId } = await params

  // Seller identity comes from the auction row; the role comes from the
  // JWT claims. Either the seller or an admin may decide.
  const repos = await getRepositories()
  const auctions = await repos.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
  })
  const auction = auctions.docs[0] as Record<string, unknown> | undefined
  if (!auction) {
    return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
  }
  const rawSeller = auction.sellerId
  const sellerId = typeof rawSeller === 'string' ? rawSeller : ''
  if (sellerId !== tokenPayload.userId && !isAdminRole(tokenPayload.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let decision: Awaited<ReturnType<typeof approveAlapakkumine>>
  try {
    decision = await approveAlapakkumine(auctionId, bidId)
  } catch (error) {
    console.error('[underbids/approve] approveAlapakkumine failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  switch (decision.outcome) {
    case 'approved': {
      pushNotification(decision.bid.bidderId, {
        event: 'bid.approved',
        title: 'Teie pakkumus on kinnitatud',
        body: `Pakkumus ${String(decision.bid.amount)} EUR oksjonil "${decision.bid.auctionTitle}" on nüüd juhtiv.`,
      })
      if (decision.displacedLeader) {
        pushOutbid(decision.displacedLeader.userId, {
          auctionId,
          auctionTitle: decision.bid.auctionTitle,
          previousAmount: decision.displacedLeader.amount,
          newAmount: decision.bid.amount,
        })
      }
      return NextResponse.json({ success: true, bidId, status: 'leading' }, { status: 200 })
    }
    case 'not_pending':
      return NextResponse.json(
        { error: 'Bid is not pending approval', status: decision.status },
        { status: 409 },
      )
    case 'auction_not_active':
      return NextResponse.json({ error: 'Auction is not active' }, { status: 409 })
    case 'bid_not_found':
      return NextResponse.json({ error: 'Bid not found' }, { status: 404 })
    case 'auction_not_found':
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
  }
}
