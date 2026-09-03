import { describe, it, expect, vi } from 'vitest'

import {
  AuctionStreamError,
  createAuctionFeedStream,
  createAuctionStream,
  ingestAuctionEvent,
} from '../auction-stream'

const decoder = new TextDecoder()

interface RecordedCall {
  auctionId: string
  operation: string
  url: string
}

function makeDoFetch(
  respond?: (call: RecordedCall) => Response | null,
): { doFetch: ReturnType<typeof vi.fn>; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const doFetch = vi.fn((auctionId: string, operation: string, call: { body?: string }) => {
    const body = call.body ?? ''
    const url = (JSON.parse(body) as { url?: string }).url ?? ''
    const record = { auctionId, operation, url }
    calls.push(record)
    if (respond) return Promise.resolve(respond(record))
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  })
  return { doFetch, calls }
}

function subscriptionIdOf(calls: RecordedCall[], auctionId: string): string {
  const call = calls.find((c) => c.operation === 'subscribe' && c.auctionId === auctionId)
  if (!call) throw new Error('no subscribe call recorded')
  const last = call.url.split('/').pop()
  if (last === undefined) throw new Error('subscriber URL missing its id')
  return last
}

const ORIGIN = 'https://app.test'

async function readChunk(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): Promise<string> {
  const { value } = await reader.read()
  if (value === undefined) throw new Error('stream ended')
  return decoder.decode(value)
}

