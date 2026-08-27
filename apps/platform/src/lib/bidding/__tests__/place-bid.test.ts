import { describe, it, expect, vi, beforeEach } from 'vitest'

import { placeBid, type BidResult, type BidError } from '../place-bid'

function assertBidError(result: BidResult): asserts result is BidError {
  expect(result.success).toBe(false)
}

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

import { getPayloadClient } from '@/payload/payloadClient'

let mockPayload: { find: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockPayload = { find: vi.fn(), create: vi.fn(), update: vi.fn() }
  vi.mocked(getPayloadClient).mockImplementation(() => mockPayload as never)
})

describe('placeBid', () => {
  const baseParams = {
    userId: 'user-1',
    auctionId: 'auction-1',
    amount: 100,
    type: 'open' as const,
    source: 'manual' as const,
  }

  function setupDefaultMocks(opts: {
    user?: Record<string, unknown>
    auction?: Record<string, unknown>
    hasRights?: boolean
    leadingBid?: Record<string, unknown> | null
    idempotencyDuplicate?: boolean
  }) {
    mockPayload.find.mockResolvedValueOnce({ docs: opts.user ? [opts.user] : [] })
    mockPayload.find.mockResolvedValueOnce({ docs: opts.auction ? [opts.auction] : [] })
    if (opts.hasRights !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.hasRights ? [{ id: 'right-1' }] : [] })
    }
    if (opts.leadingBid !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.leadingBid ? [opts.leadingBid] : [] })
    }
    mockPayload.find.mockResolvedValueOnce({ docs: [{ featureFlags: { requireFrameworkContract: false } }] })
    if (opts.idempotencyDuplicate !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.idempotencyDuplicate ? [{ id: 'dup' }] : [] })
    }
  }

  function mockCreateBid() {
    mockPayload.create.mockResolvedValueOnce({ id: 'new-bid-1', amount: baseParams.amount })
  }

  describe('step math', () => {
    it('accepts bid equal to minBid when no leading bid exists', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: null,
      })
      mockCreateBid()

      const result = await placeBid(baseParams)
      expect(result.success).toBe(true)
    })

    it('accepts bid >= leading + bidStep when leading bid exists', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: { id: 'lead-1', amount: 100, source: 'manual' },
      })
      mockCreateBid()

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
    })

    it('rejects bid < leading + bidStep when leading bid exists', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: { id: 'lead-1', amount: 100, source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 105 })
      assertBidError(result)
      expect(result.error).toContain('110')
    })

    it('uses default bidStep of 0 when bidStep is undefined', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: { id: 'lead-1', amount: 100, source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 100 })
      expect(result.success).toBe(true)
    })
  })

  describe('minimum bid validation', () => {
    it('rejects bid below minBid', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 100, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
      })

      const result = await placeBid({ ...baseParams, amount: 50 })
      assertBidError(result)
      expect(result.error).toContain('100')
      expect(result.status).toBe(400)
    })
  })

  describe('auction active check', () => {
    it('rejects bid when auction is not active', async () => {
      mockPayload.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
      mockPayload.find.mockResolvedValueOnce({ docs: [{ minBid: 50, status: 'ended', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' }] })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.error).toBe('Auction is not active')
      expect(result.status).toBe(400)
    })
  })

  describe('end time check', () => {
    it('rejects bid when auction has ended', async () => {
      mockPayload.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
      mockPayload.find.mockResolvedValueOnce({ docs: [{ minBid: 50, status: 'active', endsAt: '2020-01-01T00:00:00Z', objectType: 'forest' }] })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.error).toBe('Auction has ended')
      expect(result.status).toBe(400)
    })
  })

  describe('outbidding', () => {
    it('updates old leading bid status to outbid', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: { id: 'lead-1', amount: 100, source: 'manual' },
      })
      mockCreateBid()

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
      expect(mockPayload.update).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: 'bids',
          id: 'lead-1',
          data: { status: 'outbid' },
        }),
      )
    })
  })

  describe('idempotency key', () => {
    it('prevents double-submit when idempotency key already used', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: null,
        idempotencyDuplicate: true,
      })

      const result = await placeBid({ ...baseParams, amount: 100, idempotencyKey: 'dup-key' })
      assertBidError(result)
      expect(result.error).toBe('Duplicate bid (idempotency key already used)')
      expect(result.status).toBe(409)
    })

    it('passes through when idempotency key is unique', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { minBid: 50, bidStep: 10, status: 'active', endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' },
        hasRights: true,
        leadingBid: null,
        idempotencyDuplicate: false,
      })
      mockCreateBid()

      const result = await placeBid({ ...baseParams, amount: 100, idempotencyKey: 'fresh-key' })
      expect(result.success).toBe(true)
    })
  })
})