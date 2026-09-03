import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { eventBus } from '../../notifications/event-bus'
import {
  isAlapakkumineEnabled,
  approveAlapakkumine,
  rejectAlapakkumine,
} from '../alapakkumine'
import { fakeD1, type FakeD1, type RecordedStatement } from './fake-d1'
import { setD1ForTests } from '../../db'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { getRepositories } from '@/lib/data/runtime'

let mockRepos: { find: ReturnType<typeof vi.fn> }
let statements: RecordedStatement[]
let d1: FakeD1

beforeEach(() => {
  vi.clearAllMocks()
  statements = []
  d1 = fakeD1(statements)
  setD1ForTests(d1)
  mockRepos = { find: vi.fn() }
  vi.mocked(getRepositories).mockImplementation(() => mockRepos as never)
})

afterEach(() => {
  setD1ForTests(null)
})

const pendingBid = {
  id: 'bid-1',
  auctionId: 'auction-1',
  userId: 'user-9',
  amountCents: 8000,
  status: 'pending_approval',
}
const activeAuction = {
  id: 'auction-1',
  status: 'active',
  title: 'Test auction',
}

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
  it('takes the lead and demotes the current leader in one batch', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'lead-1',
            auctionId: 'auction-1',
            userId: 'user-2',
            amountCents: 6000,
            status: 'leading',
          },
        ],
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
      expect(decision.displacedLeader).toEqual({
        userId: 'user-2',
        amount: 60,
      })
    }
    expect(statements.length).toBe(2)
    expect(
      statements.some(
        (statement) =>
          statement.sql.startsWith('update bids') &&
          statement.params.includes('outbid') &&
          statement.params.includes('lead-1'),
      ),
    ).toBe(true)
    const promote = statements.find((statement) =>
      statement.params.includes('bid-1'),
    )
    expect(promote?.sql).toContain('status = ?')
    expect(promote?.params).toContain('leading')
    expect(promote?.params).toContain('pending_approval')
  })

  it('approves without a leader when no leading bid exists', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({ docs: [] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('approved')
    if (decision.outcome === 'approved') {
      expect(decision.displacedLeader).toBeNull()
    }
    expect(
      statements.some((statement) => statement.params.includes('outbid')),
    ).toBe(false)
  })

  it('returns higher_bid_exists without writing when a higher regular bid leads', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit')
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'lead-1',
            auctionId: 'auction-1',
            userId: 'user-2',
            amountCents: 10000,
            status: 'leading',
          },
        ],
      })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'higher_bid_exists' })
    expect(statements.length).toBe(0)
    expect(emitSpy).not.toHaveBeenCalled()
    emitSpy.mockRestore()
  })

  it('still promotes when the leading amount ties the under-start bid', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'lead-1',
            auctionId: 'auction-1',
            userId: 'user-2',
            amountCents: 8000,
            status: 'leading',
          },
        ],
      })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('approved')
    if (decision.outcome === 'approved') {
      expect(decision.displacedLeader).toEqual({
        userId: 'user-2',
        amount: 80,
      })
    }
    expect(
      statements.some(
        (statement) =>
          statement.sql.startsWith('update bids') &&
          statement.params.includes('outbid') &&
          statement.params.includes('lead-1'),
      ),
    ).toBe(true)
    expect(
      statements.some(
        (statement) =>
          statement.sql.startsWith('update bids') &&
          statement.params.includes('leading') &&
          statement.params.includes('bid-1'),
      ),
    ).toBe(true)
  })

  it('emits bid.approved and outbid events with userId after the write', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit')
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({
        docs: [
          {
            id: 'lead-1',
            auctionId: 'auction-1',
            userId: 'user-2',
            amountCents: 6000,
            status: 'leading',
          },
        ],
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
    mockRepos.find
      .mockResolvedValueOnce({ docs: [{ ...pendingBid, status: 'leading' }] })
      .mockResolvedValueOnce({ docs: [activeAuction] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'not_pending', status: 'leading' })
    expect(
      statements.some((statement) => statement.sql.includes('update bids')),
    ).toBe(false)
  })

  it('reports a conflict when the guarded update matches no rows', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit')
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
      .mockResolvedValueOnce({ docs: [] })
    d1.updateChanges = 0

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({
      outcome: 'not_pending',
      status: 'pending_approval',
    })
    expect(emitSpy).not.toHaveBeenCalled()
    emitSpy.mockRestore()
  })

  it('refuses to approve after the auction ended', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [{ ...activeAuction, status: 'ended' }] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'auction_not_active' })
    expect(
      statements.some((statement) => statement.sql.includes('update bids')),
    ).toBe(false)
  })

  it('returns bid_not_found when the bid belongs to another auction', async () => {
    mockRepos.find.mockResolvedValueOnce({
      docs: [{ ...pendingBid, auctionId: 'auction-2' }],
    })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'bid_not_found' })
  })

  it('returns bid_not_found when the bid does not exist', async () => {
    mockRepos.find.mockResolvedValueOnce({ docs: [] })

    const decision = await approveAlapakkumine('auction-1', 'missing')

    expect(decision).toEqual({ outcome: 'bid_not_found' })
  })

  it('returns auction_not_found when the auction read finds no row', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [] })

    const decision = await approveAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'auction_not_found' })
    expect(statements.some((statement) => statement.sql.includes('update bids'))).toBe(false)
  })
})

describe('rejectAlapakkumine', () => {
  it('sets the pending bid to rejected and notifies the bidder', async () => {
    const emitSpy = vi.spyOn(eventBus, 'emit')
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('rejected')
    if (decision.outcome === 'rejected') {
      expect(decision.bid.bidderId).toBe('user-9')
    }
    expect(statements.length).toBe(1)
    const reject = statements[0]
    expect(reject).toBeDefined()
    if (!reject) return
    expect(reject.sql).toContain('status = ?')
    expect(reject.params).toContain('rejected')
    expect(reject.params).toContain('bid-1')
    expect(reject.params).toContain('pending_approval')
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'bid.rejected', userId: 'user-9' }),
    )
    emitSpy.mockRestore()
  })

  it('still rejects after the auction ended (cleanup path)', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [{ ...activeAuction, status: 'ended' }] })

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision.outcome).toBe('rejected')
  })

  it('is a no-op conflict when the bid is no longer pending', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [{ ...pendingBid, status: 'rejected' }] })
      .mockResolvedValueOnce({ docs: [activeAuction] })

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({ outcome: 'not_pending', status: 'rejected' })
    expect(
      statements.some((statement) => statement.sql.includes('update bids')),
    ).toBe(false)
  })

  it('reports a conflict when the guarded update matches no rows', async () => {
    mockRepos.find
      .mockResolvedValueOnce({ docs: [pendingBid] })
      .mockResolvedValueOnce({ docs: [activeAuction] })
    d1.updateChanges = 0

    const decision = await rejectAlapakkumine('auction-1', 'bid-1')

    expect(decision).toEqual({
      outcome: 'not_pending',
      status: 'pending_approval',
    })
  })

  it('returns bid_not_found when the bid does not exist', async () => {
    mockRepos.find.mockResolvedValueOnce({ docs: [] })

    const decision = await rejectAlapakkumine('auction-1', 'missing')

    expect(decision).toEqual({ outcome: 'bid_not_found' })
  })
})
