import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

vi.mock('../place-bid', () => ({
  placeBid: vi.fn(),
}))

import { evaluateAutobidders } from '../autobidder'
import { placeBid } from '../place-bid'

import { getPayloadClient } from '@/payload/payloadClient'

const EARLIER = '2024-01-01T00:00:00.000Z'
const LATER = '2024-01-10T00:00:00.000Z'

interface MockLeadingBid {
  user: string
  amount: number
  source: string
}

interface MockAutobidder {
  id: string
  user: string
  maxAmount: number
  createdAt: string
}

let mockPayload: { find: ReturnType<typeof vi.fn> }

function mockAuctionState({
  leadingBid = null,
  autobidders,
}: {
  leadingBid?: MockLeadingBid | null
  autobidders: MockAutobidder[]
}) {
  mockPayload.find.mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'auctions') {
      return { docs: [{ id: 'auction-1', bidStep: 10, minBid: 100 }] }
    }
    if (collection === 'bids') {
      return { docs: leadingBid ? [{ id: 'lead-1', ...leadingBid }] : [] }
    }
    if (collection === 'autobidders') {
      return { docs: autobidders.map((a) => ({ ...a, status: 'active' })) }
    }
    return { docs: [] }
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPayload = { find: vi.fn() }
  vi.mocked(getPayloadClient).mockImplementation(() => mockPayload as never)
  vi.mocked(placeBid).mockResolvedValue({ success: true, bid: { id: 'auto-bid-1' } } as never)
})

describe('evaluateAutobidders', () => {
  it('answers a manual leading bid of 100 with 110 (step 10, max 200)', async () => {
    mockAuctionState({
      leadingBid: { user: 'user-manual', amount: 100, source: 'manual' },
      autobidders: [{ id: 'ab-1', user: 'user-auto', maxAmount: 200, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).toHaveBeenCalledTimes(1)
    expect(placeBid).toHaveBeenCalledWith({
      userId: 'user-auto',
      auctionId: 'auction-1',
      amount: 110,
      type: 'open',
      source: 'autobidder',
    })
  })

  it('bids 210 in the auto-vs-auto case (leading 100, step 10, maxes 300 and 200), not 110 and not 300', async () => {
    mockAuctionState({
      leadingBid: { user: 'user-low', amount: 100, source: 'autobidder' },
      autobidders: [
        { id: 'ab-high', user: 'user-high', maxAmount: 300, createdAt: EARLIER },
        { id: 'ab-low', user: 'user-low', maxAmount: 200, createdAt: LATER },
      ],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).toHaveBeenCalledTimes(1)
    expect(placeBid).toHaveBeenCalledWith({
      userId: 'user-high',
      auctionId: 'auction-1',
      amount: 210,
      type: 'open',
      source: 'autobidder',
    })
  })

  it('places no bid when the only active autobidder already holds the leading bid', async () => {
    mockAuctionState({
      leadingBid: { user: 'user-auto', amount: 100, source: 'autobidder' },
      autobidders: [{ id: 'ab-1', user: 'user-auto', maxAmount: 300, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).not.toHaveBeenCalled()
  })

  it('breaks an equal-maxAmount tie to the earlier-created autobidder, bidding the shared max of 200', async () => {
    mockAuctionState({
      leadingBid: { user: 'user-manual', amount: 100, source: 'manual' },
      autobidders: [
        { id: 'ab-early', user: 'user-early', maxAmount: 200, createdAt: EARLIER },
        { id: 'ab-late', user: 'user-late', maxAmount: 200, createdAt: LATER },
      ],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).toHaveBeenCalledTimes(1)
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-early', amount: 200 }),
    )
  })

  it('caps a rival-driven target of 205 at the winner maxAmount of 200 (leading 100, step 10, maxes 200 and 195)', async () => {
    mockAuctionState({
      leadingBid: { user: 'user-manual', amount: 100, source: 'manual' },
      autobidders: [
        { id: 'ab-cap', user: 'user-cap', maxAmount: 200, createdAt: EARLIER },
        { id: 'ab-rival', user: 'user-rival', maxAmount: 195, createdAt: LATER },
      ],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).toHaveBeenCalledTimes(1)
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-cap', amount: 200 }),
    )
  })

  it('places no bid when the minimum increment exceeds the maxAmount (leading 195, step 10, max 200)', async () => {
    // The next valid bid is 205, above the max of 200: never bid above maxAmount.
    mockAuctionState({
      leadingBid: { user: 'user-manual', amount: 195, source: 'manual' },
      autobidders: [{ id: 'ab-1', user: 'user-auto', maxAmount: 200, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).not.toHaveBeenCalled()
  })

  it('bids the minBid of 100 when no bids exist (single autobidder, max 200)', async () => {
    mockAuctionState({
      leadingBid: null,
      autobidders: [{ id: 'ab-1', user: 'user-auto', maxAmount: 200, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).toHaveBeenCalledTimes(1)
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-auto', amount: 100 }),
    )
  })
})
