import { describe, it, expect, vi, beforeEach } from 'vitest'
import { evaluateAutobidders } from '../autobidder'

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

vi.mock('../place-bid', () => ({
  placeBid: vi.fn(),
}))

import { getPayloadClient } from '@/payload/payloadClient'
import { placeBid } from '../place-bid'

let mockPayload: { find: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockPayload = { find: vi.fn(), create: vi.fn(), update: vi.fn() }
  vi.mocked(getPayloadClient).mockImplementation(async () => mockPayload as never)
  vi.mocked(placeBid).mockResolvedValue({ success: true, bid: { id: 'auto-bid-1' } } as never)
})

describe('evaluateAutobidders', () => {
  function mockSinglePass(maxAmount: number) {
    mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'auctions') return { docs: [{ id: 'auction-1', bidStep: 10 }] }
      if (collection === 'bids') return { docs: [{ id: 'lead-1', amount: 100, source: 'manual' }] }
      if (collection === 'autobidders') {
        return {
          docs: [
            { id: 'ab-1', user: 'user-auto-1', maxAmount, status: 'active', createdAt: '2024-01-01T00:00:00Z' },
          ],
        }
      }
      return { docs: [] }
    })
  }

  it('autobidder responds to manual bid by placing minimum increment above it', async () => {
    mockSinglePass(200)
    vi.mocked(placeBid).mockResolvedValue({ success: true, bid: {} } as never)

    await evaluateAutobidders('auction-1', 100)

    expect(vi.mocked(placeBid)).toHaveBeenCalledWith({
      userId: 'user-auto-1',
      auctionId: 'auction-1',
      amount: 110,
      type: 'open',
      source: 'autobidder',
    })
  })

  it('autobidder capped at maxAmount does not exceed it', async () => {
    mockSinglePass(105)

    await evaluateAutobidders('auction-1', 195)

    expect(vi.mocked(placeBid)).not.toHaveBeenCalled()
  })

  it('no autobidder response if maxAmount <= current leading amount', async () => {
    mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) => {
      if (collection === 'auctions') return { docs: [{ id: 'auction-1', bidStep: 10 }] }
      if (collection === 'bids') return { docs: [{ id: 'lead-1', amount: 200, source: 'manual' }] }
      if (collection === 'autobidders') return { docs: [{ id: 'ab-1', user: 'user-auto-1', maxAmount: 200, status: 'active', createdAt: '2024-01-01T00:00:00Z' }] }
      return { docs: [] }
    })

    await evaluateAutobidders('auction-1', 200)

    expect(vi.mocked(placeBid)).not.toHaveBeenCalled()
  })

  describe('tie-breaking', () => {
    it('equal maxAmount resolves to earlier-created autobidder', async () => {
      mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'auctions') return { docs: [{ id: 'auction-1', bidStep: 10 }] }
        if (collection === 'bids') return { docs: [{ id: 'lead-1', amount: 100, source: 'manual' }] }
        if (collection === 'autobidders') {
          return {
            docs: [
              { id: 'ab-old', user: 'user-old', maxAmount: 200, status: 'active', createdAt: '2024-01-01T00:00:00Z' },
              { id: 'ab-new', user: 'user-new', maxAmount: 200, status: 'active', createdAt: '2024-01-10T00:00:00Z' },
            ],
          }
        }
        return { docs: [] }
      })
      vi.mocked(placeBid).mockResolvedValue({ success: false } as never)

      await evaluateAutobidders('auction-1', 100)

      expect(vi.mocked(placeBid)).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-old', amount: 110 }),
      )
    })

    it('autobidder-vs-autobidder resolves to secondMax + step when maxAmounts differ', async () => {
      mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'auctions') return { docs: [{ id: 'auction-1', bidStep: 10 }] }
        if (collection === 'bids') return { docs: [{ id: 'lead-1', amount: 100, source: 'autobidder' }] }
        if (collection === 'autobidders') {
          return {
            docs: [
              { id: 'ab-high', user: 'user-high', maxAmount: 300, status: 'active', createdAt: '2024-01-01T00:00:00Z' },
              { id: 'ab-low', user: 'user-low', maxAmount: 200, status: 'active', createdAt: '2024-01-10T00:00:00Z' },
            ],
          }
        }
        return { docs: [] }
      })
      vi.mocked(placeBid).mockResolvedValue({ success: false } as never)

      await evaluateAutobidders('auction-1', 100)

      expect(vi.mocked(placeBid)).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-high', amount: 110 }),
      )
    })

    it('autobidder-vs-autobidder with same maxAmount places bid at maxAmount', async () => {
      mockPayload.find.mockImplementation(async ({ collection }: { collection: string }) => {
        if (collection === 'auctions') return { docs: [{ id: 'auction-1', bidStep: 10 }] }
        if (collection === 'bids') return { docs: [{ id: 'lead-1', amount: 100, source: 'autobidder' }] }
        if (collection === 'autobidders') {
          return {
            docs: [
              { id: 'ab-1', user: 'user-1', maxAmount: 200, status: 'active', createdAt: '2024-01-01T00:00:00Z' },
              { id: 'ab-2', user: 'user-2', maxAmount: 200, status: 'active', createdAt: '2024-01-10T00:00:00Z' },
            ],
          }
        }
        return { docs: [] }
      })
      vi.mocked(placeBid).mockResolvedValue({ success: false } as never)

      await evaluateAutobidders('auction-1', 100)

      expect(vi.mocked(placeBid)).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user-1', amount: 200 }),
      )
    })
  })
})