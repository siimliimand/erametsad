// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}))

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

vi.mock('next/navigation', () => ({
  useRouter: () => nav,
}))

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

import { LiveListing, type LiveListingProps, type LiveLotState } from '../LiveListing'
import type { AuctionListResult, AuctionSummary } from '@/lib/auction/queries'

function lot(overrides: Partial<AuctionSummary> = {}): AuctionSummary {
  return {
    id: 'lot-1',
    slug: 'metsamaa-vorumaal',
    title: 'Metsamaa Võrumaal',
    objectType: 'raieoigus',
    type: 'open',
    isQuickAuction: false,
    status: 'active',
    endYear: null,
    county: { id: 'c1', name: 'Võru', code: 'VOR' },
    parish: null,
    address: null,
    minBid: 5000,
    finalPrice: null,
    area: 12.4,
    volume: null,
    species: [],
    startsAt: null,
    endsAt: '2026-09-30T12:00:00.000Z',
    coordinates: null,
    image: null,
    registryNumber: null,
    ...overrides,
  }
}

function listResult(auctions: AuctionSummary[]): AuctionListResult {
  return { auctions, total: auctions.length, page: 1, limit: 20, totalPages: 1 }
}

// Custom card renderer: asserts the lot data LiveListing feeds forward
// instead of LotCard internals.
function renderLot(lot: AuctionSummary, state: LiveLotState): ReactNode {
  return createElement(
    'div',
    { 'data-lot': lot.id },
    `${lot.title} | ${lot.status} | ${lot.endsAt ?? '-'}${state.highlighted ? ' | HL' : ''}`,
  )
}

function apiResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

async function flush(): Promise<void> {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve()
  }
}

let container: HTMLDivElement
let root: Root

async function mount(props: Omit<LiveListingProps, 'renderLot'>): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(LiveListing, { ...props, renderLot }))
    await Promise.resolve()
  })
}

async function rerender(props: Omit<LiveListingProps, 'renderLot'>): Promise<void> {
  await act(async () => {
    root.render(createElement(LiveListing, { ...props, renderLot }))
    await Promise.resolve()
  })
}

async function emit(
  event: 'auction:published' | 'auction:extended' | 'auction:ended',
  payload: object,
): Promise<void> {
  await act(async () => {
    stream.emit(event, payload)
    await flush()
  })
}

function lotNode(id: string): HTMLElement | null {
  return container.querySelector<HTMLElement>(`[data-lot="${id}"]`)
}

function text(): string {
  return container.textContent ?? ''
}

function cardIds(): string[] {
  return [...container.querySelectorAll('[data-lot]')].map((node) =>
    node.getAttribute('data-lot'),
  ) as string[]
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  stream.reset()
  nav.refresh.mockReset()
  nav.push.mockReset()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('LiveListing initial render', () => {
  it('renders the server lots through the lot renderer', async () => {
    await mount({ lots: [lot(), lot({ id: 'lot-2', title: 'Pakett Hiiumaal' })] })
    expect(cardIds()).toEqual(['lot-1', 'lot-2'])
    expect(lotNode('lot-1')?.textContent).toContain('Metsamaa Võrumaal | active')
    expect(lotNode('lot-1')?.textContent).not.toContain('| HL')
  })
})

describe('LiveListing auction:published', () => {
  it('prepends the fetched lot with a highlight that fades after 6 seconds', async () => {
    const fetchMock = vi.fn(async () =>
      apiResponse(
        200,
        listResult([
          lot({
            id: 'new-1',
            title: 'Uus raieõigus',
            endsAt: '2026-10-10T10:00:00.000Z',
          }),
        ]),
      ),
    )
    vi.stubGlobal('fetch', fetchMock)
    await mount({ lots: [lot(), lot({ id: 'lot-2', title: 'Pakett Hiiumaal' })], query: 'tab=koik' })

    vi.useFakeTimers()
    await emit('auction:published', { auctionId: 'new-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auctions?tab=koik&auctionStatus=active',
      { cache: 'no-store' },
    )
    expect(cardIds()).toEqual(['new-1', 'lot-1', 'lot-2'])
    expect(lotNode('new-1')?.textContent).toContain('Uus raieõigus | active')
    expect(lotNode('new-1')?.textContent).toContain('| HL')
    expect(text()).toContain('Uus oksjon lisandus.')
    expect(nav.refresh).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(6_000)
    })
    expect(lotNode('new-1')?.textContent).not.toContain('| HL')
    expect(cardIds()).toEqual(['new-1', 'lot-1', 'lot-2'])
  })

  it('falls back to router.refresh when the lot is not in the fetched page', async () => {
    const fetchMock = vi.fn(async () => apiResponse(200, listResult([])))
    vi.stubGlobal('fetch', fetchMock)
    await mount({ lots: [lot()], query: 'tab=koik' })

    await emit('auction:published', { auctionId: 'elsewhere' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(cardIds()).toEqual(['lot-1'])
    expect(text()).not.toContain('Uus oksjon lisandus.')
  })

  it('ignores publishes for a lot that is already listed', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await mount({ lots: [lot()], query: 'tab=koik' })

    await emit('auction:published', { auctionId: 'lot-1' })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(nav.refresh).not.toHaveBeenCalled()
    expect(cardIds()).toEqual(['lot-1'])
  })
})

describe('LiveListing auction:extended', () => {
  it('updates endsAt in place without a refresh', async () => {
    await mount({ lots: [lot(), lot({ id: 'lot-2', title: 'Pakett Hiiumaal' })] })

    await emit('auction:extended', {
      auctionId: 'lot-1',
      previousEndsAt: '2026-09-30T12:00:00.000Z',
      endsAt: '2026-10-05T09:30:00.000Z',
    })

    expect(lotNode('lot-1')?.textContent).toContain('2026-10-05T09:30:00.000Z')
    expect(lotNode('lot-1')?.textContent).not.toContain('2026-09-30T12:00:00.000Z')
    expect(lotNode('lot-2')?.textContent).toContain('2026-09-30T12:00:00.000Z')
    expect(nav.refresh).not.toHaveBeenCalled()
  })
})

describe('LiveListing auction:ended', () => {
  it('flips the ended lot status in place and announces the end', async () => {
    await mount({ lots: [lot(), lot({ id: 'lot-2', title: 'Pakett Hiiumaal' })] })

    await emit('auction:ended', { auctionId: 'lot-1', type: 'open' })

    expect(lotNode('lot-1')?.textContent).toContain('Metsamaa Võrumaal | ended')
    expect(lotNode('lot-2')?.textContent).toContain('Pakett Hiiumaal | active')
    expect(text()).toContain('Oksjon lõppes.')
    expect(nav.refresh).not.toHaveBeenCalled()
  })
})

describe('LiveListing server re-render', () => {
  it('re-adopts the lots prop over the locally mutated view', async () => {
    await mount({ lots: [lot()] })
    await emit('auction:ended', { auctionId: 'lot-1', type: 'open' })
    expect(lotNode('lot-1')?.textContent).toContain('| ended')

    await rerender({ lots: [lot({ endsAt: '2026-11-01T00:00:00.000Z' })] })
    expect(lotNode('lot-1')?.textContent).toContain('Metsamaa Võrumaal | active')
    expect(lotNode('lot-1')?.textContent).toContain('2026-11-01T00:00:00.000Z')
  })
})
