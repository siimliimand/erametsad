import { describe, it, expect, vi, beforeEach } from 'vitest'

type UpdateCall = [data: Record<string, unknown>, params?: Record<string, unknown>]

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

vi.mock('../../notifications/event-bus', () => ({
  eventBus: { emit: vi.fn() },
}))

vi.mock('../../realtime/auction-stream', () => ({
  broadcast: vi.fn(),
}))

import { eventBus } from '../../notifications/event-bus'
import { broadcast } from '../../realtime/auction-stream'
import { processEndedAuctions } from '../auction-ending'

import { getPayloadClient } from '@/payload/payloadClient'

let mockPayload: { find: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; findByID: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockPayload = { find: vi.fn(), create: vi.fn(), update: vi.fn(), findByID: vi.fn() }
  vi.mocked(getPayloadClient).mockResolvedValue(mockPayload as never)
})

describe('processEndedAuctions', () => {
  function mockAuctionsQuery(auctions: Record<string, unknown>[]) {
    mockPayload.find.mockResolvedValueOnce({ docs: auctions })
  }

  function mockAuctionFindByID(auction: Record<string, unknown> | null) {
    mockPayload.findByID.mockResolvedValueOnce(auction)
  }

  function mockBidsQuery(bids: Record<string, unknown>[]) {
    mockPayload.find.mockResolvedValueOnce({ docs: bids })
  }

  it('processes active auction past endTime to ended', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'open', objectType: 'forest', cadastres: [] },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'active', type: 'open', objectType: 'forest', cadastres: [] })
    mockBidsQuery([{ id: 'lead-bid-1', amount: 1000 }])
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    const result = await processEndedAuctions()

    expect(result.processed).toBe(1)
    expect(mockPayload.update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'auctions',
        id: 'auction-1',
        data: expect.objectContaining({ status: 'ended' }) as Record<string, unknown>,
      }),
    )
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(eventBus).emit).toHaveBeenCalled()
     
    expect(vi.mocked(broadcast)).toHaveBeenCalled()
  })

  it('transitions auction with leading bid to ended correctly', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'open', objectType: 'forest', cadastres: [] },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'active', type: 'open', objectType: 'forest', cadastres: [] })
    mockBidsQuery([{ id: 'winning-bid', amount: 5000 }])
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    await processEndedAuctions()

    const allUpdates = mockPayload.update.mock.calls
    const auctionUpdates = allUpdates.filter(
      (c) => ((c as unknown[])[0] as { collection?: string }).collection === 'auctions',
    )
    expect(auctionUpdates.length).toBe(1)
    expect(((mockPayload.update.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data.status).toBe('ended')
    expect(((mockPayload.update.mock.calls[0] as unknown[])[0] as { data: Record<string, unknown> }).data.winningBid).toBe('winning-bid')
  })

  it('transitions auction with needsAppraisal to appraised', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'open', objectType: 'forest', cadastres: [], needsAppraisal: true },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'active', type: 'open', objectType: 'forest', cadastres: [], needsAppraisal: true })
    mockBidsQuery([{ id: 'winning-bid', amount: 5000 }])
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    await processEndedAuctions()

    const allUpdates = mockPayload.update.mock.calls as unknown as UpdateCall[]
    const auctionUpdates = allUpdates.filter(
      (c) => c[0].collection === 'auctions',
    )
    expect(auctionUpdates.length).toBe(1)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const updateData = auctionUpdates[0]![0] as { data: Record<string, unknown> }
    expect(updateData.data.status).toBe('appraised')
    expect(updateData.data.appraisedAt).toBeDefined()
  })

  it('goes to unsold when auction has no leading bid', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'open', objectType: 'forest', cadastres: [] },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'active', type: 'open', objectType: 'forest', cadastres: [] })
    mockBidsQuery([])
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    await processEndedAuctions()

    const allUpdates = mockPayload.update.mock.calls as unknown as UpdateCall[]
    const auctionUpdates = allUpdates.filter(
      (c) => c[0].collection === 'auctions',
    )
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (auctionUpdates.length > 0) {
      const call = auctionUpdates[0] as unknown[]
      const callData = call[0] as { data: Record<string, unknown> }
      expect(callData.data.status).toBe('unsold')
    }
    expect(auctionUpdates.length).toBe(1)
  })

  it('handles sealed auction type', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'sealed', objectType: 'forest', cadastres: [] },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'active', type: 'sealed', objectType: 'forest', cadastres: [] })
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    await processEndedAuctions()

    const allUpdates = mockPayload.update.mock.calls as unknown as UpdateCall[]
    const auctionUpdates = allUpdates.filter(
      (c) => c[0].collection === 'auctions',
    )
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (auctionUpdates.length > 0) {
      const call = auctionUpdates[0] as unknown[]
      const callData = call[0] as { data: Record<string, unknown> }
      expect(callData.data.status).toBe('ended')
    }
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(vi.mocked(eventBus).emit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'auction.ended',
        payload: expect.objectContaining({ type: 'sealed' }) as Record<string, unknown>,
      }),
    )
  })

  it('skips already-ended auction (idempotent)', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'open', objectType: 'forest' },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'ended', type: 'open', objectType: 'forest' })

    const result = await processEndedAuctions()

    expect(result.skipped).toBe(1)
  })

  it('writes statistics snapshot on completion', async () => {
    mockAuctionsQuery([
      { id: 'auction-1', status: 'active', endsAt: '2024-01-01T00:00:00Z', type: 'open', objectType: 'forest', cadastres: [{ area: 100 }] },
    ])
    mockAuctionFindByID({ id: 'auction-1', status: 'active', type: 'open', objectType: 'forest', cadastres: [{ area: 100 }] })
    mockBidsQuery([{ id: 'winning-bid', amount: 5000 }])
    mockPayload.find.mockResolvedValueOnce({ docs: [] })

    await processEndedAuctions()

    expect(mockPayload.create).toHaveBeenCalledWith({
      collection: 'statistics-snapshots',
      data: expect.objectContaining({
        objectType: 'forest',
        eur: 5000,
        area: 100,
        count: 1,
      }) as Record<string, unknown>,
      depth: 0,
    })
  })
})