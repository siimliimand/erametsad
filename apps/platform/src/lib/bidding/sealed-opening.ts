import crypto from 'node:crypto'

import { verifyAdminAccessToken } from '../auth/jwt'
import { createCache } from '../cache'
import { decryptSealedBids, getSealedBidsForAuction, type DecryptedBid } from './sealed-bid'
import { getPayloadClient } from '../../payload/payloadClient'
import { prepareContract } from '../contracts/service'
import { eventBus } from '../notifications/event-bus'
import { upsertSnapshot } from '../stats/aggregation'

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
  adminAccessToken: string,
): Promise<void> {
  const admin = verifyAdminAccessToken(adminAccessToken)
  if (!admin) {
    throw new Error('Confirmer must hold a valid admin or superadmin token')
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
    throw new Error(`Auction must be in 'ended' status to confirm a winner, current: ${String(auction.status)}`)
  }

  const rawBids = await getSealedBidsForAuction(auctionId)
  const decrypted = decryptSealedBids(rawBids)
  const ranked = rankBids(decrypted)

  const target = decrypted.find((bid) => bid.id === bidId)
  if (!target) {
    throw new Error('Bid not found among the sealed bids of this auction')
  }
  if (!target.valid) {
    throw new Error('Bid is invalid (decryption failed) and cannot win')
  }
  const top = ranked[0]
  if (!top || top.id !== bidId) {
    throw new Error('Bid does not top the decrypted ranking')
  }

  const winningAmount = target.amount
  const auctionTitle = auction.title as string | undefined
  const objectType = auction.objectType as string
  const rawReserve = auction.reservePrice
  const reserveSet = typeof rawReserve === 'number' && Number.isFinite(rawReserve)
  const reserveMet = !reserveSet || winningAmount >= rawReserve

  if (!reserveMet) {
    await payload.update({
      collection: 'auctions',
      id: auctionId,
      data: { status: 'unsold' },
    })

    eventBus.emit({
      type: 'auction.ended',
      userId: target.user,
      payload: {
        auctionId,
        auctionTitle,
        type: 'sealed',
        hasWinner: false,
        reserveNotMet: true,
        amount: winningAmount,
      },
    })

    await payload.create({
      collection: 'audit-entry',
      data: {
        action: 'reserve_not_met',
        entityType: 'auction',
        entityId: auctionId,
        after: {
          bidId,
          auctionStatus: 'unsold',
          finalPrice: winningAmount,
          reservePrice: rawReserve,
        },
      },
    })

    return
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
    data: {
      status: 'appraised',
      winningBid: bidId,
      finalPrice: winningAmount,
    },
  })

  // The ending worker already recorded count and area for this auction in
  // the end-day snapshot with eur 0, so the ceremony backfill adds only the
  // eur contribution from the published finalPrice.
  await upsertSnapshot(payload, { objectType, eur: winningAmount })

  await prepareContract(auctionId, 'auction')

  const loserUserIds = [
    ...new Set(
      ranked
        .filter((bid) => bid.user !== target.user)
        .map((bid) => bid.user),
    ),
  ]
  for (const loserId of loserUserIds) {
    eventBus.emit({
      type: 'auction.ended',
      userId: loserId,
      payload: {
        auctionId,
        auctionTitle,
        type: 'sealed',
        hasWinner: true,
        finalPrice: winningAmount,
      },
    })
  }

  await payload.create({
    collection: 'audit-entry',
    data: {
      action: 'winner_confirmed',
      entityType: 'auction',
      entityId: auctionId,
      after: {
        bidId,
        auctionStatus: 'appraised',
        finalPrice: winningAmount,
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