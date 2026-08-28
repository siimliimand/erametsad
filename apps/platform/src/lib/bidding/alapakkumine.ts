import { getPayloadClient } from '../../payload/payloadClient'

export interface AlapakkumineResult {
  status: string
  requiresApproval: boolean
}

export function isAlapakkumineEnabled(
  settings: { alapakkumineEnabled?: boolean } | null | undefined,
): boolean {
  return settings?.alapakkumineEnabled === true
}

export async function handleAlapakkumine(
  bid: { id: string; amount: number; auction: string },
  auction: { minBid: number; id: string },
): Promise<AlapakkumineResult> {
  if (bid.amount >= auction.minBid) {
    return { status: 'leading', requiresApproval: false }
  }

  const payload = await getPayloadClient()

  const settingsResult = await payload.find({
    collection: 'settings',
    limit: 1,
    depth: 0,
  })
  const settings = settingsResult.docs[0] as
    | { alapakkumineEnabled?: boolean }
    | undefined

  if (!settings?.alapakkumineEnabled) {
    return { status: 'rejected', requiresApproval: false }
  }

  const existingPending = await payload.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auction.id } },
        { status: { equals: 'pending_approval' } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  const oldPending = existingPending.docs[0] as { id: string } | undefined
  if (oldPending) {
    await payload.update({
      collection: 'bids',
      id: oldPending.id,
      data: { status: 'rejected' },
    })
  }

  await payload.update({
    collection: 'bids',
    id: bid.id,
    data: { status: 'pending_approval' },
  })

  return { status: 'pending_approval', requiresApproval: true }
}

export async function approveAlapakkumine(bidId: string): Promise<void> {
  const payload = await getPayloadClient()

  const bidResult = await payload.find({
    collection: 'bids',
    where: { id: { equals: bidId } },
    limit: 1,
    depth: 1,
  })

  const bid = bidResult.docs[0] as
    | { id: string; auction: string | { id: string }; amount: number }
    | undefined

  if (!bid) {
    throw new Error('Bid not found')
  }

  const auctionId = typeof bid.auction === 'string' ? bid.auction : bid.auction.id

  const existingValidBids = await payload.find({
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

  const existingBid = existingValidBids.docs[0] as { id: string } | undefined

  if (existingBid) {
    await payload.update({
      collection: 'bids',
      id: existingBid.id,
      data: { status: 'outbid' },
    })
  }

  await payload.update({
    collection: 'bids',
    id: bidId,
    data: { status: 'leading' },
  })

  await payload.update({
    collection: 'auctions',
    id: auctionId,
    data: { winningBid: bidId },
  })
}

export async function rejectAlapakkumine(bidId: string): Promise<void> {
  const payload = await getPayloadClient()

  await payload.update({
    collection: 'bids',
    id: bidId,
    data: { status: 'rejected' },
  })
}