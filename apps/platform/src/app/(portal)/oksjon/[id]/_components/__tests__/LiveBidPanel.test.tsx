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

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
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

import { LiveBidPanel, type LiveBidPanelProps } from '../LiveBidPanel'

function baseProps(overrides: Partial<LiveBidPanelProps> = {}): LiveBidPanelProps {
  return {
    auctionId: 'a1',
    objectType: 'raieoigus',
    status: 'active',
    startsAt: null,
    endsAt: '2026-09-30T12:00:00.000Z',
    minBid: 1000,
    bidStep: 50,
    leadingBidAmount: null,
    finalPrice: null,
    antiSnipeMinutes: null,
    viewer: {
      hasBid: false,
      isLeading: false,
      hasRights: true,
      hasRaamleping: true,
    },
    ...overrides,
  }
}

// Mirrors BidPanel's fmtDateTime so expectations match the et-EE rendering
// regardless of ICU data on the machine.
function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString('et-EE', { dateStyle: 'long', timeStyle: 'short' })
}

function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '').replace(/[\u00a0\u202f]/g, ' ')
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

let container: HTMLDivElement
let root: Root

async function mount(props: LiveBidPanelProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(LiveBidPanel, props))
    await Promise.resolve()
  })
}

async function rerender(props: LiveBidPanelProps): Promise<void> {
  await act(async () => {
    root.render(createElement(LiveBidPanel, props))
    await Promise.resolve()
  })
}

function emit(event: 'auction:extended' | 'auction:ended', payload: object): Promise<void> {
  return act(async () => {
    stream.emit(event, payload)
    await Promise.resolve()
  })
}

function text(): string {
  return container.textContent
}

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
  stream.reset()
  nav.refresh.mockReset()
  nav.push.mockReset()
})

describe('LiveBidPanel', () => {
  it('renders the active bid form with the server deadline', async () => {
    await mount(baseProps())
    expect(text()).toContain('Esita pakkumine')
    expect(text()).toContain(`Oksjon lõpeb: ${plain(fmtDateTime('2026-09-30T12:00:00.000Z'))}`)
  })

  it('moves the panel deadline in place on auction:extended without a refresh', async () => {
    await mount(baseProps())

    await emit('auction:extended', {
      auctionId: 'a1',
      previousEndsAt: '2026-09-30T12:00:00.000Z',
      endsAt: '2026-10-05T09:30:00.000Z',
    })

    expect(text()).toContain(`Oksjon lõpeb: ${plain(fmtDateTime('2026-10-05T09:30:00.000Z'))}`)
    expect(text()).not.toContain(plain(fmtDateTime('2026-09-30T12:00:00.000Z')))
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('locks the panel into the ended rendering on auction:ended', async () => {
    await mount(baseProps({ finalPrice: 1500 }))

    await emit('auction:ended', { auctionId: 'a1', type: 'open', hasWinner: true })

    expect(text()).toContain('Oksjon on lõppenud')
    expect(plain(text())).toContain(`Lõpphind: ${plain(eur(1500))}`)
    expect(container.querySelector('form')).toBeNull()
    expect(container.querySelector('input')).toBeNull()
    expect(text()).not.toContain('Esita pakkumine')
    expect(text()).not.toContain('Automaatpakkuja')
    // Screen-reader announcement for the live end event.
    expect(text()).toContain('Oksjon lõppes.')
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('ignores auction:ended for another auction', async () => {
    await mount(baseProps())

    await emit('auction:ended', { auctionId: 'other', type: 'open' })

    expect(container.querySelector('form')).not.toBeNull()
    expect(text()).not.toContain('Oksjon on lõppenud')
    expect(text()).not.toContain('Oksjon lõppes.')
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('keeps the server-rendered ended state authoritative on re-render', async () => {
    await mount(baseProps())
    await emit('auction:ended', { auctionId: 'a1', type: 'open' })
    expect(text()).toContain('Oksjon on lõppenud')

    // The refresh swaps in the server render; status 'ended' must stay ended.
    await rerender(baseProps({ status: 'ended', finalPrice: 1600 }))
    expect(text()).toContain('Oksjon on lõppenud')
    expect(plain(text())).toContain(`Lõpphind: ${plain(eur(1600))}`)
    expect(container.querySelector('form')).toBeNull()
  })
})
