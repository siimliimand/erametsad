import crypto from 'node:crypto'

import { decryptSealedBids, getSealedBidsForAuction, type DecryptedBid } from './sealed-bid'
import { getPayloadClient } from '../../payload/payloadClient'
import { prepareContract } from '../contracts/service'

interface OpeningSession {
  sessionId: string
  auctionId: string
  openerUserId: string
  approvalToken: string
  step: 'step-1' | 'step-2-complete'
}

const sessions = new Map<string, OpeningSession>()

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

export async function startOpeningSession(
  auctionId: string,
  openerUserId: string,
): Promise<{ sessionId: string; approvalToken: string }> {
  const payload = await getPayloadClient()

  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 0,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (!auction) {
    throw new Error('Auction not found')
  }
  if (auction.status !== 'ended') {
    throw new Error(`Auction must be in 'ended' status to open sealed bids, current: ${String(auction.status)}`)
  }

  const approvalToken = generateToken()
  const sessionId = crypto.randomUUID()
  const session: OpeningSession = {
    sessionId,
    auctionId,
    openerUserId,
    approvalToken,
    step: 'step-1',
  }
  sessions.set(sessionId, session)

  return { sessionId, approvalToken }
}

export async function approveOpeningSession(
  sessionId: string,
  approverToken: string,
  approverUserId: string,
): Promise<{ bids: DecryptedBid[] }> {
  const session = sessions.get(sessionId)
  if (!session) {
    throw new Error('Opening session not found')
  }
  if (session.step !== 'step-1') {
    throw new Error('Opening session already completed or invalid')
  }
  if (session.openerUserId === approverUserId) {
    throw new Error('Approver must be a different admin from the opener')
  }
  if (session.approvalToken !== approverToken) {
    throw new Error('Invalid approval token')
  }

  const rawBids = await getSealedBidsForAuction(session.auctionId)
  const decrypted = decryptSealedBids(rawBids)
  const ranked = decrypted.sort((a, b) => b.amount - a.amount)

  session.step = 'step-2-complete'

  return { bids: ranked }
}

export async function confirmWinner(
  auctionId: string,
  bidId: string,
): Promise<void> {
  const payload = await getPayloadClient()

  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 0,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (!auction) {
    throw new Error('Auction not found')
  }
  if (auction.status !== 'ended' && auction.status !== 'appraised') {
    throw new Error(`Auction must be in 'ended' or 'appraised' status to confirm a winner, current: ${String(auction.status)}`)
  }

  const bidResult = await payload.find({
    collection: 'bids',
    where: { id: { equals: bidId } },
    limit: 1,
    depth: 0,
  })
  const bid = bidResult.docs[0] as Record<string, unknown> | undefined
  if (!bid) {
    throw new Error('Bid not found')
  }

  await payload.update({
    collection: 'bids',
    id: bidId,
    data: { status: 'won' },
  })

  const allBids = await payload.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { id: { not_equals: bidId } },
        { status: { equals: 'leading' } },
      ],
    },
    limit: 1000,
    depth: 0,
  })
  for (const otherBid of allBids.docs) {
    await payload.update({
      collection: 'bids',
      id: otherBid.id,
      data: { status: 'lost' },
    })
  }

  await payload.update({
    collection: 'auctions',
    id: auctionId,
    data: { status: 'appraised' },
  })

  await prepareContract(auctionId, 'auction')

  await payload.create({
    collection: 'audit-entry',
    data: {
      action: 'winner_confirmed',
      entityType: 'auction',
      entityId: auctionId,
      after: {
        bidId,
        auctionStatus: 'appraised',
      },
    },
  })
}

export async function voidOpening(auctionId: string): Promise<void> {
  const payload = await getPayloadClient()

  const auctionResult = await payload.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
    depth: 0,
  })
  const auction = auctionResult.docs[0] as Record<string, unknown> | undefined
  if (!auction) {
    throw new Error('Auction not found')
  }
  if (auction.status !== 'ended') {
    throw new Error(`Auction must be in 'ended' status to void an opening, current: ${String(auction.status)}`)
  }

  await payload.update({
    collection: 'auctions',
    id: auctionId,
    data: { status: 'unsold' },
  })

  await payload.create({
    collection: 'audit-entry',
    data: {
      action: 'opening_voided',
      entityType: 'auction',
      entityId: auctionId,
      after: {
        auctionStatus: 'unsold',
      },
    },
  })
}