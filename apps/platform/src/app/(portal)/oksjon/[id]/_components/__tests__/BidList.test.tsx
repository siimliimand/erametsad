// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Captures the auction stream subscriptions so tests can emit SSE payloads
// directly instead of going through EventSource.
const stream = vi.hoisted(() => {
  const handlers = new Map<string, Set<(payload: unknown) => void>>()
  return {
    handlers,
    emit(event: string, payload: unknown): void {
      for (const handler of [...(handlers.get(event) ?? [])]) handler(payload)
    },
    reset(): void {
      handlers.clear()
    },
  }
})

vi.mock('@/app/(portal)/_lib/use-auction-stream', () => ({
  useAuctionStream: () => ({
    status: 'live' as const,
    subscribe: (event: string, handler: (payload: unknown) => void) => {
      const set = stream.handlers.get(event) ?? new Set<(payload: unknown) => void>()
      set.add(handler)
      stream.handlers.set(event, set)
      return () => {
        set.delete(handler)
      }
    },
    onReconnect: () => () => undefined,
  }),
}))

import { BidList, type BidListProps } from '../BidList'

import type { AuctionBidView, BidListRow } from '@/lib/auction/queries'

function row(overrides: Partial<BidListRow> = {}): BidListRow {
  return {
    id: 'b1',
    amount: 1500,
    label: 'Pakkuja #1',
    createdAt: new Date().toISOString(),
    source: 'manual',
    isOwn: false,
    ...overrides,
  }
}

function authedView(overrides: Partial<Extract<AuctionBidView, { kind: 'authed' }>> = {}): AuctionBidView {
  return {
    kind: 'authed',
    bidCount: 1,
    latestBidAt: new Date().toISOString(),
    leadingBidAmount: 1500,
    bids: [row()],
    ...overrides,
  }
}

function guestView(bidCount: number, latestBidAt: string | null): AuctionBidView {
  return { kind: 'guest', bidCount, latestBidAt }
}

// Mirrors the component's eur() so expectations match the et-EE rendering
// regardless of ICU data on the machine.
function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '').replace(/[\u00a0\u202f]/g, ' ')
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

function apiResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve()
  }
}

let container: HTMLDivElement
let root: Root

async function mount(initialView: AuctionBidView): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(BidList, { auctionId: 'a1', initialView } satisfies BidListProps))
    await Promise.resolve()
  })
}

async function emitBidCreated(payload: {
  auctionId: string
  placedAt: string
}): Promise<void> {
  await act(async () => {
    stream.emit('bid:created', payload)
    await flush()
  })
}

function text(): string {
  return plain(container.textContent)
}

function rowNodes(): HTMLElement[] {
  return [...container.querySelectorAll('ol > li')] as HTMLElement[]
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  stream.reset()
  vi.unstubAllGlobals()
})

