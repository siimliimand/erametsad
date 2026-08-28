import type { CollectionBeforeChangeHook } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { statusTransitionHook, validateTransition } from '../../auction/status-transitions'
import type { DomainEvent } from '../../notifications/event-bus'
import { processEndedAuctions } from '../auction-ending'

const { broadcastMock, emitMock, getPayloadClientMock } = vi.hoisted(() => ({
  emitMock: vi.fn<(event: DomainEvent) => void>(),
  broadcastMock: vi.fn<(event: string, data: unknown) => void>(),
  getPayloadClientMock: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: getPayloadClientMock,
}))

vi.mock('../../notifications/event-bus', () => ({
  eventBus: { emit: emitMock },
}))

vi.mock('../../realtime/auction-stream', () => ({
  broadcast: broadcastMock,
}))

type GuardHook = CollectionBeforeChangeHook<Doc>
type GuardHookArgs = Parameters<GuardHook>[0]

interface Doc extends Record<string, unknown> {
  id: string
}

interface FindArgs {
  collection: string
  where?: unknown
}

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

// The spec forbids mocking the collection hooks in a way that bypasses the
// transition guard, so every auctions update below runs through the real
// beforeChange hook. An illegal transition throws and fails the test.
const guardHook = statusTransitionHook as unknown as GuardHook

function conditionMatches(actual: unknown, condition: Record<string, unknown>): boolean {
  const value =
    typeof actual === 'object' && actual !== null && 'id' in actual
      ? (actual as { id: unknown }).id
      : actual
  if ('equals' in condition) {
    return String(value) === String(condition.equals)
  }
  if ('less_than_equal' in condition) {
    return String(value) <= String(condition.less_than_equal)
  }
  return true
}

function matchesWhere(doc: Doc, where: unknown): boolean {
  if (where == null || typeof where !== 'object') return true
  if (Array.isArray(where)) {
    return where.every((clause) => matchesWhere(doc, clause))
  }
  return Object.entries(where as Record<string, unknown>).every(([field, condition]) => {
    if (field === 'and') {
      return matchesWhere(doc, condition)
    }
    return conditionMatches(doc[field], condition as Record<string, unknown>)
  })
}

function createHarness(seed: { auctions?: Doc[]; bids?: Doc[] }) {
  const auctions = (seed.auctions ?? []).map((doc) => ({ ...doc }))
  const bids = (seed.bids ?? []).map((doc) => ({ ...doc }))
  const snapshots: Doc[] = []
  const auctionUpdates: Array<{ id: string; data: Record<string, unknown> }> = []

  const find = vi.fn(
    async ({ collection, where }: FindArgs): Promise<{ docs: Doc[] }> => {
      if (collection === 'auctions') {
        return { docs: auctions.filter((doc) => matchesWhere(doc, where)) }
      }
      if (collection === 'bids') {
        return { docs: bids.filter((doc) => matchesWhere(doc, where)) }
      }
      if (collection === 'statistics-snapshots') {
        return { docs: snapshots.filter((doc) => matchesWhere(doc, where)).slice(0, 1) }
      }
      return { docs: [] }
    },
  )

  const findByID = vi.fn(
    async ({ collection, id }: { collection: string; id: string }): Promise<Doc | null> => {
      if (collection === 'auctions') {
        return auctions.find((doc) => doc.id === id) ?? null
      }
      return null
    },
  )

  const update = vi.fn(
    async ({ collection, id, data }: UpdateArgs): Promise<Doc | null> => {
      if (collection === 'auctions') {
        const doc = auctions.find((a) => a.id === id)
        if (doc == null) throw new Error(`unknown auction: ${id}`)
        auctionUpdates.push({ id, data })
        const next = await guardHook({
          data: { ...doc, ...data },
          originalDoc: doc,
        } as unknown as GuardHookArgs)
        Object.assign(doc, next ?? data)
        return { ...doc }
      }
      if (collection === 'statistics-snapshots') {
        const doc = snapshots.find((s) => s.id === id)
        if (doc == null) return null
        Object.assign(doc, data)
        return doc
      }
      return null
    },
  )

  const create = vi.fn(
    async ({ collection, data }: CreateArgs): Promise<Doc> => {
      const doc: Doc = { id: `snapshot-${snapshots.length + 1}`, ...data }
      if (collection === 'statistics-snapshots') snapshots.push(doc)
      return doc
    },
  )

  getPayloadClientMock.mockResolvedValue({ find, findByID, update, create })

  return { auctions, snapshots, auctionUpdates, find, update, create }
}

type Harness = ReturnType<typeof createHarness>

function activeAuction(overrides: Record<string, unknown> = {}): Doc {
  return {
    id: 'auction-1',
    status: 'active',
    endsAt: '2024-01-01T00:00:00.000Z',
    type: 'open',
    objectType: 'forest',
    title: 'Metsakrunt',
    seller: 'seller-1',
    cadastres: [],
    ...overrides,
  }
}

function leadingBid(overrides: Record<string, unknown> = {}): Doc {
  return {
    id: 'bid-leading',
    amount: 5000,
    status: 'leading',
    auction: 'auction-1',
    user: 'bidder-1',
    ...overrides,
  }
}

function auctionStatuses(h: Harness): unknown[] {
  return h.auctionUpdates.map(({ data }) => data.status)
}

