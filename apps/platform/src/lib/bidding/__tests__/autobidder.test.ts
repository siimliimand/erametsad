import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

vi.mock('../place-bid', () => ({
  placeBid: vi.fn(),
}))

import { evaluateAutobidders } from '../autobidder'
import { placeBid } from '../place-bid'

import { getRepositories } from '@/lib/data/runtime'

const EARLIER = '2024-01-01T00:00:00.000Z'
const LATER = '2024-01-10T00:00:00.000Z'

interface MockLeadingBid {
  userId: string
  amountCents: number
  source: string
}

interface MockAutobidder {
  id: string
  userId: string
  maxAmountCents: number
  createdAt: string
}

let mockRepos: { find: ReturnType<typeof vi.fn> }

function mockAuctionState({
  leadingBid = null,
  autobidders,
}: {
  leadingBid?: MockLeadingBid | null
  autobidders: MockAutobidder[]
}) {
  mockRepos.find.mockImplementation(({ collection }: { collection: string }) => {
    if (collection === 'auctions') {
      return { docs: [{ id: 'auction-1', bidStepCents: 1000, minBidCents: 10000 }] }
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
  mockRepos = { find: vi.fn() }
  vi.mocked(getRepositories).mockImplementation(() => mockRepos as never)
  vi.mocked(placeBid).mockResolvedValue({ success: true, bid: { id: 'auto-bid-1' } } as never)
})

describe('evaluateAutobidders', () => {
  it('answers a manual leading bid of 100 with 110 (step 10, max 200)', async () => {
    mockAuctionState({
      leadingBid: { userId: 'user-manual', amountCents: 10000, source: 'manual' },
      autobidders: [{ id: 'ab-1', userId: 'user-auto', maxAmountCents: 20000, createdAt: EARLIER }],
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
      leadingBid: { userId: 'user-low', amountCents: 10000, source: 'autobidder' },
      autobidders: [
        { id: 'ab-high', userId: 'user-high', maxAmountCents: 30000, createdAt: EARLIER },
        { id: 'ab-low', userId: 'user-low', maxAmountCents: 20000, createdAt: LATER },
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
      leadingBid: { userId: 'user-auto', amountCents: 10000, source: 'autobidder' },
      autobidders: [{ id: 'ab-1', userId: 'user-auto', maxAmountCents: 30000, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).not.toHaveBeenCalled()
  })

  it('breaks an equal-maxAmount tie to the earlier-created autobidder, bidding the shared max of 200', async () => {
    mockAuctionState({
      leadingBid: { userId: 'user-manual', amountCents: 10000, source: 'manual' },
      autobidders: [
        { id: 'ab-early', userId: 'user-early', maxAmountCents: 20000, createdAt: EARLIER },
        { id: 'ab-late', userId: 'user-late', maxAmountCents: 20000, createdAt: LATER },
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
      leadingBid: { userId: 'user-manual', amountCents: 10000, source: 'manual' },
      autobidders: [
        { id: 'ab-cap', userId: 'user-cap', maxAmountCents: 20000, createdAt: EARLIER },
        { id: 'ab-rival', userId: 'user-rival', maxAmountCents: 19500, createdAt: LATER },
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
      leadingBid: { userId: 'user-manual', amountCents: 19500, source: 'manual' },
      autobidders: [{ id: 'ab-1', userId: 'user-auto', maxAmountCents: 20000, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).not.toHaveBeenCalled()
  })

  it('bids the minBid of 100 when no bids exist (single autobidder, max 200)', async () => {
    mockAuctionState({
      leadingBid: null,
      autobidders: [{ id: 'ab-1', userId: 'user-auto', maxAmountCents: 20000, createdAt: EARLIER }],
    })

    await evaluateAutobidders('auction-1')

    expect(placeBid).toHaveBeenCalledTimes(1)
    expect(placeBid).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-auto', amount: 100 }),
    )
  })
})
