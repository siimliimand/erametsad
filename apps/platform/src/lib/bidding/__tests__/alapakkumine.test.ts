import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  handleAlapakkumine,
  approveAlapakkumine,
  rejectAlapakkumine,
} from '../alapakkumine'

const mockPayload = {
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(() => mockPayload),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('handleAlapakkumine', () => {
  const auction = { minBid: 100, id: 'auction-1' }

  it('returns leading when bid amount >= minBid', async () => {
    const bid = { id: 'bid-1', amount: 100, auction: 'auction-1' }
    const result = await handleAlapakkumine(bid, auction)
    expect(result).toEqual({ status: 'leading', requiresApproval: false })
  })

  it('returns pending_approval when bid amount < minBid and alapakkumine is enabled', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [{ alapakkumineEnabled: true }] })
      .mockResolvedValueOnce({ docs: [] })

    const bid = { id: 'bid-1', amount: 80, auction: 'auction-1' }
    const result = await handleAlapakkumine(bid, auction)

    expect(result).toEqual({ status: 'pending_approval', requiresApproval: true })
    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'bids',
      id: 'bid-1',
      data: { status: 'pending_approval' },
    })
  })

  it('rejects bid when alapakkumine is disabled in settings', async () => {
    mockPayload.find.mockResolvedValueOnce({ docs: [{ alapakkumineEnabled: false }] })

    const bid = { id: 'bid-1', amount: 80, auction: 'auction-1' }
    const result = await handleAlapakkumine(bid, auction)

    expect(result).toEqual({ status: 'rejected', requiresApproval: false })
  })

  it('treats missing settings as disabled (alapakkumine off)', async () => {
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    const bid = { id: 'bid-1', amount: 80, auction: 'auction-1' }
    const result = await handleAlapakkumine(bid, auction)

    expect(result).toEqual({ status: 'rejected', requiresApproval: false })
  })

  describe('race guard', () => {
    it('auto-rejects existing pending alapakkumine when a new bid triggers approval', async () => {
      mockPayload.find
        .mockResolvedValueOnce({ docs: [{ alapakkumineEnabled: true }] })
        .mockResolvedValueOnce({ docs: [{ id: 'old-pending-bid' }] })

      const bid = { id: 'bid-2', amount: 80, auction: 'auction-1' }
      const result = await handleAlapakkumine(bid, auction)

      expect(result).toEqual({ status: 'pending_approval', requiresApproval: true })
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'bids',
        id: 'old-pending-bid',
        data: { status: 'rejected' },
      })
      expect(mockPayload.update).toHaveBeenCalledWith({
        collection: 'bids',
        id: 'bid-2',
        data: { status: 'pending_approval' },
      })
    })
  })
})

describe('approveAlapakkumine', () => {
  it('marks bid as leading and outbids current leading', async () => {
    mockPayload.find
      .mockResolvedValueOnce({ docs: [{ id: 'bid-1', auction: 'auction-1', amount: 80 }] })
      .mockResolvedValueOnce({ docs: [{ id: 'existing-lead' }] })

    await approveAlapakkumine('bid-1')

    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'bids',
      id: 'existing-lead',
      data: { status: 'outbid' },
    })
    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'bids',
      id: 'bid-1',
      data: { status: 'leading' },
    })
    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'auctions',
      id: 'auction-1',
      data: { winningBid: 'bid-1' },
    })
  })

  it('throws error when bid not found', async () => {
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    await expect(approveAlapakkumine('nonexistent')).rejects.toThrow('Bid not found')
  })
})

describe('rejectAlapakkumine', () => {
  it('updates bid status to rejected', async () => {
    await rejectAlapakkumine('bid-1')

    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'bids',
      id: 'bid-1',
      data: { status: 'rejected' },
    })
  })
})