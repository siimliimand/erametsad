import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  getUserEventStream,
  pushBidEvent,
  pushOutbid,
  pushAuctionEnd,
  pushNotification,
  pushCountdownSync,
} from '../my-stream'

const decoder = new TextDecoder()

interface Frame {
  event: string
  data: Record<string, unknown>
}

function parseFrame(chunk: Uint8Array): Frame {
  const raw = decoder.decode(chunk)
  const eventMatch = /^event: (.+)$/m.exec(raw)
  const dataMatch = /^data: (.+)$/m.exec(raw)
  const event = eventMatch?.[1]
  const data = dataMatch?.[1]
  if (!event || !data) {
    throw new Error(`Unexpected SSE frame: ${raw}`)
  }
  return {
    event,
    data: JSON.parse(data) as Record<string, unknown>,
  }
}

describe('my-stream per-user events', () => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
    const stream = getUserEventStream('user-1')
    reader = stream.getReader()
  })

  afterEach(async () => {
    if (reader) {
      await reader.cancel()
      reader = undefined
    }
    vi.useRealTimers()
  })

  async function nextFrame(): Promise<Frame> {
    if (!reader) throw new Error('reader missing')
    const { value } = await reader.read()
    return parseFrame(value as Uint8Array)
  }

  it('sends a connected frame on stream start', async () => {
    const frame = await nextFrame()
    expect(frame.event).toBe('connected')
    expect(frame.data).toEqual({ status: 'ok' })
  })

  it('keeps the connection alive with a 30-second comment heartbeat', async () => {
    await nextFrame()

    const readPromise = reader!.read()
    vi.advanceTimersByTime(30_000)
    const { value } = await readPromise
    expect(decoder.decode(value as Uint8Array)).toBe(': heartbeat\n\n')
  })

  it('pushOutbid delivers the outbid event to the affected user', async () => {
    await nextFrame()

    const placedAt = new Date('2024-06-15T11:59:30Z')
    pushOutbid('user-1', {
      auctionId: 'auction-1',
      auctionTitle: 'Metsatükk Harjumaal',
      previousAmount: 200,
      newAmount: 250,
      placedAt,
    })

    const frame = await nextFrame()
    expect(frame.event).toBe('outbid')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      auctionTitle: 'Metsatükk Harjumaal',
      previousAmount: 200,
      newAmount: 250,
      placedAt: placedAt.toISOString(),
    })
  })

  it('pushBidEvent delivers the bid event with a numeric userId', async () => {
    const stream = getUserEventStream('42')
    const numericReader = stream.getReader()
    try {
      const connected = await numericReader.read()
      expect(decoder.decode(connected.value as Uint8Array)).toContain('connected')

      pushBidEvent(42, {
        auctionId: 'auction-1',
        bidId: 'bid-7',
        amount: 250,
        status: 'leading',
      })

      const { value } = await numericReader.read()
      const raw = decoder.decode(value as Uint8Array)
      expect(raw).toContain('event: bid')
      expect(JSON.parse(/^data: (.+)$/m.exec(raw)?.[1] ?? '{}')).toEqual({
        auctionId: 'auction-1',
        bidId: 'bid-7',
        amount: 250,
        status: 'leading',
        placedAt: new Date('2024-06-15T12:00:00Z').toISOString(),
      })
    } finally {
      await numericReader.cancel()
    }
  })

  it('pushAuctionEnd delivers the auction_end event', async () => {
    await nextFrame()

    pushAuctionEnd('user-1', {
      auctionId: 'auction-1',
      outcome: 'won',
      finalPrice: 2500,
      endedAt: new Date('2024-06-15T12:00:00Z'),
    })

    const frame = await nextFrame()
    expect(frame.event).toBe('auction_end')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      auctionTitle: undefined,
      outcome: 'won',
      finalPrice: 2500,
      endedAt: new Date('2024-06-15T12:00:00Z').toISOString(),
    })
  })

  it('pushNotification delivers the notification event', async () => {
    await nextFrame()

    pushNotification('user-1', {
      notificationId: 'notif-3',
      event: 'outbid',
      title: 'Teie pakkumus on üle pakutud',
      sentAt: new Date('2024-06-15T12:00:01Z'),
    })

    const frame = await nextFrame()
    expect(frame.event).toBe('notification')
    expect(frame.data).toEqual({
      notificationId: 'notif-3',
      event: 'outbid',
      title: 'Teie pakkumus on üle pakutud',
      body: undefined,
      sentAt: new Date('2024-06-15T12:00:01Z').toISOString(),
    })
  })

  it('pushCountdownSync delivers normalised server and end times', async () => {
    await nextFrame()

    pushCountdownSync('user-1', {
      auctionId: 'auction-1',
      endsAt: new Date('2024-06-20T18:00:00Z'),
    })

    const frame = await nextFrame()
    expect(frame.event).toBe('countdown_sync')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      endsAt: new Date('2024-06-20T18:00:00Z').toISOString(),
      serverTime: new Date('2024-06-15T12:00:00Z').toISOString(),
    })
  })

  it('delivers nothing to a user without connections', async () => {
    await nextFrame()

    const readPromise = reader!.read()
    pushOutbid('user-2', { auctionId: 'auction-1', newAmount: 300 })

    const winner = await Promise.race([
      readPromise.then(() => 'read'),
      Promise.resolve('pending'),
    ])
    expect(winner).toBe('pending')
  })
})
