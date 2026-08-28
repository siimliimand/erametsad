import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { getPayloadClient } from '../../payload/payloadClient'
import { eventBus } from '../notifications/event-bus'
import type { DomainEvent } from '../notifications/event-bus'
import { withAuctionLock } from './place-bid'

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
  return String((value as { id?: string | number })?.id ?? '')
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
  | { outcome: 'rejected'; bid: UnderbidBidInfo }
  | UnderbidFailure

// Seller decisions run under the same auction row lock as placeBid, so an
// approval racing a bid or a second approval serialises on the row and the
// loser sees the bid in its post-decision status. The status guard on the
// UPDATE is redundant with the lock but keeps the write honest if the lock
// semantics ever change.
export async function approveAlapakkumine(
  auctionId: string,
  bidId: string,
): Promise<ApproveDecision> {
  const payload = await getPayloadClient()
  const events: DomainEvent[] = []

  const outcome = await withAuctionLock(payload, auctionId, async (tx): Promise<ApproveDecision> => {
    const bid = await findDoc(payload, 'bids', { id: { equals: bidId } })
    if (!bid || String(relationValue(bid.auction)) !== auctionId) {
      return { outcome: 'bid_not_found' }
    }
    if (bid.status !== 'pending_approval') {
      return { outcome: 'not_pending', status: String(bid.status) }
    }

    const auction = await findDoc(payload, 'auctions', { id: { equals: auctionId } })
    if (!auction) {
      return { outcome: 'auction_not_found' }
    }
    // An approval must never inject a new leader into an auction that the
    // ending worker already processed.
    if (auction.status !== 'active') {
      return { outcome: 'auction_not_active' }
    }

    const auctionTitle = (auction.title as string | undefined) ?? `Auction ${auctionId}`
    const amount = bid.amount as number
    const bidderId = relationValue(bid.user)

    // Per spec the approval wins the lead even over a higher legitimate
    // bid; the displaced leader is demoted in the same transaction.
    const leading = await findDoc(payload, 'bids', {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'leading' } },
      ],
    })

    if (leading) {
      await tx.execute(
        sql`update bids set status = 'outbid', updated_at = now() where id = ${leading.id as string}`,
      )
      events.push({
        type: 'outbid',
        userId: relationValue(leading.user),
        payload: { auctionId, auctionTitle, currentBid: amount },
      })
    }

    await tx.execute(
      sql`update bids set status = 'leading', updated_at = now() where id = ${bidId} and status = 'pending_approval'`,
    )

    events.push({
      type: 'bid.approved',
      userId: bidderId,
      payload: { auctionId, auctionTitle, bidId, amount },
    })

    return {
      outcome: 'approved',
      bid: { bidId, bidderId: String(bidderId), amount, auctionTitle },
      displacedLeader: leading
        ? { userId: String(relationValue(leading.user)), amount: leading.amount as number }
        : null,
    }
  })

  if (outcome === null) {
    return { outcome: 'auction_not_found' }
  }

  // Emit only after the transaction committed; a rolled-back decision
  // never notifies anyone.
  for (const event of events) {
    eventBus.emit(event)
  }

  return outcome
}

export async function rejectAlapakkumine(
  auctionId: string,
  bidId: string,
): Promise<RejectDecision> {
  const payload = await getPayloadClient()
  const events: DomainEvent[] = []

  const outcome = await withAuctionLock(payload, auctionId, async (tx): Promise<RejectDecision> => {
    const bid = await findDoc(payload, 'bids', { id: { equals: bidId } })
    if (!bid || String(relationValue(bid.auction)) !== auctionId) {
      return { outcome: 'bid_not_found' }
    }
    if (bid.status !== 'pending_approval') {
      return { outcome: 'not_pending', status: String(bid.status) }
    }

    const auction = await findDoc(payload, 'auctions', { id: { equals: auctionId } })
    if (!auction) {
      return { outcome: 'auction_not_found' }
    }

    const auctionTitle = (auction.title as string | undefined) ?? `Auction ${auctionId}`
    const amount = bid.amount as number
    const bidderId = relationValue(bid.user)

    await tx.execute(
      sql`update bids set status = 'rejected', updated_at = now() where id = ${bidId} and status = 'pending_approval'`,
    )

    events.push({
      type: 'bid.rejected',
      userId: bidderId,
      payload: { auctionId, auctionTitle, bidId, amount },
    })

    return {
      outcome: 'rejected',
      bid: { bidId, bidderId: String(bidderId), amount, auctionTitle },
    }
  })

  if (outcome === null) {
    return { outcome: 'auction_not_found' }
  }

  for (const event of events) {
    eventBus.emit(event)
  }

  return outcome
}
