import { describe, it, expect, vi, beforeEach } from 'vitest'

import { placeBid, computeIpHash, type BidResult, type BidError } from '../place-bid'

function assertBidError(result: BidResult): asserts result is BidError {
  expect(result.success).toBe(false)
}

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
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  db: { drizzle: { transaction: (fn: (tx: unknown) => Promise<unknown>) => Promise<unknown> } }
}
let txStatements: string[]
let nextInsertId: number

beforeEach(() => {
  vi.clearAllMocks()
  txStatements = []
  nextInsertId = 42
  const fakeTx = {
    execute: (query: unknown) => {
      const text = sqlText(query)
      txStatements.push(text)
      if (text.includes('for update')) return Promise.resolve({ rows: [{ id: 'auction-1' }] })
      if (text.includes('insert into bids')) {
        nextInsertId += 1
        return Promise.resolve({ rows: [{ id: nextInsertId, created_at: '2026-01-01T00:00:00Z' }] })
      }
      return Promise.resolve({ rows: [] })
    },
  }
  mockPayload = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    db: {
      drizzle: {
        transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(fakeTx),
      },
    },
  }
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
    settings?: Record<string, unknown> | null
    leadingBid?: Record<string, unknown> | null
    frameworkTemplate?: Record<string, unknown> | null
    signedContract?: Record<string, unknown> | null
    idempotencyDuplicate?: boolean
  }) {
    mockPayload.find.mockResolvedValueOnce({ docs: opts.user ? [opts.user] : [] })
    mockPayload.find.mockResolvedValueOnce({ docs: opts.auction ? [opts.auction] : [] })
    if (opts.hasRights !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.hasRights ? [{ id: 'right-1' }] : [] })
    }
    if (opts.settings !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.settings ? [opts.settings] : [] })
    }
    if (opts.leadingBid !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.leadingBid ? [opts.leadingBid] : [] })
    }
    if (opts.frameworkTemplate !== undefined) {
      mockPayload.find.mockResolvedValueOnce({
        docs: opts.frameworkTemplate ? [opts.frameworkTemplate] : [],
      })
    }
    if (opts.signedContract !== undefined) {
      mockPayload.find.mockResolvedValueOnce({
        docs: opts.signedContract ? [opts.signedContract] : [],
      })
    }
    if (opts.idempotencyDuplicate !== undefined) {
      mockPayload.find.mockResolvedValueOnce({ docs: opts.idempotencyDuplicate ? [{ id: 'dup' }] : [] })
    }
  }

  // Settings with the gate explicitly off keep the mock queue free of the
  // gate reads; every other default mirrors the seed configuration.
  const gateOffSettings = { featureFlags: { requireFrameworkContract: false } }
  const activeAuction = {
    minBid: 50,
    bidStep: 10,
    status: 'active',
    endsAt: '2099-01-01T00:00:00Z',
    objectType: 'forest',
    title: 'Test auction',
  }

  describe('step math', () => {
    it('accepts bid equal to minBid when no leading bid exists', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: null,
      })

      const result = await placeBid(baseParams)
      expect(result.success).toBe(true)
    })

    it('accepts bid >= leading + bidStep when leading bid exists', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: { id: 'lead-1', amount: 100, source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
    })

    it('rejects bid < leading + bidStep when leading bid exists', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: { id: 'lead-1', amount: 100, source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 105 })
      assertBidError(result)
      expect(result.error).toContain('110')
    })

    it('uses default bidStep of 0 when bidStep is undefined', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { ...activeAuction, bidStep: undefined },
        hasRights: true,
        settings: gateOffSettings,
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
        auction: { ...activeAuction, minBid: 100 },
        hasRights: true,
        settings: { ...gateOffSettings, alapakkumineEnabled: false },
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
      mockPayload.find.mockResolvedValueOnce({ docs: [{ ...activeAuction, status: 'ended' }] })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.error).toBe('Auction is not active')
      expect(result.status).toBe(400)
    })
  })

  describe('end time check', () => {
    it('rejects bid when auction has ended', async () => {
      mockPayload.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
      mockPayload.find.mockResolvedValueOnce({ docs: [{ ...activeAuction, endsAt: '2020-01-01T00:00:00Z' }] })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.error).toBe('Auction has ended')
      expect(result.status).toBe(400)
    })
  })

  describe('outbidding', () => {
    it('updates old leading bid status to outbid in the same transaction', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: { id: 'lead-1', amount: 100, user: 'user-2', source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
      expect(
        txStatements.some(
          (text) => text.includes("update bids set status = 'outbid'") && text.includes('lead-1'),
        ),
      ).toBe(true)
    })
  })

  describe('idempotency key', () => {
    it('prevents double-submit when idempotency key already used', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
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
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: null,
        idempotencyDuplicate: false,
      })

      const result = await placeBid({ ...baseParams, amount: 100, idempotencyKey: 'fresh-key' })
      expect(result.success).toBe(true)
      expect(
        txStatements.some((text) => text.includes('insert into bids') && text.includes('fresh-key')),
      ).toBe(true)
    })
  })

  describe('transaction', () => {
    it('locks the auction row before any reads', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: null,
      })

      await placeBid(baseParams)
      expect(txStatements[0]).toContain('for update')
      expect(txStatements[0]).toContain('auctions')
    })
  })

  describe('ipHash', () => {
    it('stores a salted server-side hash of the request IP, never the raw IP', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: null,
      })

      const result = await placeBid({ ...baseParams, requestIp: '203.0.113.7, 10.0.0.1' })
      expect(result.success).toBe(true)
      const insert = txStatements.find((text) => text.includes('insert into bids'))
      expect(insert).toContain(computeIpHash('203.0.113.7'))
      expect(insert).not.toContain('203.0.113.7')
    })
  })

  describe('alapakkumine', () => {
    it('stores a below-minBid bid as pending_approval when enabled', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: { ...gateOffSettings, alapakkumineEnabled: true },
      })

      const result = await placeBid({ ...baseParams, amount: 30 })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.bid.status).toBe('pending_approval')
      }
      const insert = txStatements.find((text) => text.includes('insert into bids'))
      expect(insert).toContain('pending_approval')
    })

    it('rejects the previous pending bid when a new one arrives', async () => {
      mockPayload.find.mockResolvedValue({ docs: [] })
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
        .mockResolvedValueOnce({ docs: [activeAuction] })
        .mockResolvedValueOnce({ docs: [{ id: 'right-1' }] })
        .mockResolvedValueOnce({ docs: [{ ...gateOffSettings, alapakkumineEnabled: true }] })
        .mockResolvedValueOnce({ docs: [{ id: 'old-pending' }] })

      const result = await placeBid({ ...baseParams, amount: 30 })
      expect(result.success).toBe(true)
      expect(
        txStatements.some(
          (text) => text.includes("update bids set status = 'rejected'") && text.includes('old-pending'),
        ),
      ).toBe(true)
    })
  })

  describe('framework contract gate', () => {
    it('blocks an unsigned bidder when the gate is active by default', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: { alapakkumineEnabled: false },
        leadingBid: null,
        frameworkTemplate: { id: 'template-1' },
        signedContract: null,
      })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.status).toBe(403)
      expect(result.code).toBe('framework_contract_required')
      expect(result.redirectUrl).toBe('/contracts/framework')
    })

    it('passes a signed bidder when the gate is active', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: { alapakkumineEnabled: false },
        leadingBid: null,
        frameworkTemplate: { id: 'template-1' },
        signedContract: { id: 'contract-1' },
      })

      const result = await placeBid(baseParams)
      expect(result.success).toBe(true)
    })
  })
})
