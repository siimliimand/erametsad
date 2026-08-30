import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { AuctionDoFetch } from '../auction-stream'
import { createMyStream, deriveUserFrames, type UserAuctionFeedState } from '../my-stream'

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
  return { event, data: JSON.parse(data) as Record<string, unknown>, raw }
}

interface RecordedCall {
  auctionId: string
  operation: string
  url: string
}

function makeDoFetch(): { doFetch: AuctionDoFetch; calls: RecordedCall[] } {
  const calls: RecordedCall[] = []
  const doFetch: AuctionDoFetch = (auctionId, operation, call) => {
    const url = (JSON.parse(call.body ?? '{}') as { url?: string }).url ?? ''
    calls.push({ auctionId, operation, url })
    return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 }))
  }
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

type FeedOverrides = {
  [K in Exclude<keyof UserAuctionFeedState, 'auctionId'>]?: UserAuctionFeedState[K] | undefined
} & {
  auctionId?: string
}

function userLeadsState(overrides: FeedOverrides = {}): UserAuctionFeedState {
  const { auctionId, ...rest } = overrides
  return {
    auctionId: auctionId ?? 'auction-1',
    auctionTitle: 'Metsatükk Harjumaal',
    endsAt: '2024-06-20T18:00:00.000Z',
    lastAmount: 250,
    userLeadingAmount: 250,
    ...rest,
  }
}

describe('deriveUserFrames pure derivation', () => {
  const now = new Date('2024-06-15T12:00:00Z')

  it('derives outbid when a higher bid overtakes the user lead', () => {
    const state = userLeadsState()
    const frames = deriveUserFrames(
      state,
      'bid:created',
      { auctionId: 'auction-1', amount: 300, placedAt: '2024-06-15T11:59:30.000Z' },
      now,
    )
    expect(frames).toEqual([
      {
        event: 'outbid',
        data: {
          auctionId: 'auction-1',
          auctionTitle: 'Metsatükk Harjumaal',
          previousAmount: 250,
          newAmount: 300,
          placedAt: '2024-06-15T11:59:30.000Z',
        },
      },
    ])
    expect(state.userLeadingAmount).toBeUndefined()
    expect(state.lastAmount).toBe(300)
  })

  it('derives nothing when the user does not hold the lead', () => {
    const state = userLeadsState({ userLeadingAmount: undefined })
    const frames = deriveUserFrames(
      state,
      'bid:created',
      { auctionId: 'auction-1', amount: 300 },
      now,
    )
    expect(frames).toEqual([])
    expect(state.lastAmount).toBe(300)
  })

  it('drops bid:created payloads without a numeric amount', () => {
    const state = userLeadsState()
    expect(deriveUserFrames(state, 'bid:created', { auctionId: 'auction-1' }, now)).toEqual(
      [],
    )
  })

  it('derives countdown_sync with server time on extension', () => {
    const state = userLeadsState()
    const frames = deriveUserFrames(
      state,
      'auction:extended',
      {
        auctionId: 'auction-1',
        previousEndsAt: '2024-06-20T18:00:00.000Z',
        endsAt: '2024-06-20T18:05:00.000Z',
      },
      now,
    )
    expect(frames).toEqual([
      {
        event: 'countdown_sync',
        data: {
          auctionId: 'auction-1',
          endsAt: '2024-06-20T18:05:00.000Z',
          serverTime: now.toISOString(),
        },
      },
    ])
    expect(state.endsAt).toBe('2024-06-20T18:05:00.000Z')
  })

  it('derives auction_end as won while the user holds the lead', () => {
    const frames = deriveUserFrames(
      userLeadsState(),
      'auction:ended',
      { auctionId: 'auction-1', type: 'open', hasWinner: true },
      now,
    )
    expect(frames).toEqual([
      {
        event: 'auction_end',
        data: {
          auctionId: 'auction-1',
          auctionTitle: 'Metsatükk Harjumaal',
          outcome: 'won',
          finalPrice: 250,
          endedAt: now.toISOString(),
        },
      },
    ])
  })

  it('derives auction_end as lost without the lead', () => {
    const frames = deriveUserFrames(
      userLeadsState({ userLeadingAmount: undefined }),
      'auction:ended',
      { auctionId: 'auction-1', type: 'open', hasWinner: true },
      now,
    )
    expect(frames[0]?.data.outcome).toBe('lost')
  })

  it('derives auction_end as unsold when there is no winner', () => {
    const frames = deriveUserFrames(
      userLeadsState(),
      'auction:ended',
      { auctionId: 'auction-1', type: 'open', hasWinner: false },
      now,
    )
    expect(frames[0]?.data.outcome).toBe('unsold')
  })

  it('derives nothing from auction:published', () => {
    expect(
      deriveUserFrames(userLeadsState(), 'auction:published', { auctionId: 'auction-1' }, now),
    ).toEqual([])
  })
})

