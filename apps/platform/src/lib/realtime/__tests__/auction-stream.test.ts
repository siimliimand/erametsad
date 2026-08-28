import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  addClient,
  removeClient,
  emitBidCreated,
  emitAuctionExtended,
  emitAuctionEnded,
  emitAuctionPublished,
  getEventStream,
} from '../auction-stream'

const decoder = new TextDecoder()

interface Frame {
  event: string
  data: Record<string, unknown>
  raw: string
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
    raw,
  }
}

function firstEnqueued(enqueue: ReturnType<typeof vi.fn>): Uint8Array {
  const call = enqueue.mock.calls[0]
  if (!call) throw new Error('no frame enqueued')
  return call[0] as Uint8Array
}

function fakeController(): {
  controller: ReadableStreamDefaultController<Uint8Array>
  enqueue: ReturnType<typeof vi.fn>
} {
  const enqueue = vi.fn()
  const controller = { enqueue } as unknown as ReadableStreamDefaultController<Uint8Array>
  return { controller, enqueue }
}

describe('auction-stream public events', () => {
  let clientId = ''

  afterEach(() => {
    if (clientId) {
      removeClient(clientId)
      clientId = ''
    }
  })

  it('emitBidCreated sends an anonymised bid:created frame to every client', () => {
    const first = fakeController()
    const second = fakeController()
    const firstClient = addClient(first.controller)
    const secondClient = addClient(second.controller)
    clientId = firstClient.clientId

    const placedAt = new Date('2024-06-15T12:00:00Z')
    emitBidCreated({ auctionId: 'auction-1', amount: 250, placedAt })

    expect(first.enqueue).toHaveBeenCalledTimes(1)
    expect(second.enqueue).toHaveBeenCalledTimes(1)

    const frame = parseFrame(firstEnqueued(first.enqueue))
    expect(frame.event).toBe('bid:created')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      amount: 250,
      placedAt: placedAt.toISOString(),
    })
    expect(frame.raw).not.toContain('bidder')
    expect(frame.raw).not.toContain('user')

    removeClient(secondClient.clientId)
  })

  it('emitBidCreated defaults placedAt to the current time', () => {
    const now = new Date('2024-06-15T12:00:00Z')
    vi.useFakeTimers()
    vi.setSystemTime(now)
    const { controller, enqueue } = fakeController()
    const client = addClient(controller)
    clientId = client.clientId

    emitBidCreated({ auctionId: 'auction-1', amount: 100 })

    const frame = parseFrame(firstEnqueued(enqueue))
    expect(frame.data.placedAt).toBe(now.toISOString())
    vi.useRealTimers()
  })

  it('emitAuctionExtended broadcasts the new end time', () => {
    const { controller, enqueue } = fakeController()
    const client = addClient(controller)
    clientId = client.clientId

    const previousEndsAt = new Date('2024-06-15T12:00:00Z')
    const endsAt = new Date('2024-06-15T12:05:00Z')
    emitAuctionExtended({ auctionId: 'auction-1', previousEndsAt, endsAt })

    const frame = parseFrame(firstEnqueued(enqueue))
    expect(frame.event).toBe('auction:extended')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      previousEndsAt: previousEndsAt.toISOString(),
      endsAt: endsAt.toISOString(),
    })
  })

  it('emitAuctionEnded broadcasts without winner identity', () => {
    const { controller, enqueue } = fakeController()
    const client = addClient(controller)
    clientId = client.clientId

    emitAuctionEnded({ auctionId: 'auction-1', type: 'open', hasWinner: true })

    const frame = parseFrame(firstEnqueued(enqueue))
    expect(frame.event).toBe('auction:ended')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      type: 'open',
      hasWinner: true,
    })
    expect(frame.raw).not.toContain('winner')
    expect(frame.raw).not.toContain('userId')
  })

  it('emitAuctionPublished broadcasts the activation payload', () => {
    const { controller, enqueue } = fakeController()
    const client = addClient(controller)
    clientId = client.clientId

    const endsAt = new Date('2024-06-20T18:00:00Z')
    emitAuctionPublished({ auctionId: 'auction-1', endsAt, objectType: 'puit' })

    const frame = parseFrame(firstEnqueued(enqueue))
    expect(frame.event).toBe('auction:published')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      endsAt: endsAt.toISOString(),
      objectType: 'puit',
    })
  })

  it('drops a client whose controller throws and keeps the others', () => {
    const healthy = fakeController()
    const healthyClient = addClient(healthy.controller)
    clientId = healthyClient.clientId

    let calls = 0
    const brokenEnqueue = vi.fn(() => {
      calls++
      if (calls === 1) throw new Error('stream closed')
    })
    const brokenController = {
      enqueue: brokenEnqueue,
    } as unknown as ReadableStreamDefaultController<Uint8Array>
    const brokenClient = addClient(brokenController)

    emitAuctionEnded({ auctionId: 'auction-1', type: 'open' })

    expect(brokenEnqueue).toHaveBeenCalledTimes(1)
    expect(healthy.enqueue).toHaveBeenCalledTimes(1)

    emitAuctionEnded({ auctionId: 'auction-1', type: 'open' })
    expect(brokenEnqueue).toHaveBeenCalledTimes(1)
    expect(healthy.enqueue).toHaveBeenCalledTimes(2)

    removeClient(brokenClient.clientId)
  })
})

describe('auction-stream connection', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(async () => {
    await vi.runOnlyPendingTimersAsync()
    vi.useRealTimers()
  })

  it('sends a 30-second comment heartbeat', async () => {
    const stream = getEventStream()
    const reader = stream.getReader()

    try {
      const readPromise = reader.read()
      vi.advanceTimersByTime(30_000)
      const { value } = await readPromise
      expect(decoder.decode(value as Uint8Array)).toBe(': heartbeat\n\n')
    } finally {
      await reader.cancel()
    }
  })
})
