import { getCloudflareContext } from '@opennextjs/cloudflare'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { checkAntiSnipe } from '@/lib/bidding/anti-snipe'
import { evaluateAutobidders } from '@/lib/bidding/autobidder'
import { parseIdentitySnapshot } from '@/lib/bidding/identity-snapshot'
import { placeBid } from '@/lib/bidding/place-bid'
import type { BidResult } from '@/lib/bidding/place-bid'
import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'
import { emitAuctionExtended, emitBidCreated } from '@/lib/realtime/auction-stream'
import { pushOutbid } from '@/lib/realtime/my-stream'

// Minimal DO namespace surface (same local-declaration approach as
// src/lib/rate-limit.ts, so the route never imports cloudflare:workers).
interface AuctionDONamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> }
}

declare global {
  interface CloudflareEnv {
    /** AuctionDO binding from wrangler.jsonc durable_objects (task 3.7). */
    AUCTION?: AuctionDONamespace
  }
}

interface AuctionDOAdmission {
  allowed: boolean
  bid?: Record<string, unknown>
  error?: string
  status?: number
  code?: 'framework_contract_required' | 'revision_cap_exceeded'
  redirectUrl?: string
  replayed?: boolean
  previousLeading?: { userId: string; amount: number } | null
  autobid?: { userId: string; amount: number; placedAt: string } | null
  extended?: { previousEndsAt: string; endsAt: string; windowMinutes: number } | null
}

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

/**
 * Bid admission through the AuctionDO, the serialization authority for
 * the auction. Returns null when the DO is unreachable (binding absent
 * until task 3.7, or transport failure) so the caller can fall back to
 * the legacy in-process path.
 */
async function admitViaAuctionDO(input: {
  userId: string
  auctionId: string
  amount: number
  type: string
  idempotencyKey?: string
  identitySnapshot?: string
  requestIp: string
}): Promise<AuctionDOAdmission | null> {
  let namespace: AuctionDONamespace | undefined
  try {
    const context = await getCloudflareContext({ async: true })
    namespace = context.env.AUCTION
  } catch {
    return null
  }
  if (!namespace) return null

  try {
    const stub = namespace.get(namespace.idFromName(input.auctionId))
    const response = await stub.fetch(`https://auction-do/${input.auctionId}/bid`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: input.userId,
        amount: input.amount,
        type: input.type,
        ...(input.idempotencyKey !== undefined
          ? { idempotencyKey: input.idempotencyKey }
          : {}),
        ...(input.identitySnapshot !== undefined
          ? { identitySnapshot: input.identitySnapshot }
          : {}),
        requestIp: input.requestIp,
      }),
    })
    const payload = (await response.json()) as Record<string, unknown>
    if (!response.ok) {
      let errorMessage: string | undefined
      if (typeof payload.error === 'string') {
        errorMessage = payload.error
      }
      return {
        allowed: false,
        error: errorMessage ?? 'AuctionDO rejected the request',
        status: response.status,
      }
    }
    return payload as unknown as AuctionDOAdmission
  } catch (error) {
    console.error('[bids/create] AuctionDO fetch failed', error)
    return null
  }
}

// Mirrors the DO's admitted bid onto the legacy in-memory SSE hubs. The
// AuctionDO owns admission, autobidders, and the endsAt update; these
// pushes keep the pre-3.5 streams alive until they are rebuilt on DO
// events. Payload shapes match auction-stream.ts / my-stream.ts exactly.
function mirrorAcceptedBidOnStreams(admission: AuctionDOAdmission): void {
  const bid = admission.bid
  if (!bid) return
  if (bid.status !== 'leading') return

  const auctionId = bid.auction as string
  const amount = bid.amount as number
  const placedAt = (bid.createdAt as string | Date | undefined) ?? new Date()

  emitBidCreated({ auctionId, amount, placedAt })

  if (admission.previousLeading) {
    pushOutbid(admission.previousLeading.userId, {
      auctionId,
      previousAmount: admission.previousLeading.amount,
      newAmount: amount,
      placedAt,
    })
  }

  if (admission.extended) {
    emitAuctionExtended({
      auctionId,
      previousEndsAt: admission.extended.previousEndsAt,
      endsAt: admission.extended.endsAt,
    })
  }

  if (admission.autobid) {
    emitBidCreated({
      auctionId,
      amount: admission.autobid.amount,
      placedAt: admission.autobid.placedAt,
    })
    pushOutbid(bid.user as string | number, {
      auctionId,
      previousAmount: amount,
      newAmount: admission.autobid.amount,
      placedAt: admission.autobid.placedAt,
    })
  }
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

  let identitySnapshot: string | undefined
  if (body.identitySnapshot !== undefined) {
    const snapshot = parseIdentitySnapshot(body.identitySnapshot)
    if (!snapshot.ok) {
      return NextResponse.json({ error: snapshot.error }, { status: 400 })
    }
    identitySnapshot = snapshot.snapshot
  }

  const requestIp = request.headers.get('x-forwarded-for') ?? 'unknown'

  const admission = await admitViaAuctionDO({
    userId: tokenPayload.userId,
    auctionId,
    amount,
    type,
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    ...(identitySnapshot !== undefined ? { identitySnapshot } : {}),
    requestIp,
  })

  if (admission !== null) {
    console.log('[bids/create] AuctionDO admission', {
      auctionId,
      allowed: admission.allowed,
      status: admission.status,
      bidStatus: admission.bid?.status,
      replayed: admission.replayed ?? false,
    })

    if (!admission.allowed) {
      if (admission.code === 'framework_contract_required') {
        return NextResponse.json(
          {
            error: admission.error,
            code: admission.code,
            redirectUrl: admission.redirectUrl ?? '/lepingud/raamleping',
          },
          { status: admission.status ?? 403 },
        )
      }
      return NextResponse.json(
        {
          error: admission.error ?? 'Bid rejected',
          // Coded rejections (revision_cap_exceeded) must reach the client
          // so the panel can lock revisions; uncoded ones stay code-free.
          ...(admission.code !== undefined ? { code: admission.code } : {}),
        },
        { status: admission.status ?? 400 },
      )
    }

    mirrorAcceptedBidOnStreams(admission)
    return NextResponse.json(admission.bid, { status: 201 })
  }

  // Fallback while the AUCTION binding is not deployed (task 3.7): the
  // legacy in-process admission path, unchanged.
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
      requestIp,
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
      ...(identitySnapshot !== undefined ? { identitySnapshot } : {}),
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
          redirectUrl: result.redirectUrl ?? '/lepingud/raamleping',
        },
        { status: 403 },
      )
    }
    return NextResponse.json(
      {
        error: result.error,
        ...(result.code !== undefined ? { code: result.code } : {}),
      },
      { status: result.status },
    )
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
