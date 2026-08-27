import { getPayloadClient } from '../../payload/payloadClient'
import { encryptSealedData, decryptSealedData } from '../encryption'
import type { BidResult } from './place-bid'

export interface SubmitSealedBidParams {
  userId: string
  auctionId: string
  amount: number
  idempotencyKey?: string
  identitySnapshot?: string
}

export interface DecryptedBid {
  id: string
  auction: string
  user: string
  amount: number
  identitySnapshot?: string | undefined
  status: string
  createdAt: string
}

async function getSealedRevisionCap(): Promise<number> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'settings',
    limit: 1,
    depth: 0,
  })
  const settings = result.docs[0] as Record<string, unknown> | undefined
  return (settings?.sealedRevisionCap as number | undefined) ?? 3
}

export async function submitSealedBid(
  params: SubmitSealedBidParams,
): Promise<BidResult> {
  const { userId, auctionId, amount, idempotencyKey, identitySnapshot } = params

  const payload = await getPayloadClient()

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

  if (amount < (auction.minBid as number)) {
    return {
      success: false,
      error: `Bid must be at least ${String(auction.minBid)} EUR`,
      status: 400,
    }
  }

  const existingBid = await payload.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { user: { equals: userId } },
        { type: { equals: 'sealed' } },
        { status: { not_equals: 'rejected' } },
      ],
    },
    limit: 100,
    depth: 0,
  })

  const revisionCap = await getSealedRevisionCap()
  const existingCount = existingBid.docs.length

  if (existingCount > 0 && existingCount >= revisionCap + 1) {
    return {
      success: false,
      error: `Revision limit of ${String(revisionCap)} reached`,
      status: 400,
    }
  }

  if (idempotencyKey) {
    const duplicate = await payload.find({
      collection: 'bids',
      where: { idempotencyKey: { equals: idempotencyKey } },
      limit: 1,
      depth: 0,
    })
    if (duplicate.docs.length > 0) {
      return {
        success: false,
        error: 'Duplicate bid (idempotency key already used)',
        status: 409,
      }
    }
  }

  const encryptedData = encryptSealedData(String(amount))
  const sealedPayload: Record<string, string> = {
    encrypted: encryptedData.encrypted,
    iv: encryptedData.iv,
  }
  if (identitySnapshot) {
    const encryptedIdentity = encryptSealedData(identitySnapshot)
    sealedPayload.identityEncrypted = encryptedIdentity.encrypted
    sealedPayload.identityIv = encryptedIdentity.iv
  }

  const bidData: Record<string, unknown> = {
    auction: auctionId,
    user: userId,
    amount: 0,
    type: 'sealed',
    source: 'manual',
    status: 'leading',
    identitySnapshot: JSON.stringify(sealedPayload),
  }
  if (idempotencyKey) bidData.idempotencyKey = idempotencyKey

  const newBid = await payload.create({
    collection: 'bids',
    data: bidData,
  })

  if (existingCount > 0) {
    await Promise.all(
      existingBid.docs.map((doc) =>
        payload.update({
          collection: 'bids',
          id: doc.id,
          data: { status: 'outbid' },
        }),
      ),
    )
  }

  return { success: true, bid: newBid }
}

export async function getSealedBidsForAuction(
  auctionId: string,
): Promise<Record<string, unknown>[]> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { type: { equals: 'sealed' } },
      ],
    },
    limit: 1000,
    depth: 1,
  })
  return result.docs
}

export function decryptSealedBids(
  bids: Record<string, unknown>[],
): DecryptedBid[] {
  return bids.map((bid) => {
    const rawSnapshot = bid.identitySnapshot as string | undefined
    let amount = 0
    let identitySnapshot: string | undefined

    if (rawSnapshot) {
      try {
        const parsed = JSON.parse(rawSnapshot) as Record<string, string>
        if (parsed.encrypted && parsed.iv) {
          amount = Number(decryptSealedData(parsed.encrypted, parsed.iv))
        }
        if (parsed.identityEncrypted && parsed.identityIv) {
          identitySnapshot = decryptSealedData(
            parsed.identityEncrypted,
            parsed.identityIv,
          )
        }
      } catch {
        amount = 0
      }
    }

    return {
      id: bid.id as string,
      auction: typeof bid.auction === 'object' ? (bid.auction as Record<string, unknown>).id as string : bid.auction as string,
      user: typeof bid.user === 'object' ? (bid.user as Record<string, unknown>).id as string : bid.user as string,
      amount,
      identitySnapshot,
      status: bid.status as string,
      createdAt: bid.createdAt as string,
    }
  })
}