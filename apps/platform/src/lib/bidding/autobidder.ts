import { placeBid } from './place-bid'

import { getPayloadClient } from '@/payload/payloadClient'

type AutobidderDoc = Record<string, unknown>

function createdAtMs(autobidder: AutobidderDoc): number {
  return new Date(autobidder.createdAt as string | Date).getTime()
}

export async function evaluateAutobidders(auctionId: string): Promise<void> {
  const payload = await getPayloadClient()

  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 0,
  })
  const auction = auctionResult.docs[0] as AutobidderDoc | undefined
  if (!auction) return

  const bidStep = auction.bidStep as number
  const minBid = auction.minBid as number

  const leadingResult = await payload.find({
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
  const leadingBid = leadingResult.docs[0] as AutobidderDoc | undefined
  const leadingUser = leadingBid?.user as string | undefined
  const leadingAmount = leadingBid?.amount as number | undefined

  const autobiddersResult = await payload.find({
    collection: 'autobidders',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'active' } },
      ],
    },
    sort: 'createdAt',
    depth: 0,
  })
  const autobidders = autobiddersResult.docs as AutobidderDoc[]

  // No self-overbid: the autobidder whose user already leads never raises.
  const candidates = autobidders.filter((a) => a.user !== leadingUser)
  if (candidates.length === 0) return

  const winner = candidates.reduce((best, candidate) => {
    const candidateMax = candidate.maxAmount as number
    const bestMax = best.maxAmount as number
    if (
      candidateMax > bestMax ||
      (candidateMax === bestMax && createdAtMs(candidate) < createdAtMs(best))
    ) {
      return candidate
    }
    return best
  })

  let rivalMax: number | null = null
  for (const autobidder of autobidders) {
    if (autobidder === winner) continue
    const max = autobidder.maxAmount as number
    if (rivalMax === null || max > rivalMax) rivalMax = max
  }

  const required =
    leadingAmount !== undefined ? leadingAmount + bidStep : minBid
  const winnerMax = winner.maxAmount as number
  if (winnerMax < required) return

  // Single pass: clear the minimum and the strongest rival max in one bid.
  let target = required
  if (rivalMax !== null) target = Math.max(target, rivalMax + bidStep)
  target = Math.min(target, winnerMax)

  await placeBid({
    userId: winner.user as string,
    auctionId,
    amount: target,
    type: 'open',
    source: 'autobidder',
  })
}
