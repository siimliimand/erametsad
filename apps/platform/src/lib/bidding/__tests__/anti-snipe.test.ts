import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { checkAntiSnipe } from '../anti-snipe'

const mockPayload = {
  find: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(() => mockPayload),
}))

vi.mock('../../realtime/auction-stream', () => ({
  emitAuctionExtended: vi.fn(),
}))

import { emitAuctionExtended } from '../../realtime/auction-stream'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkAntiSnipe', () => {
  const now = new Date('2024-06-15T12:00:00Z')

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function makeAuction(
    endsAt: Date,
    type?: string,
  ): { endsAt: string; id: string; type?: string } {
    return {
      endsAt: endsAt.toISOString(),
      id: 'auction-1',
      ...(type !== undefined ? { type } : {}),
    }
  }

  it('extends endTime by N minutes when bid is within anti-snipe window', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 })

    expect(result.extended).toBe(true)
    expect(result.newEndTime).toBeDefined()
    const expectedEnd = new Date(endsAt.getTime() + 5 * 60 * 1000)
    expect((result.newEndTime as unknown as Date).getTime()).toBe(expectedEnd.getTime())

    expect(mockPayload.update).toHaveBeenCalledWith({
      collection: 'auctions',
      id: 'auction-1',
      data: { endsAt: expectedEnd.toISOString() },
    })
  })

  it('does not extend when bid is outside anti-snipe window', async () => {
    const endsAt = new Date(now.getTime() + 10 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 })

    expect(result.extended).toBe(false)
    expect(result.newEndTime).toBeUndefined()
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('uses default 5-minute window when settings value is missing', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, {})

    expect(result.extended).toBe(true)
    const expectedEnd = new Date(endsAt.getTime() + 5 * 60 * 1000)
    expect((result.newEndTime as unknown as Date).getTime()).toBe(expectedEnd.getTime())
  })

  it('extended auction can be further extended by another bid', async () => {
    const endsAt = new Date(now.getTime() + 1 * 60 * 1000)
    const auction = makeAuction(endsAt)
    await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 })

    vi.setSystemTime(new Date(now.getTime() + 3 * 60 * 1000))

    const auction2 = makeAuction(new Date(now.getTime() + 6 * 60 * 1000))
    mockPayload.update.mockClear()
    const result = await checkAntiSnipe(auction2, { antiSnipeDurationMinutes: 5 })
    expect(result.extended).toBe(true)
  })

  it('does nothing when auction has already ended (now >= endsAt)', async () => {
    const endsAt = new Date(now.getTime() - 1 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 })

    expect(result.extended).toBe(false)
    expect(mockPayload.update).not.toHaveBeenCalled()
  })

  it('never extends a sealed auction', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt, 'sealed')

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 })

    expect(result.extended).toBe(false)
    expect(mockPayload.update).not.toHaveBeenCalled()
    expect(mockPayload.create).not.toHaveBeenCalled()
    expect(emitAuctionExtended).not.toHaveBeenCalled()
  })

  it('clamps the window to 30 minutes when settings exceed the range', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 45 })

    expect(result.extended).toBe(true)
    expect(result.windowMinutes).toBe(30)
    const expectedEnd = new Date(endsAt.getTime() + 30 * 60 * 1000)
    expect((result.newEndTime as unknown as Date).getTime()).toBe(expectedEnd.getTime())
  })

  it('clamps the window to 1 minute when settings are below the range', async () => {
    const endsAt = new Date(now.getTime() + 30 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 0 })

    expect(result.extended).toBe(true)
    expect(result.windowMinutes).toBe(1)
  })

  it('writes an audit entry and broadcasts auction:extended on extension', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 }, {
      actorId: 'user-9',
      triggeredByBidId: 'bid-7',
    })

    expect(result.extended).toBe(true)
    const expectedEnd = new Date(endsAt.getTime() + 5 * 60 * 1000)

    expect(mockPayload.create).toHaveBeenCalledWith({
      collection: 'audit-entry',
      data: {
        action: 'anti_snipe_extension',
        entityType: 'auction',
        entityId: 'auction-1',
        actor: 'user-9',
        before: { endsAt: endsAt.toISOString() },
        after: {
          endsAt: expectedEnd.toISOString(),
          windowMinutes: 5,
          bidId: 'bid-7',
        },
      },
    })

    expect(emitAuctionExtended).toHaveBeenCalledWith({
      auctionId: 'auction-1',
      previousEndsAt: endsAt,
      endsAt: expectedEnd,
    })
  })

  it('loads the window from the Settings collection when settings are omitted', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    mockPayload.find.mockReturnValueOnce({
      docs: [{ antiSnipeDurationMinutes: 7 }],
    })

    const result = await checkAntiSnipe(auction)

    expect(mockPayload.find).toHaveBeenCalledWith({
      collection: 'settings',
      limit: 1,
      depth: 0,
    })
    expect(result.extended).toBe(true)
    expect(result.windowMinutes).toBe(7)
    const expectedEnd = new Date(endsAt.getTime() + 7 * 60 * 1000)
    expect((result.newEndTime as unknown as Date).getTime()).toBe(expectedEnd.getTime())
  })

  it('falls back to the default when the Settings collection is empty', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    mockPayload.find.mockReturnValueOnce({ docs: [] })

    const result = await checkAntiSnipe(auction)

    expect(result.extended).toBe(true)
    expect(result.windowMinutes).toBe(5)
  })
})
