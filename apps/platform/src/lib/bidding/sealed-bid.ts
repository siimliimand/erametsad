import { centsToEuros, eurosToCents } from '../data/repositories/money'
import { getRepositories } from '../data/runtime'
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
  valid: boolean
}

async function getSealedRevisionCap(): Promise<number> {
  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'settings',
    limit: 1,
  })
  const settings = result.docs[0] as Record<string, unknown> | undefined
  return (settings?.sealedRevisionCap as number | undefined) ?? 3
}

export async function submitSealedBid(
  params: SubmitSealedBidParams,
): Promise<BidResult> {
  const { userId, auctionId, amount, idempotencyKey, identitySnapshot } = params

  const repos = await getRepositories()

  const userResult = await repos.find({
    collection: 'users',
    where: { id: { equals: userId } },
    limit: 1,
  })
  const user = userResult.docs[0] as Record<string, unknown> | undefined
  if (!user) {
    return { success: false, error: 'User not found', status: 401 }
  }
  if (user.status === 'suspended') {
    return { success: false, error: 'User is suspended', status: 403 }
  }

  const auctionResult = await repos.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
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

  // Same rights check and BidError as placeBid, so a shared route maps
  // both to HTTP 403.
  const rightsResult = await repos.find({
    collection: 'auction-rights',
    where: {
      and: [
        { user: { equals: userId } },
        { objectType: { equals: objectType } },
        { revokedAt: { exists: false } },
      ],
    },
    limit: 1,
  })
  if (rightsResult.docs.length === 0) {
    return {
      success: false,
      error: 'No bidding right for this object type',
      status: 403,
    }
  }

  const minBidCents = auction.minBidCents as number
  if (eurosToCents(amount) < minBidCents) {
    return {
      success: false,
      error: `Bid must be at least ${String(centsToEuros(minBidCents))} EUR`,
      status: 400,
    }
  }

  const existingBid = await repos.find({
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
  })

  const revisionCap = await getSealedRevisionCap()
  // Cap semantics: 1 original bid plus up to N revisions (N from Settings),
  // so a user may hold at most revisionCap + 1 sealed bids on an auction.
  const existingCount = existingBid.docs.length

  if (existingCount >= revisionCap + 1) {
    return {
      success: false,
      error: `Lukspakkumuste limiit on ületatud: lubatud on üks esialgne pakkumine ja kuni ${String(revisionCap)} täienduspakkumist`,
      status: 400,
    }
  }

  if (idempotencyKey) {
    const duplicate = await repos.find({
      collection: 'bids',
      where: { idempotencyKey: { equals: idempotencyKey } },
      limit: 1,
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
    authTag: encryptedData.authTag,
  }
  if (identitySnapshot) {
    const encryptedIdentity = encryptSealedData(identitySnapshot)
    sealedPayload.identityEncrypted = encryptedIdentity.encrypted
    sealedPayload.identityIv = encryptedIdentity.iv
    sealedPayload.identityAuthTag = encryptedIdentity.authTag
  }

  const newBid = await repos.create({
    collection: 'bids',
    data: {
      auction: auctionId,
      user: userId,
      amountCents: 0,
      type: 'sealed',
      source: 'manual',
      status: 'leading',
      identitySnapshot: JSON.stringify(sealedPayload),
      ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
    },
  })

  if (existingCount > 0) {
    await Promise.all(
      existingBid.docs.map((doc) =>
        repos.update({
          collection: 'bids',
          id: doc.id,
          data: { status: 'outbid' },
        }),
      ),
    )
  }

  return { success: true, bid: newBid as unknown as Record<string, unknown> }
}

export async function getSealedBidsForAuction(
  auctionId: string,
): Promise<Record<string, unknown>[]> {
  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { type: { equals: 'sealed' } },
      ],
    },
    limit: 1000,
  })
  return result.docs
}

// Normalize relationship values (number id, numeric string, or populated
// doc) to a plain string so ceremony comparisons against the string bidId
// the admin routes receive can never silently mismatch.
function relationId(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string') return id
    if (typeof id === 'number') return String(id)
  }
  return ''
}

export function decryptSealedBids(
  bids: Record<string, unknown>[],
): DecryptedBid[] {
  return bids.map((bid) => {
    const rawSnapshot = bid.identitySnapshot as string | undefined
    let amount = 0
    let identitySnapshot: string | undefined
    let invalidReason: string | undefined

    if (!rawSnapshot) {
      invalidReason = 'no encrypted payload'
    } else {
      try {
        const parsed = JSON.parse(rawSnapshot) as Record<string, string>
        if (parsed.encrypted && parsed.iv && parsed.authTag) {
          const decryptedAmount = Number(
            decryptSealedData(parsed.encrypted, parsed.iv, parsed.authTag),
          )
          if (Number.isFinite(decryptedAmount)) {
            amount = decryptedAmount
          } else {
            invalidReason = 'decrypted amount is not a finite number'
          }
        } else {
          invalidReason = 'incomplete encrypted amount fields'
        }
        if (
          parsed.identityEncrypted ||
          parsed.identityIv ||
          parsed.identityAuthTag
        ) {
          if (
            parsed.identityEncrypted &&
            parsed.identityIv &&
            parsed.identityAuthTag
          ) {
            identitySnapshot = decryptSealedData(
              parsed.identityEncrypted,
              parsed.identityIv,
              parsed.identityAuthTag,
            )
          } else {
            invalidReason = 'incomplete encrypted identity fields'
          }
        }
      } catch (error) {
        invalidReason = `decryption failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      }
    }

    if (invalidReason !== undefined) {
      // A failed decrypt must surface as an invalid bid, never as a valid
      // bid with amount 0, so the ceremony can continue with the rest.
      amount = 0
      identitySnapshot = undefined
      console.error(
        `[sealed-bid] bid ${String(bid.id)} marked invalid: ${invalidReason}`,
      )
    }

    return {
      id: relationId(bid.id),
      auction: relationId(bid.auction ?? bid.auctionId),
      user: relationId(bid.user ?? bid.userId),
      amount,
      identitySnapshot,
      status: bid.status as string,
      createdAt: bid.createdAt as string,
      valid: invalidReason === undefined,
    }
  })
}
