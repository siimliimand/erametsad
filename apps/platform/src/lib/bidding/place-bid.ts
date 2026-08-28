import type { Payload } from 'payload'

import { getPayloadClient } from '../../payload/payloadClient'

export interface PlaceBidParams {
  userId: string
  auctionId: string
  amount: number
  type: 'open' | 'sealed'
  source: 'manual' | 'autobidder'
  ipHash?: string
  idempotencyKey?: string
}

export interface BidSuccess {
  success: true
  bid: Record<string, unknown>
}

export interface BidError {
  success: false
  error: string
  status: number
}

export type BidResult = BidSuccess | BidError

async function getCurrentLeadingBid(
  payload: Payload,
  auctionId: string,
): Promise<Record<string, unknown> | null> {
  const result = await payload.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'leading' } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  return (result.docs[0] as Record<string, unknown> | undefined) ?? null
}

export async function placeBid(params: PlaceBidParams): Promise<BidResult> {
  const {
    userId,
    auctionId,
    amount,
    type,
    source,
    ipHash,
    idempotencyKey,
  } = params

  // Production should use SERIALIZABLE transaction isolation
  // to prevent race conditions on bid placement.

  const payload = await getPayloadClient()

  // 1. Verify user exists
  const userResult = await payload.find({
    collection: 'users',
    where: { id: { equals: userId } },
    limit: 1,
    depth: 0,
  })
  const user = userResult.docs[0] as Record<string, unknown> | undefined
  if (!user) {
    return { success: false, error: 'User not found', status: 401 }
  }
  if (user.status === 'suspended') {
    return { success: false, error: 'User is suspended', status: 403 }
  }

  // 2. Auction is active
  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 0,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (!auction) {
    return { success: false, error: 'Auction not found', status: 404 }
  }
  if (auction.status !== 'active') {
    return { success: false, error: 'Auction is not active', status: 400 }
  }
  const endsAt = auction.endsAt as string | undefined
  if (!endsAt || new Date(endsAt) <= new Date()) {
    return { success: false, error: 'Auction has ended', status: 400 }
  }

  const objectType = auction.objectType as string
  const minBid = auction.minBid as number

  // 3. ObjectType right
  const rightsResult = await payload.find({
    collection: 'auction-rights',
    where: {
      and: [
        { user: { equals: userId } },
        { objectType: { equals: objectType } },
        { revokedAt: { exists: false } },
      ],
    },
    limit: 1,
    depth: 0,
  })
  if (rightsResult.docs.length === 0) {
    return {
      success: false,
      error: 'No bidding right for this object type',
      status: 403,
    }
  }

  // 4. Amount validity
  if (amount < minBid) {
    return {
      success: false,
      error: `Bid must be at least ${String(minBid)} EUR`,
      status: 400,
    }
  }

  const leadingBid = await getCurrentLeadingBid(payload, auctionId)
  if (leadingBid) {
    const leadingAmount = leadingBid.amount as number
    const bidStep = auction.bidStep as number | undefined
    const minimumAmount = leadingAmount + (bidStep ?? 0)
    if (amount < minimumAmount) {
      return {
        success: false,
        error: `Bid must be at least ${String(minimumAmount)} EUR`,
        status: 400,
      }
    }
  }

  // 5. Framework contract check
  const settingsResult = await payload.find({
    collection: 'settings',
    limit: 1,
    depth: 0,
  })
  const settings = settingsResult.docs[0] as Record<string, unknown> | undefined
  const featureFlags: Record<string, unknown> = settings?.featureFlags
    ? (settings.featureFlags as Record<string, unknown>)
    : {}
  const requireFrameworkContract = featureFlags.requireFrameworkContract === true

  if (requireFrameworkContract) {
    const activeFrameworkTemplates = await payload.find({
      collection: 'contract-templates',
      where: {
        and: [
          { type: { equals: 'framework' } },
          { active: { equals: true } },
        ],
      },
      limit: 100,
      depth: 0,
    })
    const templateIds = activeFrameworkTemplates.docs.map(
      (t: Record<string, unknown>) => t.id,
    )
    if (templateIds.length > 0) {
      const signedContracts = await payload.find({
        collection: 'contracts',
        where: {
          and: [
            { signedBy: { equals: userId } },
            { status: { equals: 'signed' } },
            { template: { in: templateIds } },
          ],
        },
        limit: 1,
        depth: 0,
      })
      if (signedContracts.docs.length === 0) {
        return {
          success: false,
          error: 'Framework contract required',
          status: 403,
        }
      }
    }
  }

  // 6. Idempotency check
  if (idempotencyKey) {
    const existingBid = await payload.find({
      collection: 'bids',
      where: { idempotencyKey: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
    })
    if (existingBid.docs.length > 0) {
      return {
        success: false,
        error: 'Duplicate bid (idempotency key already used)',
        status: 409,
      }
    }
  }

  // Create the new bid
  const bidData: Record<string, unknown> = {
    auction: auctionId,
    user: userId,
    amount,
    type,
    source,
    status: 'leading',
  }
  if (ipHash) bidData.ipHash = ipHash
  if (idempotencyKey) bidData.idempotencyKey = idempotencyKey

  const newBid = await payload.create({
    collection: 'bids',
    data: bidData,
  })

  // Mark previous leading bid as outbid
  if (leadingBid) {
    await payload.update({
      collection: 'bids',
      id: leadingBid.id as string,
      data: { status: 'outbid' },
    })
  }

  return { success: true, bid: newBid }
}