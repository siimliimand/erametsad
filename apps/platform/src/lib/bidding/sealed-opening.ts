import crypto from 'node:crypto'

import { verifyAdminAccessToken } from '../auth/jwt'
import { createCache } from '../cache'
import { decryptSealedBids, getSealedBidsForAuction, type DecryptedBid } from './sealed-bid'
import { getPayloadClient } from '../../payload/payloadClient'
import { prepareContract } from '../contracts/service'

interface OpeningSession {
  sessionId: string
  auctionId: string
  openerUserId: string
  approvalToken: string
  step: 'step-1' | 'step-2-complete'
  approverUserId?: string
}

const OPENING_SESSION_TTL_SECONDS = 30 * 60

const openingSessions = createCache('SEALED_OPENING_SESSIONS')

function sessionKey(sessionId: string): string {
  return `sealed-opening:${sessionId}`
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuf = Buffer.from(expected, 'utf8')
  const actualBuf = Buffer.from(actual, 'utf8')
  if (expectedBuf.length !== actualBuf.length) {
    return false
  }
  return crypto.timingSafeEqual(expectedBuf, actualBuf)
}

function rankBids(bids: DecryptedBid[]): DecryptedBid[] {
  return bids
    .filter((bid) => bid.valid)
    .sort((a, b) => {
      if (b.amount !== a.amount) {
        return b.amount - a.amount
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    })
}

export async function startOpeningSession(
  auctionId: string,
  openerAccessToken: string,
): Promise<{ sessionId: string; approvalToken: string }> {
  const opener = verifyAdminAccessToken(openerAccessToken)
  if (!opener) {
    throw new Error('Opener must hold a valid admin or superadmin token')
  }

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
    openerUserId: opener.userId,
    approvalToken,
    step: 'step-1',
  }
  await openingSessions.set(sessionKey(sessionId), JSON.stringify(session), OPENING_SESSION_TTL_SECONDS)

  return { sessionId, approvalToken }
}

export async function approveOpeningSession(
  sessionId: string,
  approvalToken: string,
  approverAccessToken: string,
): Promise<{ bids: DecryptedBid[] }> {
  const approver = verifyAdminAccessToken(approverAccessToken)
  if (!approver) {
    throw new Error('Approver must hold a valid admin or superadmin token')
  }

  const raw = await openingSessions.get(sessionKey(sessionId))
  if (!raw) {
    throw new Error('Opening session not found or expired. Start a new opening session.')
  }
  const session = JSON.parse(raw) as OpeningSession
  if (session.step !== 'step-1') {
    throw new Error('Opening session already completed or invalid')
  }
  if (session.openerUserId === approver.userId) {
    throw new Error('Approver must be a different admin from the opener')
  }
  if (!tokensMatch(session.approvalToken, approvalToken)) {
    throw new Error('Invalid approval token')
  }

  const rawBids = await getSealedBidsForAuction(session.auctionId)
  const decrypted = decryptSealedBids(rawBids)
  const ranked = rankBids(decrypted)

  // Keep the completed marker in the cache so a replayed approval is rejected
  // as already completed instead of looking like an expired session.
  await openingSessions.set(
    sessionKey(sessionId),
    JSON.stringify({ ...session, step: 'step-2-complete', approverUserId: approver.userId } satisfies OpeningSession),
    OPENING_SESSION_TTL_SECONDS,
  )

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