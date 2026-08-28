import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest'

import { signAccessToken } from '../../auth/jwt'
import { encryptSealedData } from '../../encryption'
import { eventBus } from '../../notifications/event-bus'
import {
  startOpeningSession,
  approveOpeningSession,
  confirmWinner,
} from '../sealed-opening'

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

vi.mock('@/lib/contracts/service', () => ({
  prepareContract: vi.fn(),
}))

import { prepareContract } from '@/lib/contracts/service'
import { getPayloadClient } from '@/payload/payloadClient'

const OPENING_TTL_SECONDS = 30 * 60

const OLD_JWT_SECRET = process.env.JWT_SECRET
const OLD_ENCRYPTION_KEY = process.env.SEALED_BID_ENCRYPTION_KEY

beforeAll(() => {
  process.env.JWT_SECRET = 'test-jwt-secret'
  process.env.SEALED_BID_ENCRYPTION_KEY = 'test-encryption-key-32chars!!'
})

afterAll(() => {
  if (OLD_JWT_SECRET) {
    process.env.JWT_SECRET = OLD_JWT_SECRET
  } else {
    delete process.env.JWT_SECRET
  }
  if (OLD_ENCRYPTION_KEY) {
    process.env.SEALED_BID_ENCRYPTION_KEY = OLD_ENCRYPTION_KEY
  } else {
    delete process.env.SEALED_BID_ENCRYPTION_KEY
  }
})

interface MockFindArgs {
  collection?: string
}