describe('createAuctionStream registration', () => {
  it('registers a unique subscriber URL on the AuctionDO', async () => {
    const { doFetch, calls } = makeDoFetch()
    await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.operation).toBe('subscribe')
    expect(calls[0]?.url).toMatch(
      /^https:\/\/app\.test\/api\/v1\/internal\/auction-events\/[0-9a-f-]{36}$/,
    )
  })

  it('rejects when the AuctionDO refuses the subscription', async () => {
    const { doFetch } = makeDoFetch(() =>
      new Response(JSON.stringify({ error: 'auction not found' }), { status: 404 }),
    )
    await expect(
      createAuctionStream('auction-1', { origin: ORIGIN, doFetch }),
    ).rejects.toBeInstanceOf(AuctionStreamError)
  })

  it('rejects when the DO transport throws', async () => {
    const doFetch = vi.fn(() => Promise.reject(new Error('network unreachable')))
    await expect(
      createAuctionStream('auction-1', { origin: ORIGIN, doFetch }),
    ).rejects.toBeInstanceOf(AuctionStreamError)
  })

  it('degrades to a heartbeat-only stream without a DO binding', async () => {
    vi.useFakeTimers()
    try {
      const { doFetch } = makeDoFetch(() => null)
      const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
      const reader = stream.getReader()
      const readPromise = reader.read()
      vi.advanceTimersByTime(30_000)
      const { value } = await readPromise
      expect(decoder.decode(value)).toBe(': heartbeat\n\n')
      await reader.cancel()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('createAuctionStream event piping', () => {
  it('pipes every public event name through with identical frame bytes', async () => {
    const { doFetch, calls } = makeDoFetch()
    const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
    const reader = stream.getReader()
    const subscriptionId = subscriptionIdOf(calls, 'auction-1')

    const events = [
      {
        type: 'bid:created',
        data: { auctionId: 'auction-1', placedAt: '2024-06-15T12:00:00.000Z' },
        raw:
          'event: bid:created\n' +
          'data: {"auctionId":"auction-1","placedAt":"2024-06-15T12:00:00.000Z"}\n\n',
      },
      {
        type: 'auction:extended',
        data: {
          auctionId: 'auction-1',
          previousEndsAt: '2024-06-15T12:00:00.000Z',
          endsAt: '2024-06-15T12:05:00.000Z',
        },
        raw:
          'event: auction:extended\n' +
          'data: {"auctionId":"auction-1","previousEndsAt":"2024-06-15T12:00:00.000Z","endsAt":"2024-06-15T12:05:00.000Z"}\n\n',
      },
      {
        type: 'auction:ended',
        data: { auctionId: 'auction-1', type: 'open', hasWinner: true },
        raw:
          'event: auction:ended\n' +
          'data: {"auctionId":"auction-1","type":"open","hasWinner":true}\n\n',
      },
      {
        type: 'auction:published',
        data: {
          auctionId: 'auction-1',
          endsAt: '2024-06-20T18:00:00.000Z',
          objectType: 'puit',
        },
        raw:
          'event: auction:published\n' +
          'data: {"auctionId":"auction-1","endsAt":"2024-06-20T18:00:00.000Z","objectType":"puit"}\n\n',
      },
    ] as const

    for (const event of events) {
      const delivered = ingestAuctionEvent(subscriptionId, {
        type: event.type,
        auctionId: 'auction-1',
        data: event.data,
      })
      expect(delivered).toBe(true)
      expect(await readChunk(reader)).toBe(event.raw)
    }

    await reader.cancel()
  })

  it('keeps the bid payload anonymised', async () => {
    const { doFetch, calls } = makeDoFetch()
    const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
    const reader = stream.getReader()
    const subscriptionId = subscriptionIdOf(calls, 'auction-1')

    ingestAuctionEvent(subscriptionId, {
      type: 'bid:created',
      data: { auctionId: 'auction-1', placedAt: '2024-06-15T12:00:00.000Z' },
    })
    const raw = await readChunk(reader)
    // The frame carries exactly auctionId + placedAt: no amount field.
    expect(raw).toBe(
      'event: bid:created\n' +
        'data: {"auctionId":"auction-1","placedAt":"2024-06-15T12:00:00.000Z"}\n\n',
    )
    expect(raw).not.toContain('amount')
    expect(raw).not.toContain('bidder')
    expect(raw).not.toContain('user')

    await reader.cancel()
  })

  it('sends a 30-second comment heartbeat', async () => {
    vi.useFakeTimers()
    const { doFetch } = makeDoFetch()
    const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
    const reader = stream.getReader()
    try {
      const readPromise = reader.read()
      vi.advanceTimersByTime(30_000)
      const { value } = await readPromise
      expect(decoder.decode(value)).toBe(': heartbeat\n\n')
    } finally {
      await reader.cancel()
      vi.useRealTimers()
    }
  })

  it('unsubscribes from the DO on cancellation', async () => {
    const { doFetch, calls } = makeDoFetch()
    const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
    const reader = stream.getReader()
    const subscriptionId = subscriptionIdOf(calls, 'auction-1')

    await reader.cancel()
    await new Promise((resolve) => setTimeout(resolve, 0))

    const unsubscribe = calls.find((c) => c.operation === 'unsubscribe')
    expect(unsubscribe?.url).toBe(`${ORIGIN}/api/v1/internal/auction-events/${subscriptionId}`)

    expect(
      ingestAuctionEvent(subscriptionId, {
        type: 'bid:created',
        data: { auctionId: 'auction-1', placedAt: '2024-06-15T12:00:00.000Z' },
      }),
    ).toBe(false)
  })
})

describe('fan-out ingestion edge cases', () => {
  it('rejects unknown subscription ids', () => {
    expect(ingestAuctionEvent('missing', { type: 'bid:created', data: {} })).toBe(false)
  })

  it('rejects payloads without a known event name', async () => {
    const { doFetch, calls } = makeDoFetch()
    const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
    const reader = stream.getReader()
    const subscriptionId = subscriptionIdOf(calls, 'auction-1')

    expect(ingestAuctionEvent(subscriptionId, { type: 'user:deleted', data: {} })).toBe(false)
    expect(ingestAuctionEvent(subscriptionId, 'not-an-object')).toBe(false)

    await reader.cancel()
  })
})

describe('createAuctionFeedStream merged stream', () => {
  it('pipes events from every subscribed auction and skips failed feeds', async () => {
    const { doFetch, calls } = makeDoFetch((call) =>
      call.auctionId === 'auction-dead'
        ? new Response(JSON.stringify({ error: 'auction not found' }), { status: 404 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    )
    const stream = await createAuctionFeedStream(
      ['auction-1', 'auction-dead', 'auction-2'],
      { origin: ORIGIN, doFetch },
    )
    const reader = stream.getReader()

    expect(calls.filter((c) => c.operation === 'subscribe')).toHaveLength(3)

    const first = subscriptionIdOf(calls, 'auction-1')
    const second = subscriptionIdOf(calls, 'auction-2')

    ingestAuctionEvent(first, {
      type: 'bid:created',
      data: { auctionId: 'auction-1', placedAt: '2024-06-15T12:00:00.000Z' },
    })
    expect(await readChunk(reader)).toContain('"auctionId":"auction-1"')

    ingestAuctionEvent(second, {
      type: 'auction:ended',
      data: { auctionId: 'auction-2', type: 'open', hasWinner: false },
    })
    expect(await readChunk(reader)).toContain('"auctionId":"auction-2"')

    await reader.cancel()
  })

  it('serves a heartbeat-only stream when the auction list is empty', async () => {
    vi.useFakeTimers()
    const { doFetch, calls } = makeDoFetch()
    const stream = await createAuctionFeedStream([], { origin: ORIGIN, doFetch })
    const reader = stream.getReader()
    try {
      expect(calls).toHaveLength(0)
      const readPromise = reader.read()
      vi.advanceTimersByTime(30_000)
      const { value } = await readPromise
      expect(decoder.decode(value)).toBe(': heartbeat\n\n')
    } finally {
      await reader.cancel()
      vi.useRealTimers()
    }
  })
})

describe('legacy emit shims', () => {
  it('emit helpers stay callable and produce no frames', async () => {
    vi.useFakeTimers()
    try {
      const { emitBidCreated, emitAuctionExtended, emitAuctionEnded, emitAuctionPublished } =
        await import('../auction-stream')
      const { doFetch, calls } = makeDoFetch()
      const stream = await createAuctionStream('auction-1', { origin: ORIGIN, doFetch })
      const reader = stream.getReader()
      const subscriptionId = subscriptionIdOf(calls, 'auction-1')

      emitBidCreated({ auctionId: 'auction-1', amount: 10 })
      emitAuctionExtended({
        auctionId: 'auction-1',
        previousEndsAt: new Date(),
        endsAt: new Date(),
      })
      emitAuctionEnded({ auctionId: 'auction-1', type: 'open' })
      emitAuctionPublished({ auctionId: 'auction-1' })

      const readPromise = reader.read()
      vi.advanceTimersByTime(30_000)
      const { value } = await readPromise
      expect(decoder.decode(value)).toBe(': heartbeat\n\n')
      expect(
        ingestAuctionEvent(subscriptionId, { type: 'bid:created', data: {} }),
      ).toBe(true)
      await reader.cancel()
    } finally {
      vi.useRealTimers()
    }
  })
})
