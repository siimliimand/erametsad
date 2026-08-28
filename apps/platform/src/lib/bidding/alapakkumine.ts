import type { Payload } from 'payload'

import { db } from '../db'
import { bidStatusUpdateStatement } from './place-bid'
import { getPayloadClient } from '../../payload/payloadClient'
import { eventBus } from '../notifications/event-bus'
import type { DomainEvent } from '../notifications/event-bus'

export interface AlapakkumineResult {
  status: string
  requiresApproval: boolean
}

export function isAlapakkumineEnabled(
  settings: { alapakkumineEnabled?: boolean } | null | undefined,
): boolean {
  return settings?.alapakkumineEnabled === true
}

type AlapakkumineCollection = 'users' | 'auctions' | 'bids'

async function findDoc(
  payload: Payload,
  collection: AlapakkumineCollection,
  where: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const result = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
  } as Parameters<Payload['find']>[0])
  return (result.docs[0] as Record<string, unknown> | undefined) ?? null
}

function relationValue(value: unknown): string | number {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return ''
}

export interface UnderbidBidInfo {
  bidId: string
  bidderId: string
  amount: number
  auctionTitle: string
}

export type UnderbidFailure =
  | { outcome: 'not_pending'; status: string }
  | { outcome: 'bid_not_found' }
  | { outcome: 'auction_not_found' }
  | { outcome: 'auction_not_active' }

export type ApproveDecision =
  | {
      outcome: 'approved'
      bid: UnderbidBidInfo
      displacedLeader: { userId: string; amount: number } | null
    }
  | UnderbidFailure

export type RejectDecision =
  { outcome: 'rejected'; bid: UnderbidBidInfo } | UnderbidFailure

// Seller decisions previously serialised against bids through the auction
// row lock (withAuctionLock). That lock is deleted; the AuctionDO durable
// object restores per-auction serialisation from task 3.2. Until then the
// status guard on each UPDATE keeps a racing decision from acting on a bid
// that already changed state.
export async function approveAlapakkumine(
  auctionId: string,
  bidId: string,
): Promise<ApproveDecision> {
  const payload = await getPayloadClient()
  const events: DomainEvent[] = []
  const now = new Date().toISOString()

  const bid = await findDoc(payload, 'bids', { id: { equals: bidId } })
  if (!bid || String(relationValue(bid.auction)) !== auctionId) {
    return { outcome: 'bid_not_found' }
  }
  if (bid.status !== 'pending_approval') {
    return { outcome: 'not_pending', status: String(bid.status) }
  }

  const auction = await findDoc(payload, 'auctions', {
    id: { equals: auctionId },
  })
  if (!auction) {
    return { outcome: 'auction_not_found' }
  }
  // An approval must never inject a new leader into an auction that the
  // ending worker already processed.
  if (auction.status !== 'active') {
    return { outcome: 'auction_not_active' }
  }

  const auctionTitle =
    (auction.title as string | undefined) ?? `Auction ${auctionId}`
  const amount = bid.amount as number
  const bidderId = relationValue(bid.user)

  // Per spec the approval wins the lead even over a higher legitimate
  // bid; the displaced leader is demoted in the same atomic D1 batch.
  const leading = await findDoc(payload, 'bids', {
    and: [
      { auction: { equals: auctionId } },
      { status: { equals: 'leading' } },
    ],
  })

  const results = await db.batch([
    ...(leading
      ? [bidStatusUpdateStatement(String(leading.id), 'leading', 'outbid', now)]
      : []),
    bidStatusUpdateStatement(bidId, 'pending_approval', 'leading', now),
  ])
  const promoteResult = results[results.length - 1]
  if (
    !promoteResult ||
    (promoteResult.meta.changes as number | undefined) === 0
  ) {
    // A racing decision changed the bid between the read above and this
    // write; the guard blocked the update, so report the conflict.
    return { outcome: 'not_pending', status: 'pending_approval' }
  }

  if (leading) {
    events.push({
      type: 'outbid',
      userId: relationValue(leading.user),
      payload: { auctionId, auctionTitle, currentBid: amount },
    })
  }

  events.push({
    type: 'bid.approved',
    userId: bidderId,
    payload: { auctionId, auctionTitle, bidId, amount },
  })

  // Emit only after the D1 batch succeeded; a failed decision never
  // notifies anyone.
  for (const event of events) {
    eventBus.emit(event)
  }

  return {
    outcome: 'approved',
    bid: { bidId, bidderId: String(bidderId), amount, auctionTitle },
    displacedLeader: leading
      ? {
          userId: String(relationValue(leading.user)),
          amount: leading.amount as number,
        }
      : null,
  }
}

export async function rejectAlapakkumine(
  auctionId: string,
  bidId: string,
): Promise<RejectDecision> {
  const payload = await getPayloadClient()
  const events: DomainEvent[] = []
  const now = new Date().toISOString()

  const bid = await findDoc(payload, 'bids', { id: { equals: bidId } })
  if (!bid || String(relationValue(bid.auction)) !== auctionId) {
    return { outcome: 'bid_not_found' }
  }
  if (bid.status !== 'pending_approval') {
    return { outcome: 'not_pending', status: String(bid.status) }
  }

  const auction = await findDoc(payload, 'auctions', {
    id: { equals: auctionId },
  })
  if (!auction) {
    return { outcome: 'auction_not_found' }
  }

  const auctionTitle =
    (auction.title as string | undefined) ?? `Auction ${auctionId}`
  const amount = bid.amount as number
  const bidderId = relationValue(bid.user)

  const statement = bidStatusUpdateStatement(
    bidId,
    'pending_approval',
    'rejected',
    now,
  )
  const result = await db.query(statement.sql, statement.params)
  if ((result.meta.changes as number | undefined) === 0) {
    // A racing decision changed the bid between the read above and this
    // write; the guard blocked the update, so report the conflict.
    return { outcome: 'not_pending', status: 'pending_approval' }
  }

  events.push({
    type: 'bid.rejected',
    userId: bidderId,
    payload: { auctionId, auctionTitle, bidId, amount },
  })

  for (const event of events) {
    eventBus.emit(event)
  }

  return {
    outcome: 'rejected',
    bid: { bidId, bidderId: String(bidderId), amount, auctionTitle },
  }
}