let mockPayload: {
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
let findQueues: Record<string, Record<string, unknown>[][]>
let emitSpy: ReturnType<typeof vi.spyOn>
// The approval marker confirmWinner requires is keyed by auction id in a
// module-level cache that survives across tests, so every test gets its own
// auction.
let auctionId: string

function queueFind(collection: string, docs: Record<string, unknown>[]) {
  findQueues[collection] = [...(findQueues[collection] ?? []), docs]
}

beforeEach(() => {
  vi.clearAllMocks()
  findQueues = {}
  auctionId = `auction-${crypto.randomUUID()}`
  mockPayload = { find: vi.fn(), create: vi.fn(), update: vi.fn() }
  mockPayload.find.mockImplementation((args: MockFindArgs) => {
    const queue = findQueues[args.collection ?? ''] ?? []
    return { docs: queue.length > 0 ? queue.shift() : [] }
  })
  vi.mocked(getPayloadClient).mockResolvedValue(mockPayload as never)
  emitSpy = vi.spyOn(eventBus, 'emit')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function adminToken(userId: string): string {
  return signAccessToken({ userId, role: 'admin' })
}

function userToken(userId: string): string {
  return signAccessToken({ userId, role: 'user' })
}

function endedAuction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: auctionId,
    status: 'ended',
    title: 'Suletud pakkumise testoksjon',
    reservePrice: 100_000,
    ...overrides,
  }
}

function sealedBid(params: {
  id: string
  user: string
  amount: number
  createdAt: string
}): Record<string, unknown> {
  const encrypted = encryptSealedData(String(params.amount))
  return {
    id: params.id,
    auction: auctionId,
    user: params.user,
    amount: 0,
    type: 'sealed',
    status: 'leading',
    createdAt: params.createdAt,
    identitySnapshot: JSON.stringify({
      encrypted: encrypted.encrypted,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
    }),
  }
}

function tamperSealedPayload(bid: Record<string, unknown>): Record<string, unknown> {
  const snapshot = JSON.parse(bid.identitySnapshot as string) as { encrypted: string }
  const flipped = snapshot.encrypted.endsWith('00')
    ? `${snapshot.encrypted.slice(0, -2)}11`
    : `${snapshot.encrypted.slice(0, -2)}00`
  return {
    ...bid,
    identitySnapshot: JSON.stringify({ ...snapshot, encrypted: flipped }),
  }
}

async function startSession(
  openerUserId = 'opener-admin',
  auction = endedAuction(),
): Promise<{ sessionId: string; approvalToken: string }> {
  queueFind('auctions', [auction])
  return startOpeningSession(auctionId, adminToken(openerUserId))
}

async function approvedSession(
  openerUserId = 'opener-admin',
  approverUserId = 'approver-admin',
): Promise<{ sessionId: string; approvalToken: string }> {
  const session = await startSession(openerUserId)
  queueFind('bids', [])
  await approveOpeningSession(session.sessionId, session.approvalToken, adminToken(approverUserId))
  return session
}

function auctionUpdates(): { collection: string; data: Record<string, unknown> }[] {
  return mockPayload.update.mock.calls
    .map((call) => call[0] as { collection: string; data: Record<string, unknown> })
    .filter((call) => call.collection === 'auctions')
}

function endedEvents(): { userId: string | number; payload: Record<string, unknown> }[] {
  return emitSpy.mock.calls
    .map((call) => call[0] as { type: string; userId: string | number; payload: Record<string, unknown> })
    .filter((event) => event.type === 'auction.ended')
}

function auditCreateActions(): string[] {
  return mockPayload.create.mock.calls
    .map((call) => call[0] as { collection: string; data: { action: string } })
    .filter((call) => call.collection === 'audit-entry')
    .map((call) => call.data.action)
}

describe('startOpeningSession', () => {
  it('rejects when the auction is not in ended status', async () => {
    queueFind('auctions', [endedAuction({ status: 'active' })])

    await expect(startOpeningSession(auctionId, adminToken('opener-admin'))).rejects.toThrow(
      "Auction must be in 'ended' status",
    )
  })

  it('rejects a token without an admin role', async () => {
    await expect(startOpeningSession(auctionId, userToken('plain-user'))).rejects.toThrow(
      'Opener must hold a valid admin or superadmin token',
    )
  })
})

describe('approveOpeningSession', () => {
  it('rejects a token without an admin role', async () => {
    const session = await startSession()

    await expect(
      approveOpeningSession(session.sessionId, session.approvalToken, userToken('plain-user')),
    ).rejects.toThrow('Approver must hold a valid admin or superadmin token')
  })

  it('rejects the opener approving their own session (two-person rule)', async () => {
    const session = await startSession('same-admin')
    queueFind('bids', [])

    await expect(
      approveOpeningSession(session.sessionId, session.approvalToken, adminToken('same-admin')),
    ).rejects.toThrow('Approver must be a different admin from the opener')
  })

  it('rejects a wrong approval token', async () => {
    const session = await startSession('opener-admin')

    await expect(
      approveOpeningSession(session.sessionId, 'not-the-token', adminToken('approver-admin')),
    ).rejects.toThrow('Invalid approval token')
  })

  it('returns bids ranked by decrypted amount descending with ties broken by earliest submission', async () => {
    const session = await startSession()
    queueFind('bids', [
      sealedBid({ id: 'bid-late', user: 'user-b', amount: 150_000, createdAt: '2026-02-01T10:05:00Z' }),
      sealedBid({ id: 'bid-early', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' }),
      sealedBid({ id: 'bid-low', user: 'user-c', amount: 120_000, createdAt: '2026-02-01T09:00:00Z' }),
    ])

    const { bids } = await approveOpeningSession(
      session.sessionId,
      session.approvalToken,
      adminToken('approver-admin'),
    )

    expect(bids.map((bid) => bid.id)).toEqual(['bid-early', 'bid-late', 'bid-low'])
    expect(bids.every((bid) => bid.valid)).toBe(true)
  })

  it('rejects a replayed approval after the session reached step-2-complete', async () => {
    const session = await startSession()
    queueFind('bids', [])
    await approveOpeningSession(session.sessionId, session.approvalToken, adminToken('approver-admin'))

    await expect(
      approveOpeningSession(session.sessionId, session.approvalToken, adminToken('approver-admin')),
    ).rejects.toThrow('Opening session already completed or invalid')
  })
})

describe('opening session expiry', () => {
  it('keeps the session usable within the 30-minute TTL', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'))
    const session = await startSession()

    vi.setSystemTime(new Date('2026-02-01T10:29:00Z'))
    queueFind('bids', [])

    await expect(
      approveOpeningSession(session.sessionId, session.approvalToken, adminToken('approver-admin')),
    ).resolves.toBeDefined()
  })

  it('invalidates the session after the TTL and requires a new session', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'))
    const expired = await startSession()

    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'))
    vi.advanceTimersByTime((OPENING_TTL_SECONDS + 60) * 1000)
    await expect(
      approveOpeningSession(expired.sessionId, expired.approvalToken, adminToken('approver-admin')),
    ).rejects.toThrow('Opening session not found or expired. Start a new opening session.')

    queueFind('auctions', [endedAuction()])
    const fresh = await startOpeningSession(auctionId, adminToken('opener-admin'))
    queueFind('bids', [])
    await expect(
      approveOpeningSession(fresh.sessionId, fresh.approvalToken, adminToken('approver-admin')),
    ).resolves.toBeDefined()
  })
})

describe('confirmWinner', () => {
  it('rejects when the auction is not in ended status and writes nothing', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction({ status: 'active' })])
    queueFind('bids', [sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' })])

    await expect(
      confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin')),
    ).rejects.toThrow("Auction must be in 'ended' status")
    expect(mockPayload.update).not.toHaveBeenCalled()
    expect(prepareContract).not.toHaveBeenCalled()
  })

  it('rejects confirmation when no opening session exists for the auction', async () => {
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' })])

    await expect(
      confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin')),
    ).rejects.toThrow('Suletud pakkumiste avamise tseremoonia ei ole kahesammuliselt kinnitatud')
    expect(mockPayload.update).not.toHaveBeenCalled()
    expect(prepareContract).not.toHaveBeenCalled()
  })

  it('rejects confirmation when the session was opened but never approved by a second admin', async () => {
    await startSession()
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' })])

    await expect(
      confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin')),
    ).rejects.toThrow('Suletud pakkumiste avamise tseremoonia ei ole kahesammuliselt kinnitatud')
    expect(mockPayload.update).not.toHaveBeenCalled()
    expect(prepareContract).not.toHaveBeenCalled()
  })

  it('rejects confirmation after the approved session expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'))
    await approvedSession()

    vi.advanceTimersByTime((OPENING_TTL_SECONDS + 60) * 1000)
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' })])

    await expect(
      confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin')),
    ).rejects.toThrow('Suletud pakkumiste avamise tseremoonia ei ole kahesammuliselt kinnitatud')
  })

  it('rejects a bid that is not among the sealed bids of the auction', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [])

    await expect(
      confirmWinner(auctionId, 'foreign-bid', adminToken('confirmer-admin')),
    ).rejects.toThrow('Bid not found among the sealed bids of this auction')
  })

  it('rejects confirming the later of two equal bids and accepts the earlier one', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [
      sealedBid({ id: 'bid-early', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' }),
      sealedBid({ id: 'bid-late', user: 'user-b', amount: 150_000, createdAt: '2026-02-01T10:05:00Z' }),
    ])

    await expect(
      confirmWinner(auctionId, 'bid-late', adminToken('confirmer-admin')),
    ).rejects.toThrow('Bid does not top the decrypted ranking')

    queueFind('auctions', [endedAuction()])
    queueFind('bids', [
      sealedBid({ id: 'bid-early', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' }),
      sealedBid({ id: 'bid-late', user: 'user-b', amount: 150_000, createdAt: '2026-02-01T10:05:00Z' }),
    ])
    queueFind('bids', [])
    await confirmWinner(auctionId, 'bid-early', adminToken('confirmer-admin'))

    expect(auctionUpdates()[0]?.data).toEqual({
      status: 'appraised',
      winningBid: 'bid-early',
      finalPrice: 150_000,
    })
  })

  it('publishes finalPrice with the decrypted amount and queues the contract when the top bid meets the reserve', async () => {
    await approvedSession('opener-admin', 'approver-admin')
    queueFind('auctions', [endedAuction({ reservePrice: 100_000 })])
    queueFind('bids', [
      sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' }),
      sealedBid({ id: 'bid-b', user: 'user-b', amount: 120_000, createdAt: '2026-02-01T10:05:00Z' }),
    ])
    queueFind('bids', [{ id: 'bid-b', status: 'leading' }])

    await confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin'))

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'bids', id: 'bid-a', data: { status: 'won' } }),
    )
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'bids', id: 'bid-b', data: { status: 'lost' } }),
    )
    expect(auctionUpdates()[0]?.data).toEqual({
      status: 'appraised',
      winningBid: 'bid-a',
      finalPrice: 150_000,
    })
    expect(prepareContract).toHaveBeenCalledWith(auctionId, 'auction')
    expect(auditCreateActions()).toContain('winner_confirmed')
  })

  it('backfills the statistics snapshot eur from the published finalPrice without recounting the auction', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction({ objectType: 'forest', reservePrice: 25_000 })])
    queueFind('bids', [
      sealedBid({ id: 'bid-a', user: 'user-a', amount: 27_500, createdAt: '2026-02-01T10:00:00Z' }),
    ])
    queueFind('bids', [])
    queueFind('statistics-snapshots', [
      { id: 'snap-1', date: new Date().toISOString(), objectType: 'forest', count: 1, area: 12.5, eur: 0 },
    ])

    await confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin'))

    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'statistics-snapshots',
        id: 'snap-1',
        data: { count: 1, area: 12.5, eur: 27_500 },
      }),
    )
  })

  it('treats a bid equal to the reserve price as meeting the reserve', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction({ reservePrice: 150_000 })])
    queueFind('bids', [sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' })])
    queueFind('bids', [])

    await confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin'))

    expect(auctionUpdates()[0]?.data).toEqual({
      status: 'appraised',
      winningBid: 'bid-a',
      finalPrice: 150_000,
    })
  })

  it('marks the auction unsold when the top decrypted bid is below the reserve', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction({ reservePrice: 200_000 })])
    queueFind('bids', [
      sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' }),
      sealedBid({ id: 'bid-b', user: 'user-b', amount: 120_000, createdAt: '2026-02-01T10:05:00Z' }),
    ])

    await confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin'))

    expect(auctionUpdates()[0]?.data).toEqual({ status: 'unsold' })
    expect(mockPayload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'bids', id: 'bid-a' }),
    )
    expect(mockPayload.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'statistics-snapshots' }),
    )
    expect(mockPayload.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'statistics-snapshots' }),
    )
    expect(prepareContract).not.toHaveBeenCalled()

    const events = endedEvents()
    expect(events).toHaveLength(1)
    expect(events[0]?.userId).toBe('user-a')
    expect(events[0]?.payload).toMatchObject({
      hasWinner: false,
      reserveNotMet: true,
      amount: 150_000,
    })
    expect(auditCreateActions()).toContain('reserve_not_met')
  })

  it('notifies each distinct losing bidder with their userId and never the winner', async () => {
    await approvedSession()
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [
      sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:00:00Z' }),
      sealedBid({ id: 'bid-b1', user: 'user-b', amount: 120_000, createdAt: '2026-02-01T10:05:00Z' }),
      sealedBid({ id: 'bid-b2', user: 'user-b', amount: 110_000, createdAt: '2026-02-01T10:10:00Z' }),
      sealedBid({ id: 'bid-c', user: 'user-c', amount: 100_000, createdAt: '2026-02-01T10:15:00Z' }),
    ])
    queueFind('bids', [
      { id: 'bid-b1', status: 'leading' },
      { id: 'bid-b2', status: 'leading' },
      { id: 'bid-c', status: 'leading' },
    ])

    await confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin'))

    const events = endedEvents()
    expect(events.map((event) => event.userId)).toEqual(['user-b', 'user-c'])
    for (const event of events) {
      expect(event.payload).toMatchObject({ hasWinner: true, finalPrice: 150_000 })
    }
  })

  it('drops undecryptable bids from the ranking and rejects them as the winner', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const tampered = tamperSealedPayload(
      sealedBid({ id: 'bid-tampered', user: 'user-t', amount: 999_999, createdAt: '2026-02-01T10:00:00Z' }),
    )
    await approvedSession()
    queueFind('auctions', [endedAuction()])
    queueFind('bids', [
      tampered,
      sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:05:00Z' }),
    ])

    await expect(
      confirmWinner(auctionId, 'bid-tampered', adminToken('confirmer-admin')),
    ).rejects.toThrow('Bid is invalid (decryption failed) and cannot win')
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bid-tampered marked invalid'))

    queueFind('auctions', [endedAuction()])
    queueFind('bids', [
      tampered,
      sealedBid({ id: 'bid-a', user: 'user-a', amount: 150_000, createdAt: '2026-02-01T10:05:00Z' }),
    ])
    queueFind('bids', [])
    await confirmWinner(auctionId, 'bid-a', adminToken('confirmer-admin'))

    expect(auctionUpdates()[0]?.data).toEqual({
      status: 'appraised',
      winningBid: 'bid-a',
      finalPrice: 150_000,
    })
    errorSpy.mockRestore()
  })
})
