import crypto from 'node:crypto'

import { verifyAdminAccessToken } from '../auth/jwt'
import { utf8Encode } from '../bytes'
import { createCache } from '../cache'
import { decryptSealedBids, getSealedBidsForAuction, type DecryptedBid } from './sealed-bid'
import { prepareContract } from '../contracts/service'
import type { AuctionDoc } from '../data/repositories'
import { centsToEuros, eurosToCents } from '../data/repositories/money'
import { getRepositories } from '../data/runtime'
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

function auctionApprovalKey(auctionId: string): string {
  return `sealed-opening:approved:${auctionId}`
}

function generateToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function tokensMatch(expected: string, actual: string): boolean {
  const expectedBuf = utf8Encode(expected)
  const actualBuf = utf8Encode(actual)
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

async function findAuction(
  auctionId: string,
): Promise<AuctionDoc | undefined> {
  const repos = await getRepositories()
  const auctionResult = await repos.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
  })
  return auctionResult.docs[0]
}

export async function startOpeningSession(
  auctionId: string,
  openerAccessToken: string,
): Promise<{ sessionId: string; approvalToken: string }> {
  const opener = verifyAdminAccessToken(openerAccessToken)
  if (!opener) {
    throw new Error('Opener must hold a valid admin or superadmin token')
  }

  const auction = await findAuction(auctionId)
  if (!auction) {
    throw new Error('Auction not found')
  }
  if (auction.status !== 'ended') {
    throw new Error(`Auction must be in 'ended' status to open sealed bids, current: ${auction.status}`)
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

  // Sessions are keyed by sessionId, so confirmWinner (which only knows the
  // auction) reads this auction-scoped marker instead. It exists only after
  // a completed two-person approval and expires with the session.
  await openingSessions.set(
    auctionApprovalKey(session.auctionId),
    JSON.stringify({ sessionId, approverUserId: approver.userId }),
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

  const repos = await getRepositories()

  const auction = await findAuction(auctionId)
  if (!auction) {
    throw new Error('Auction not found')
  }
  if (auction.status !== 'ended') {
    throw new Error(`Auction must be in 'ended' status to confirm a winner, current: ${auction.status}`)
  }

  const approved = await openingSessions.get(auctionApprovalKey(auctionId))
  if (!approved) {
    throw new Error('Suletud pakkumiste avamise tseremoonia ei ole kahesammuliselt kinnitatud')
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
  if (top?.id !== bidId) {
    throw new Error('Bid does not top the decrypted ranking')
  }

  const winningAmount = target.amount
  const auctionTitle = auction.title as string | undefined
  const objectType = auction.objectType as string
  const rawReserveCents = auction.reservePriceCents
  const reserveSet = typeof rawReserveCents === 'number'
  const reserveMet = !reserveSet || eurosToCents(winningAmount) >= (rawReserveCents)

  if (!reserveMet) {
    await repos.update({
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

    await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'reserve_not_met',
        entityType: 'auction',
        entityId: auctionId,
        after: {
          bidId,
          auctionStatus: 'unsold',
          finalPrice: winningAmount,
          reservePrice: centsToEuros(rawReserveCents),
        },
      },
    })

    return
  }

  await repos.update({
    collection: 'bids',
    id: bidId,
    data: { status: 'won' },
  })

  const allBids = await repos.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: auctionId } },
        { id: { not_equals: bidId } },
        { status: { equals: 'leading' } },
      ],
    },
    limit: 1000,
  })
  for (const otherBid of allBids.docs) {
    await repos.update({
      collection: 'bids',
      id: otherBid.id,
      data: { status: 'lost' },
    })
  }

  await repos.update({
    collection: 'auctions',
    id: auctionId,
    data: {
      status: 'appraised',
      winningBid: bidId,
      finalPriceCents: eurosToCents(winningAmount),
    },
  })

  // The ending worker already recorded count and area for this auction in
  // the end-day snapshot with eur 0, so the ceremony backfill adds only the
  // eur contribution from the published finalPrice.
  await upsertSnapshot(repos, { objectType, eur: winningAmount })

  await prepareContract(auctionId, 'auction', target.user)

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

  await repos.create({
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
  const repos = await getRepositories()

  const auction = await findAuction(auctionId)
  if (!auction) {
    throw new Error('Auction not found')
  }
  if (auction.status !== 'ended') {
    throw new Error(`Auction must be in 'ended' status to void an opening, current: ${auction.status}`)
  }

  await repos.update({
    collection: 'auctions',
    id: auctionId,
    data: { status: 'unsold' },
  })

  await repos.create({
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
