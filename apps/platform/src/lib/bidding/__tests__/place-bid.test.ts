import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  placeBid,
  computeIpHash,
  type BidResult,
  type BidError,
} from '../place-bid'
import { fakeD1, type FakeD1, type RecordedStatement } from './fake-d1'
import { setD1ForTests } from '../../db'

function assertBidError(result: BidResult): asserts result is BidError {
  expect(result.success).toBe(false)
}

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { getRepositories } from '@/lib/data/runtime'

let mockRepos: {
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
let statements: RecordedStatement[]
let d1: FakeD1

beforeEach(() => {
  vi.clearAllMocks()
  statements = []
  d1 = fakeD1(statements)
  setD1ForTests(d1)
  mockRepos = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  vi.mocked(getRepositories).mockImplementation(() => mockRepos as never)
})

afterEach(() => {
  setD1ForTests(null)
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
    mockRepos.find.mockResolvedValueOnce({
      docs: opts.user ? [opts.user] : [],
    })
    mockRepos.find.mockResolvedValueOnce({
      docs: opts.auction ? [opts.auction] : [],
    })
    if (opts.hasRights !== undefined) {
      mockRepos.find.mockResolvedValueOnce({
        docs: opts.hasRights ? [{ id: 'right-1' }] : [],
      })
    }
    if (opts.settings !== undefined) {
      mockRepos.find.mockResolvedValueOnce({
        docs: opts.settings ? [opts.settings] : [],
      })
    }
    if (opts.leadingBid !== undefined) {
      mockRepos.find.mockResolvedValueOnce({
        docs: opts.leadingBid ? [opts.leadingBid] : [],
      })
    }
    if (opts.frameworkTemplate !== undefined) {
      mockRepos.find.mockResolvedValueOnce({
        docs: opts.frameworkTemplate ? [opts.frameworkTemplate] : [],
      })
    }
    if (opts.signedContract !== undefined) {
      mockRepos.find.mockResolvedValueOnce({
        docs: opts.signedContract ? [opts.signedContract] : [],
      })
    }
    if (opts.idempotencyDuplicate !== undefined) {
      mockRepos.find.mockResolvedValueOnce({
        docs: opts.idempotencyDuplicate ? [{ id: 'dup' }] : [],
      })
    }
  }

  // Settings with the gate explicitly off keep the mock queue free of the
  // gate reads; every other default mirrors the seed configuration.
  const gateOffSettings = { featureFlags: { requireFrameworkContract: false } }
  const activeAuction = {
    minBidCents: 5000,
    bidStepCents: 1000,
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
        leadingBid: { id: 'lead-1', amountCents: 10000, source: 'manual' },
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
        leadingBid: { id: 'lead-1', amountCents: 10000, source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 105 })
      assertBidError(result)
      expect(result.error).toContain('110')
    })

    it('uses default bidStep of 0 when bidStep is undefined', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { ...activeAuction, bidStepCents: null },
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: { id: 'lead-1', amountCents: 10000, source: 'manual' },
      })

      const result = await placeBid({ ...baseParams, amount: 100 })
      expect(result.success).toBe(true)
    })
  })

  describe('minimum bid validation', () => {
    it('rejects bid below minBid', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: { ...activeAuction, minBidCents: 10000 },
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
      mockRepos.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
      mockRepos.find.mockResolvedValueOnce({
        docs: [{ ...activeAuction, status: 'ended' }],
      })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.error).toBe('Auction is not active')
      expect(result.status).toBe(400)
    })
  })

  describe('end time check', () => {
    it('rejects bid when auction has ended', async () => {
      mockRepos.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
      mockRepos.find.mockResolvedValueOnce({
        docs: [{ ...activeAuction, endsAt: '2020-01-01T00:00:00Z' }],
      })

      const result = await placeBid(baseParams)
      assertBidError(result)
      expect(result.error).toBe('Auction has ended')
      expect(result.status).toBe(400)
    })
  })

  describe('outbidding', () => {
    it('demotes the old leading bid in the same atomic batch', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: {
          id: 'lead-1',
          amountCents: 10000,
          userId: 'user-2',
          source: 'manual',
        },
      })

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
      const demote = statements.find(
        (statement) =>
          statement.sql.startsWith('update bids') &&
          statement.params.includes('outbid') &&
          statement.params.includes('lead-1'),
      )
      expect(demote).toBeDefined()
      expect(demote?.sql).toContain('status = ?')
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

      const result = await placeBid({
        ...baseParams,
        amount: 100,
        idempotencyKey: 'dup-key',
      })
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

      const result = await placeBid({
        ...baseParams,
        amount: 100,
        idempotencyKey: 'fresh-key',
      })
      expect(result.success).toBe(true)
      const insert = statements.find((statement) =>
        statement.sql.includes('insert into bids'),
      )
      expect(insert?.params).toContain('fresh-key')
    })
  })

  describe('d1 writes', () => {
    it('uses the SQLite dialect with bound params and no row lock', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: {
          id: 'lead-1',
          amountCents: 10000,
          userId: 'user-2',
          source: 'manual',
        },
      })

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
      expect(statements.length).toBe(2)
      for (const statement of statements) {
        expect(statement.sql).not.toContain('for update')
        expect(statement.sql).not.toContain('$1')
        expect(statement.sql).not.toContain('now()')
      }
    })

    it('stores the amount as integer cents in amount_cents', async () => {
      setupDefaultMocks({
        user: { id: 'user-1' },
        auction: activeAuction,
        hasRights: true,
        settings: gateOffSettings,
        leadingBid: null,
      })

      const result = await placeBid({ ...baseParams, amount: 110 })
      expect(result.success).toBe(true)
      const insert = statements.find((statement) =>
        statement.sql.includes('insert into bids'),
      )
      expect(insert?.sql).toContain('amount_cents')
      expect(insert?.params).toContain(11000)
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

      const result = await placeBid({
        ...baseParams,
        requestIp: '203.0.113.7, 10.0.0.1',
      })
      expect(result.success).toBe(true)
      const insert = statements.find((statement) =>
        statement.sql.includes('insert into bids'),
      )
      expect(insert?.params).toContain(computeIpHash('203.0.113.7'))
      expect(insert?.params).not.toContain('203.0.113.7')
    })
  })

  describe('alapakkumine', () => {
    it('stores a below-minBid bid as pending_approval when enabled', async () => {
      mockRepos.find.mockResolvedValue({ docs: [] })
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
      const insert = statements.find((statement) =>
        statement.sql.includes('insert into bids'),
      )
      expect(insert?.params).toContain('pending_approval')
    })

    it('rejects the previous pending bid when a new one arrives', async () => {
      mockRepos.find.mockResolvedValue({ docs: [] })
      mockRepos.find
        .mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
        .mockResolvedValueOnce({ docs: [activeAuction] })
        .mockResolvedValueOnce({ docs: [{ id: 'right-1' }] })
        .mockResolvedValueOnce({
          docs: [{ ...gateOffSettings, alapakkumineEnabled: true }],
        })
        .mockResolvedValueOnce({ docs: [{ id: 'old-pending' }] })

      const result = await placeBid({ ...baseParams, amount: 30 })
      expect(result.success).toBe(true)
      expect(
        statements.some(
          (statement) =>
            statement.sql.startsWith('update bids') &&
            statement.params.includes('rejected') &&
            statement.params.includes('old-pending'),
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