function emittedEvents(): DomainEvent[] {
  return emitMock.mock.calls.map((call) => call[0])
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processEndedAuctions', () => {
  it('moves an open auction with a winning bid through active to ended to appraised via the real guard', async () => {
    const h = createHarness({
      auctions: [activeAuction({ reservePrice: 1000 })],
      bids: [leadingBid({ amount: 5000 })],
    })

    const result = await processEndedAuctions()

    expect(result).toEqual({ processed: 1, skipped: 0 })
    expect(auctionStatuses(h)).toEqual(['ended', 'appraised'])
    expect(h.auctionUpdates[0]?.data).toMatchObject({ status: 'ended' })
    expect(typeof h.auctionUpdates[0]?.data.endedAt).toBe('string')
    expect(h.auctionUpdates[1]?.data).toMatchObject({
      status: 'appraised',
      winningBid: 'bid-leading',
    })

    expect(validateTransition('active', 'ended')).toBe(true)
    expect(validateTransition('ended', 'appraised')).toBe(true)

    const stored = h.auctions[0]
    expect(stored?.status).toBe('appraised')
    expect(stored?.winningBid).toBe('bid-leading')
    expect(typeof stored?.endedAt).toBe('string')
    expect(typeof stored?.appraisedAt).toBe('string')

    const events = emittedEvents()
    const won = events.find((event) => event.type === 'auction.won')
    expect(won?.userId).toBe('bidder-1')
    expect(won?.payload).toMatchObject({ auctionId: 'auction-1', winningBid: 5000 })

    const sellerNotice = events.find((event) => event.type === 'auction.ended')
    expect(sellerNotice?.userId).toBe('seller-1')
    expect(sellerNotice?.payload).toMatchObject({ hasWinner: true, finalPrice: 5000 })

    expect(broadcastMock).toHaveBeenCalledWith('auction:ended', {
      auctionId: 'auction-1',
      type: 'open',
      hasWinner: true,
    })

    expect(h.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'statistics-snapshots',
        data: expect.objectContaining({ objectType: 'forest', eur: 5000, count: 1 }),
      }),
    )
  })

  it('moves an open auction with no bids through active to ended to unsold without error', async () => {
    const h = createHarness({ auctions: [activeAuction()] })

    const result = await processEndedAuctions()

    expect(result).toEqual({ processed: 1, skipped: 0 })
    expect(auctionStatuses(h)).toEqual(['ended', 'unsold'])
    expect(h.auctions[0]?.status).toBe('unsold')
    expect(validateTransition('ended', 'unsold')).toBe(true)
  })

  it('marks the outcome unsold and notifies the bidder when the leading bid is below the reserve price', async () => {
    const h = createHarness({
      auctions: [activeAuction({ reservePrice: 5000 })],
      bids: [leadingBid({ amount: 1000, user: 'bidder-reserve' })],
    })

    await processEndedAuctions()

    expect(auctionStatuses(h)).toEqual(['ended', 'unsold'])
    expect(h.auctions[0]?.status).toBe('unsold')

    const events = emittedEvents()
    expect(events.some((event) => event.type === 'auction.won')).toBe(false)
    const bidderNotice = events.find(
      (event) => event.type === 'auction.ended' && event.userId === 'bidder-reserve',
    )
    expect(bidderNotice?.payload).toMatchObject({ reserveNotMet: true, hasWinner: false })
  })

  it('stops a sealed auction at ended and keeps the opening ceremony available', async () => {
    const h = createHarness({ auctions: [activeAuction({ type: 'sealed' })] })

    const result = await processEndedAuctions()

    expect(result).toEqual({ processed: 1, skipped: 0 })
    expect(auctionStatuses(h)).toEqual(['ended'])
    expect(h.auctions[0]?.status).toBe('ended')
    expect(h.auctions[0]?.winningBid).toBeUndefined()

    expect(h.find.mock.calls.filter((call) => call[0].collection === 'bids')).toHaveLength(0)

    expect(emittedEvents()).toEqual([
      expect.objectContaining({
        type: 'auction.ended',
        userId: 'seller-1',
        payload: expect.objectContaining({ type: 'sealed' }),
      }),
    ])
    expect(broadcastMock).toHaveBeenCalledWith('auction:ended', {
      auctionId: 'auction-1',
      type: 'sealed',
    })
  })

  it('treats any leading bid as a win when the auction sets no reserve price', async () => {
    const h = createHarness({
      auctions: [activeAuction()],
      bids: [leadingBid({ amount: 100 })],
    })

    await processEndedAuctions()

    expect(auctionStatuses(h)).toEqual(['ended', 'appraised'])
    expect(h.auctions[0]?.status).toBe('appraised')
  })

  it('does not write a second outcome when the same auction fires twice', async () => {
    const h = createHarness({
      auctions: [activeAuction()],
      bids: [leadingBid({ amount: 5000 })],
    })

    const first = await processEndedAuctions()
    expect(first.processed).toBe(1)

    const emitCount = emitMock.mock.calls.length
    const broadcastCount = broadcastMock.mock.calls.length
    const createCount = h.create.mock.calls.length

    // Simulate a double fire: the query still returns the stale active row,
    // so the status recheck must stop a second outcome write.
    h.find.mockImplementationOnce(async () => ({ docs: [activeAuction()] }))

    const second = await processEndedAuctions()

    expect(second).toEqual({ processed: 0, skipped: 1 })
    expect(auctionStatuses(h)).toEqual(['ended', 'appraised'])
    expect(emitMock.mock.calls).toHaveLength(emitCount)
    expect(broadcastMock.mock.calls).toHaveLength(broadcastCount)
    expect(h.create.mock.calls).toHaveLength(createCount)
  })

  it('rejects a status write the guard map does not allow', async () => {
    const h = createHarness({ auctions: [activeAuction()] })

    expect(validateTransition('active', 'unsold')).toBe(false)
    await expect(
      h.update({ collection: 'auctions', id: 'auction-1', data: { status: 'unsold' } }),
    ).rejects.toThrow('Invalid status transition: active → unsold')
  })
})