describe('BidList guest variant', () => {
  it('renders count and latest time without amounts', async () => {
    await mount(guestView(4, new Date(Date.now() - 5 * 60_000).toISOString()))
    expect(text()).toContain('Pakkumisi: 4')
    expect(text()).toContain('Viimane pakkumise aeg: 5 minutit tagasi')
    expect(text()).toContain('Summad ja pakkujate arv on nähtavad sisseloginud kasutajatele.')
    expect(text()).not.toContain('€')
    expect(rowNodes()).toHaveLength(0)
  })

  it('shows an em dash when no bid time is known', async () => {
    await mount(guestView(0, null))
    expect(text()).toContain('Pakkumisi: 0')
    expect(text()).toContain('Viimane pakkumise aeg: —')
  })

  it('bumps the optimistic count on bid:created without fetching', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mount(guestView(4, new Date().toISOString()))

    await emitBidCreated({ auctionId: 'a1', placedAt: new Date().toISOString() })

    expect(text()).toContain('Pakkumisi: 5')
    expect(text()).toContain('Viimane pakkumise aeg: just nüüd')
    expect(text()).not.toContain('€')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('ignores bid:created frames for another auction', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mount(guestView(4, null))

    await emitBidCreated({ auctionId: 'other', placedAt: new Date().toISOString() })

    expect(text()).toContain('Pakkumisi: 4')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('BidList authed variant', () => {
  it('renders descending rows with Pakkuja labels, autobid chip, and own-bid highlight', async () => {
    await mount(
      authedView({
        bidCount: 3,
        leadingBidAmount: 1500,
        bids: [
          row({ id: 'b2', amount: 1500, label: 'Pakkuja #3', isOwn: true }),
          row({ id: 'b1', amount: 1200, label: 'Pakkuja #2', source: 'autobidder' }),
          row({
            id: 'b3',
            amount: 900,
            label: 'Pakkuja #1',
            createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          }),
        ],
      }),
    )

    const nodes = rowNodes()
    expect(nodes).toHaveLength(3)
    // Descending by amount regardless of server order.
    expect(nodes[0]?.textContent).toContain('#1')
    expect(plain(nodes[0]?.textContent ?? '')).toContain(plain(eur(1500)))
    expect(nodes[0]?.textContent).toContain('Pakkuja #3')
    expect(nodes[0]?.textContent).toContain('Sinu pakkumine')
    expect(nodes[0]?.className).toContain('bg-primaryLight')

    expect(nodes[1]?.textContent).toContain('#2')
    expect(plain(nodes[1]?.textContent ?? '')).toContain(plain(eur(1200)))
    expect(nodes[1]?.textContent).toContain('Automaatpakkuja')
    expect(nodes[1]?.textContent).not.toContain('Sinu pakkumine')

    expect(nodes[2]?.textContent).toContain('#3')
    expect(plain(nodes[2]?.textContent ?? '')).toContain(plain(eur(900)))
    expect(plain(nodes[2]?.textContent ?? '')).toContain('5 minutit tagasi')
  })

  it('shows the empty state before any bids exist', async () => {
    await mount(authedView({ bidCount: 0, leadingBidAmount: null, bids: [] }))
    expect(text()).toContain('Pakkumisi veel pole.')
    expect(rowNodes()).toHaveLength(0)
  })

  it('keeps the banner hidden while the viewer leads', async () => {
    await mount(
      authedView({
        leadingBidAmount: 1500,
        bids: [row({ amount: 1500, label: 'Pakkuja #2', isOwn: true })],
      }),
    )
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(text()).not.toContain('Sinu pakkumine pakuti üle')
  })
})

describe('BidList outbid derivation', () => {
  it('shows the banner after a refetched view overtakes the viewer and clears it when they lead again', async () => {
    const responses: AuctionBidView[] = [
      authedView({
        bidCount: 3,
        leadingBidAmount: 2000,
        bids: [
          row({ id: 'b9', amount: 2000, label: 'Pakkuja #4', isOwn: false }),
          row({ id: 'b2', amount: 1500, label: 'Pakkuja #3', isOwn: true }),
        ],
      }),
      authedView({
        bidCount: 4,
        leadingBidAmount: 2500,
        bids: [
          row({ id: 'b10', amount: 2500, label: 'Pakkuja #5', isOwn: true }),
          row({ id: 'b9', amount: 2000, label: 'Pakkuja #4', isOwn: false }),
        ],
      }),
    ]
    const fetchMock = vi.fn(() => {
      const body = responses.shift()
      if (body === undefined) return Promise.reject(new Error('unexpected fetch'))
      return Promise.resolve(apiResponse(200, body))
    })
    vi.stubGlobal('fetch', fetchMock)

    // The viewer leads at mount: no banner yet.
    await mount(
      authedView({
        bidCount: 2,
        leadingBidAmount: 1500,
        bids: [row({ id: 'b2', amount: 1500, label: 'Pakkuja #3', isOwn: true })],
      }),
    )
    expect(container.querySelector('[role="status"]')).toBeNull()

    await emitBidCreated({ auctionId: 'a1', placedAt: new Date().toISOString() })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auctions/a1/bids', {
      cache: 'no-store',
    })
    expect(container.querySelector('[role="status"]')).not.toBeNull()
    expect(text()).toContain('Sinu pakkumine pakuti üle')

    await emitBidCreated({ auctionId: 'a1', placedAt: new Date().toISOString() })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(text()).not.toContain('Sinu pakkumine pakuti üle')
    expect(text()).toContain('Sinu pakkumine')
  })

  it('reconciles new bids through the refetch, not the event payload', async () => {
    let resolveFetch: ((response: Response) => void) | null = null
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await mount(authedView({ bidCount: 0, leadingBidAmount: null, bids: [] }))
    expect(text()).toContain('Pakkumisi veel pole.')

    await act(async () => {
      stream.emit('bid:created', { auctionId: 'a1', placedAt: new Date().toISOString() })
      await flush()
    })

    // The refetch fired...
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/auctions/a1/bids', {
      cache: 'no-store',
    })
    // ...but no row was fabricated from the frame: the list stays empty and
    // no amount can appear while the authoritative fetch is in flight.
    expect(text()).toContain('Pakkumisi veel pole.')
    expect(rowNodes()).toHaveLength(0)
    expect(text()).not.toContain('€')

    await act(async () => {
      const resolve = resolveFetch
      resolve?.(
        apiResponse(
          200,
          authedView({
            bidCount: 1,
            leadingBidAmount: 1250,
            bids: [row({ id: 'b7', amount: 1250, label: 'Pakkuja #1' })],
          }),
        ),
      )
      await flush()
    })

    expect(text()).not.toContain('Pakkumisi veel pole.')
    const nodes = rowNodes()
    expect(nodes).toHaveLength(1)
    expect(plain(nodes[0]?.textContent ?? '')).toContain(plain(eur(1250)))
  })
})
