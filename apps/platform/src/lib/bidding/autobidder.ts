import { placeBid } from './place-bid'
import { centsToEuros } from '../data/repositories/money'
import { getRepositories } from '../data/runtime'

type AutobidderDoc = Record<string, unknown>

function createdAtMs(autobidder: AutobidderDoc): number {
  return new Date(autobidder.createdAt as string | Date).getTime()
}

export async function evaluateAutobidders(auctionId: string): Promise<void> {
  const repos = await getRepositories()

  const auctionResult = await repos.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
  })
  const auction = auctionResult.docs[0] as AutobidderDoc | undefined
  if (!auction) return

  const bidStepCents = auction.bidStepCents as number | null
  const minBidCents = auction.minBidCents as number

  const leadingResult = await repos.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'leading' } },
      ],
    },
    limit: 1,
  })
  const leadingBid = leadingResult.docs[0] as AutobidderDoc | undefined
  const leadingUser = leadingBid?.userId as string | undefined
  const leadingAmountCents = leadingBid?.amountCents as number | undefined

  const autobiddersResult = await repos.find({
    collection: 'autobidders',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { status: { equals: 'active' } },
      ],
    },
    sort: 'createdAt',
  })
  const autobidders = autobiddersResult.docs as AutobidderDoc[]

  // No self-overbid: the autobidder whose user already leads never raises.
  const candidates = autobidders.filter((a) => a.userId !== leadingUser)
  if (candidates.length === 0) return

  const winner = candidates.reduce((best, candidate) => {
    const candidateMax = candidate.maxAmountCents as number
    const bestMax = best.maxAmountCents as number
    if (
      candidateMax > bestMax ||
      (candidateMax === bestMax && createdAtMs(candidate) < createdAtMs(best))
    ) {
      return candidate
    }
    return best
  })

  let rivalMaxCents: number | null = null
  for (const autobidder of autobidders) {
    if (autobidder === winner) continue
    const max = autobidder.maxAmountCents as number
    if (rivalMaxCents === null || max > rivalMaxCents) rivalMaxCents = max
  }

  const requiredCents =
    leadingAmountCents !== undefined
      ? leadingAmountCents + (bidStepCents ?? 0)
      : minBidCents
  const winnerMaxCents = winner.maxAmountCents as number
  if (winnerMaxCents < requiredCents) return

  // Single pass: clear the minimum and the strongest rival max in one bid.
  let targetCents = requiredCents
  if (rivalMaxCents !== null) {
    targetCents = Math.max(targetCents, rivalMaxCents + (bidStepCents ?? 0))
  }
  targetCents = Math.min(targetCents, winnerMaxCents)

  await placeBid({
    userId: winner.userId as string,
    auctionId,
    amount: centsToEuros(targetCents),
    type: 'open',
    source: 'autobidder',
  })
}
