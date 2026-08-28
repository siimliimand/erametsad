import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { checkAntiSnipe } from '@/lib/bidding/anti-snipe'
import { evaluateAutobidders } from '@/lib/bidding/autobidder'
import { placeBid } from '@/lib/bidding/place-bid'
import type { BidResult } from '@/lib/bidding/place-bid'
import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'
import { emitBidCreated } from '@/lib/realtime/auction-stream'
import { pushOutbid } from '@/lib/realtime/my-stream'

type RouteCollection = 'auctions' | 'bids'

async function findDoc(
  repos: CoreRepositories,
  collection: RouteCollection,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const result = await repos.find({
    collection,
    where: where as never,
    limit: 1,
  })
  return (result.docs[0] as Record<string, unknown> | undefined) ?? null
}

function findLeadingBid(
  repos: CoreRepositories,
  auctionId: string,
): Promise<Record<string, unknown> | null> {
  return findDoc(repos, 'bids', {
    and: [
      { auction: { equals: auctionId } },
      { status: { equals: 'leading' } },
    ],
  })
}

// placeBid already emitted the bid.created and outbid DomainEvents
// post-commit, so the accepted-bid path only adds the SSE broadcasts and
// the my-stream pushes.
async function handleAcceptedBid(input: {
  repos: CoreRepositories
  auctionId: string
  actorId: string
  bid: Record<string, unknown>
  previousLeading: Record<string, unknown> | null
}): Promise<void> {
  const { repos, auctionId, actorId, bid, previousLeading } = input
  const amount = bid.amount as number
  const placedAt = (bid.createdAt as string | Date | undefined) ?? new Date()

  emitBidCreated({ auctionId, amount, placedAt })

  if (previousLeading) {
    pushOutbid(previousLeading.userId as string | number, {
      auctionId,
      previousAmount: centsToEuros(previousLeading.amountCents as number),
      newAmount: amount,
      placedAt,
    })
  }

  // checkAntiSnipe owns the endsAt update, the audit entry and the
  // auction:extended broadcast; sealed auctions never extend.
  const auction = await findDoc(repos, 'auctions', { id: { equals: auctionId } })
  if (auction) {
    await checkAntiSnipe(
      {
        id: auctionId,
        endsAt: auction.endsAt as string | Date,
        ...(auction.type !== undefined ? { type: auction.type as string | null } : {}),
      },
      undefined,
      { actorId, triggeredByBidId: bid.id as string },
    )
  }

  await evaluateAutobidders(auctionId)

  // An autobidder bid placed by evaluateAutobidders goes through the same
  // broadcast path. Its outbid DomainEvent was already emitted by the
  // placeBid call inside evaluateAutobidders.
  const leading = await findLeadingBid(repos, auctionId)
  if (leading?.source === 'autobidder') {
    const autobidAmount = centsToEuros(leading.amountCents as number)
    const autobidPlacedAt = (leading.createdAt as string | Date | undefined) ?? new Date()
    emitBidCreated({ auctionId, amount: autobidAmount, placedAt: autobidPlacedAt })
    pushOutbid(bid.user as string | number, {
      auctionId,
      previousAmount: amount,
      newAmount: autobidAmount,
      placedAt: autobidPlacedAt,
    })
  }
}

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const auctionId = body.auctionId as string | undefined
  const amount = body.amount as number | undefined
  const type = body.type as string | undefined
  const idempotencyKey = body.idempotencyKey as string | undefined

  if (!auctionId || typeof auctionId !== 'string') {
    return NextResponse.json({ error: 'auctionId is required' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount < 0) {
    return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
  }
  if (type !== 'open' && type !== 'sealed') {
    return NextResponse.json({ error: 'type must be open or sealed' }, { status: 400 })
  }

  let previousLeading: Record<string, unknown> | null = null
  let result: BidResult
  try {
    const repos = await getRepositories()
    // Read the leader before placeBid so the outbid push targets the user
    // this bid displaced.
    previousLeading = await findLeadingBid(repos, auctionId)
    result = await placeBid({
      userId: tokenPayload.userId,
      auctionId,
      amount,
      type,
      source: 'manual',
      requestIp: request.headers.get('x-forwarded-for') ?? 'unknown',
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    })
  } catch (error) {
    console.error('[bids/create] placeBid failed', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  if (!result.success) {
    if (result.code === 'framework_contract_required') {
      return NextResponse.json(
        {
          error: result.error,
          code: result.code,
          redirectUrl: result.redirectUrl ?? '/contracts/framework',
        },
        { status: 403 },
      )
    }
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  const bid = result.bid
  // Under-start bids wait for seller approval and never take the lead, so
  // the engine follow-ups only apply to accepted (leading) bids.
  if (bid.status === 'leading') {
    try {
      const repos = await getRepositories()
      await handleAcceptedBid({
        repos,
        auctionId,
        actorId: tokenPayload.userId,
        bid,
        previousLeading,
      })
    } catch (error) {
      console.error('[bids/create] post-bid processing failed', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }

  return NextResponse.json(bid, { status: 201 })
}
