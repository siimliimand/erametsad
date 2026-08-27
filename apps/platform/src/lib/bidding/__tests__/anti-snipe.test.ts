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

  function makeAuction(endsAt: Date): { endsAt: string; id: string } {
    return { endsAt: endsAt.toISOString(), id: 'auction-1' }
  }

  it('extends endTime by N minutes when bid is within anti-snipe window', async () => {
    const endsAt = new Date(now.getTime() + 2 * 60 * 1000)
    const auction = makeAuction(endsAt)

    const result = await checkAntiSnipe(auction, { antiSnipeDurationMinutes: 5 })

    expect(result.extended).toBe(true)
    expect(result.newEndTime).toBeDefined()
    const expectedEnd = new Date(endsAt.getTime() + 5 * 60 * 1000)
    expect(result.newEndTime!.getTime()).toBe(expectedEnd.getTime())

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
    expect(result.newEndTime!.getTime()).toBe(expectedEnd.getTime())
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
})