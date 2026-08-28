import { describe, it, expect, vi, beforeEach } from 'vitest'

import { eventBus } from '../../notifications/event-bus'
import {
  isAlapakkumineEnabled,
  approveAlapakkumine,
  rejectAlapakkumine,
} from '../alapakkumine'

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

import { getPayloadClient } from '@/payload/payloadClient'

// Drizzle SQL objects expose their fragments through queryChunks: string
// fragments as StringChunk.value, bound values as raw primitives. Joining
// them gives a matchable approximation of the statement text and params.
function sqlText(query: unknown): string {
  const chunks = (query as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks
    .map((chunk) => {
      if (chunk === null || chunk === undefined) return ''
      if (typeof chunk === 'string') return chunk
      if (typeof chunk === 'number' || typeof chunk === 'bigint' || typeof chunk === 'boolean') {
        return String(chunk)
      }
      if (typeof chunk === 'object') {
        const value = (chunk as { value?: unknown }).value
        if (typeof value === 'string') return value
        if (Array.isArray(value)) {
          return value.map((part) => (typeof part === 'string' ? part : '')).join('')
        }
        return ''
      }
      return ''
    })
    .join(' ')
}

let mockPayload: {
  find: ReturnType<typeof vi.fn>
  db: { drizzle: { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> } }
}
let txStatements: string[]
let lockRows: Record<string, unknown>[]

beforeEach(() => {
  vi.clearAllMocks()
  txStatements = []
  lockRows = [{ id: 'auction-1' }]
  const fakeTx = {
    execute: (query: unknown) => {
      const text = sqlText(query)
      txStatements.push(text)
      if (text.includes('for update')) return Promise.resolve({ rows: lockRows })
      return Promise.resolve({ rows: [] })
    },
  }
  mockPayload = {
    find: vi.fn(),
    db: {
      drizzle: {
        transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
      },
    },
  }
  vi.mocked(getPayloadClient).mockImplementation(() => mockPayload as never)
})

const pendingBid = {
  id: 'bid-1',
  auction: 'auction-1',
  user: 'user-9',
  amount: 80,
  status: 'pending_approval',
}
const activeAuction = { id: 'auction-1', status: 'active', title: 'Test auction' }

describe('isAlapakkumineEnabled', () => {
  it('is enabled only when settings explicitly set the flag', () => {
    expect(isAlapakkumineEnabled({ alapakkumineEnabled: true })).toBe(true)
    expect(isAlapakkumineEnabled({ alapakkumineEnabled: false })).toBe(false)
    expect(isAlapakkumineEnabled({})).toBe(false)
    expect(isAlapakkumineEnabled(null)).toBe(false)
    expect(isAlapakkumineEnabled(undefined)).toBe(false)
  })
})

describe('approveAlapakkumine', () => {
  it('locks the auction row, takes the lead and demotes the current leader', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({
        docs: [{ id: 'lead-1', auction: 'auction-1', user: 'user-2', amount: 100, status: 'leading' }],
      })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('approved')
    if (decision.outcome === 'approved') {
      expect(decision.bid).toEqual({
        bidId: 'bid-1',
        bidderId: 'user-9',
        amount: 80,
        auctionTitle: 'Test auction',
      })
      expect(decision.displacedLeader).toEqual({ userId: 'user-2', amount: 100 })
    }
    expect(txStatements[0]).toContain('for update')
    expect(
      txStatements.some(
        (text) => text.includes("update bids set status = 'outbid'") && text.includes('lead-1'),
      ),
    ).toBe(true)
    expect(
      txStatements.some(
        (text) =>
          text.includes("update bids set status = 'leading'") &&
          text.includes('bid-1') &&
          text.includes("status = 'pending_approval'"),
      ),
    ).toBe(true)
  })

  it('approves without a leader when no leading bid exists', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({ docs: [] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('approved')
    if (decision.outcome === 'approved') {
      expect(decision.displacedLeader).toBeNull()
    }
    expect(txStatements.some((text) => text.includes("'outbid'"))).toBe(false)
  })

  it('emits bid.approved and outbid events with userId after commit', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit')
    mockPayload.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({
        docs: [{ id: 'lead-1', auction: 'auction-1', user: 'user-2', amount: 100, status: 'leading' }],
      })

    await approveAlapakkumine('auction-1', 'bid-1')

    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bid.approved', userId: 'user-9' }),
    )
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'outbid', userId: 'user-2' }),
    )
    emitSpy.mockRestore()
  })

  it('is a no-op conflict when the bid already left pending_approval (serialised race)', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [{ ...pendingBid, status: 'leading' }] })
      .mockResolvedValueOnce({ docs: [activeAuction] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'not_pending', status: 'leading' })
    expect(txStatements.some((text) => text.includes('update bids'))).toBe(false)
  })

  it('refuses to approve after the auction ended', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [{ ...activeAuction, status: 'ended' }] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'auction_not_active' })
    expect(txStatements.some((text) => text.includes('update bids'))).toBe(false)
  })

  it('returns bid_not_found when the bid belongs to another auction', async () => {
    mockPayload.find.mockResolvedValueOnce({
      docs: [{ ...pendingBid, auction: 'auction-2' }],
    })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'bid_not_found' })
  })

  it('returns bid_not_found when the bid does not exist', async () => {
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    const decision = await approveAlapakkumine('auction-1', 'missing')

    expect(decision).toEqual({ outcome: 'bid_not_found' })
  })

  it('returns auction_not_found when the lock finds no auction row', async () => {
    lockRows = []
    mockPayload.find.mockResolvedValue({ docs: [] })

    const decision = await approveAlapakkumine('missing', 'bid-1')

    expect(decision).toEqual({ outcome: 'auction_not_found' })
  })
})

describe('rejectAlapakkumine', () => {
  it('sets the pending bid to rejected under the lock and notifies the bidder', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit')
    mockPayload.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('rejected')
    if (decision.outcome === 'rejected') {
      expect(decision.bid.bidderId).toBe('user-9')
    }
    expect(txStatements[0]).toContain('for update')
    expect(
      txStatements.some(
        (text) =>
          text.includes("update bids set status = 'rejected'") &&
          text.includes('bid-1') &&
          text.includes("status = 'pending_approval'"),
      ),
    ).toBe(true)
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bid.rejected', userId: 'user-9' }),
    )
    emitSpy.mockRestore()
  })

  it('still rejects after the auction ended (cleanup path)', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [{ ...activeAuction, status: 'ended' }] })

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('rejected')
  })

  it('is a no-op conflict when the bid is no longer pending', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [{ ...pendingBid, status: 'rejected' }] })
      .mockResolvedValueOnce({ docs: [activeAuction] })

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'not_pending', status: 'rejected' })
    expect(txStatements.some((text) => text.includes('update bids'))).toBe(false)
  })

  it('returns bid_not_found when the bid does not exist', async () => {
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    const decision = await rejectAlapakkumine('auction-1', 'missing')

    expect(decision).toEqual({ outcome: 'bid_not_found' })
  })
})