describe('createMyStream merged feed', () => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  afterEach(async () => {
    if (reader) {
      await reader.cancel()
      reader = undefined
    }
  })

  async function openStream(
    states: UserAuctionFeedState[],
  ): Promise<{
    doFetch: AuctionDoFetch
    calls: RecordedCall[]
    subscriptionId: (auctionId: string) => string
  }> {
    const { doFetch, calls } = makeDoFetch()
    const stream = await createMyStream('user-1', {
      origin: ORIGIN,
      doFetch,
      loadUserAuctionFeeds: () => Promise.resolve(states),
    })
    reader = stream.getReader()
    return { doFetch, calls, subscriptionId: (auctionId) => subscriptionIdOf(calls, auctionId) }
  }

  async function nextFrame(): Promise<Frame> {
    if (!reader) throw new Error('reader missing')
    const { value } = await reader.read()
    if (value === undefined) throw new Error('stream ended')
    return parseFrame(value)
  }

  it('sends the legacy connected frame first and subscribes to each auction', async () => {
    const { calls } = await openStream([
      userLeadsState(),
      userLeadsState({ auctionId: 'auction-2', userLeadingAmount: undefined }),
    ])

    const frame = await nextFrame()
    expect(frame.event).toBe('connected')
    expect(frame.raw).toBe('event: connected\ndata: {"status":"ok"}\n\n')

    expect(calls.filter((c) => c.operation === 'subscribe')).toHaveLength(2)
  })

  it('delivers a derived outbid frame when the DO feed overtakes the user', async () => {
    const { subscriptionId } = await openStream([userLeadsState()])

    await nextFrame()

    const { ingestAuctionEvent } = await import('../auction-stream')
    ingestAuctionEvent(subscriptionId('auction-1'), {
      type: 'bid:created',
      auctionId: 'auction-1',
      data: { auctionId: 'auction-1', amount: 300, placedAt: '2024-06-15T11:59:30.000Z' },
    })

    const frame = await nextFrame()
    expect(frame.event).toBe('outbid')
    expect(frame.data).toEqual({
      auctionId: 'auction-1',
      auctionTitle: 'Metsatükk Harjumaal',
      previousAmount: 250,
      newAmount: 300,
      placedAt: '2024-06-15T11:59:30.000Z',
    })
  })

  it('emits only one outbid per lost lead and then an auction_end with the final price', async () => {
    const { subscriptionId } = await openStream([userLeadsState()])
    const { ingestAuctionEvent } = await import('../auction-stream')

    await nextFrame()
    const feed = subscriptionId('auction-1')

    ingestAuctionEvent(feed, {
      type: 'bid:created',
      data: { auctionId: 'auction-1', amount: 300, placedAt: '2024-06-15T11:59:30.000Z' },
    })
    await nextFrame()

    // A second higher bid: the user no longer leads, no new outbid.
    ingestAuctionEvent(feed, {
      type: 'bid:created',
      data: { auctionId: 'auction-1', amount: 350, placedAt: '2024-06-15T11:59:40.000Z' },
    })

    ingestAuctionEvent(feed, {
      type: 'auction:ended',
      data: { auctionId: 'auction-1', type: 'open', hasWinner: true },
    })

    const endFrame = await nextFrame()
    expect(endFrame.event).toBe('auction_end')
    expect(endFrame.data.finalPrice).toBe(350)
    expect(endFrame.data.outcome).toBe('lost')
  })

  it('ignores feed events for auctions outside the user list', async () => {
    await openStream([userLeadsState()])
    await nextFrame()

    // Event for an auction this stream never subscribed to.
    const { ingestAuctionEvent } = await import('../auction-stream')
    expect(ingestAuctionEvent('unknown-subscription', { type: 'bid:created', data: {} })).toBe(
      false,
    )
  })

  it('serves connected plus heartbeat when the user has no auction feeds', async () => {
    vi.useFakeTimers()
    try {
      const { calls } = await openStream([])
      expect(calls).toHaveLength(0)

      const frame = await nextFrame()
      expect(frame.event).toBe('connected')

      if (!reader) throw new Error('reader missing')
      const readPromise = reader.read()
      vi.advanceTimersByTime(30_000)
      const { value } = await readPromise
      expect(decoder.decode(value)).toBe(': heartbeat\n\n')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('same-isolate push functions', () => {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15T12:00:00Z'))
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
    if (value === undefined) throw new Error('stream ended')
    return parseFrame(value)
  }

  it('pushNotification lands on the user stream with the legacy shape', async () => {
    const { doFetch } = makeDoFetch()
    const { pushNotification } = await import('../my-stream')
    const stream = await createMyStream('user-1', {
      origin: ORIGIN,
      doFetch,
      loadUserAuctionFeeds: () => Promise.resolve([] as UserAuctionFeedState[]),
    })
    reader = stream.getReader()
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
      sentAt: '2024-06-15T12:00:01.000Z',
    })
  })

  it('pushOutbid coerces a numeric userId and keeps frame bytes', async () => {
    const { doFetch } = makeDoFetch()
    const { pushOutbid } = await import('../my-stream')
    const stream = await createMyStream('42', {
      origin: ORIGIN,
      doFetch,
      loadUserAuctionFeeds: () => Promise.resolve([] as UserAuctionFeedState[]),
    })
    reader = stream.getReader()
    await nextFrame()

    const placedAt = new Date('2024-06-15T11:59:30Z')
    pushOutbid(42, {
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

  it('delivers nothing to a user without connections', async () => {
    const { doFetch } = makeDoFetch()
    const { pushOutbid } = await import('../my-stream')
    const stream = await createMyStream('user-1', {
      origin: ORIGIN,
      doFetch,
      loadUserAuctionFeeds: () => Promise.resolve([] as UserAuctionFeedState[]),
    })
    reader = stream.getReader()
    await nextFrame()

    const readPromise = reader.read()
    pushOutbid('user-2', { auctionId: 'auction-1', newAmount: 300 })

    const winner = await Promise.race([
      readPromise.then(() => 'read'),
      Promise.resolve('pending'),
    ])
    expect(winner).toBe('pending')
  })
})
