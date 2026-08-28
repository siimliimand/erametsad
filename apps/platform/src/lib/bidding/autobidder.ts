import { placeBid } from './place-bid'

import { getPayloadClient } from '@/payload/payloadClient'

export async function evaluateAutobidders(
  auctionId: string,
  _newBidAmount: number,
): Promise<void> {
  const payload = await getPayloadClient()

  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 0,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (!auction) return

  const bidStep = auction.bidStep as number

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
  const leadingBid = leadingResult.docs[0] as
    | Record<string, unknown>
    | undefined

  let currentAmount = leadingBid ? (leadingBid.amount as number) : 0
  let currentSource = leadingBid
    ? (leadingBid.source as string)
    : 'none'

  for (let round = 0; round < 100; round++) {

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

    const autobidders = autobiddersResult.docs as Record<string, unknown>[]
    const eligible = autobidders.filter(
      (a) => (a.maxAmount as number) > currentAmount,
    )

    if (eligible.length === 0) break

    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const chosen = eligible[0] as Record<string, unknown>
    const chosenMax = chosen.maxAmount as number

    const hasSameMaxTie =
      currentSource !== 'manual' &&
      eligible.some(
        (a) =>
          a.id !== chosen.id && (a.maxAmount as number) === chosenMax,
      )

    let bidAmount: number
    if (hasSameMaxTie) {
      bidAmount = chosenMax
    } else {
      bidAmount = currentAmount + bidStep
      if (bidAmount > chosenMax) break
    }

    const result = await placeBid({
      userId: chosen.user as string,
      auctionId,
      amount: bidAmount,
      type: 'open',
      source: 'autobidder',
    })

    if (result.success) {
      currentAmount = bidAmount
      currentSource = 'autobidder'
    } else {
      break
    }
  }
}