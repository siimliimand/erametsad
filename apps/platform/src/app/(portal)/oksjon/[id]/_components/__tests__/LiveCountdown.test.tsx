// @vitest-environment jsdom
import { act, createElement, type ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}))

// Captures the auction stream subscriptions so tests can emit SSE payloads
// directly instead of going through EventSource.
const stream = vi.hoisted(() => {
  const handlers: Map<string, Set<(payload: unknown) => void>> = new Map()
  return {
    handlers,
    emit(event: string, payload: unknown): void {
      for (const handler of [...(handlers.get(event) ?? [])]) handler(payload)
    },
    count(event: string): number {
      return handlers.get(event)?.size ?? 0
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

import { LiveCountdown } from '../LiveCountdown'

// Countdown ticks every second; fake timers pin Date.now and make the
// rendered remaining time deterministic.
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-08-27T12:00:00Z'))
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  vi.useRealTimers()
  stream.reset()
  nav.refresh.mockReset()
  nav.push.mockReset()
})

let container: HTMLDivElement
let root: Root

async function mount(props: {
  auctionId?: string
  endsAt: string
  serverNow?: number
}): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(LiveCountdown, {
        auctionId: props.auctionId ?? 'a1',
        endsAt: props.endsAt,
        ...(props.serverNow !== undefined ? { serverNow: props.serverNow } : {}),
      }),
    )
  })
}

async function rerender(props: { endsAt: string }): Promise<void> {
  await act(async () => {
    root.render(
      createElement(LiveCountdown, { auctionId: 'a1', endsAt: props.endsAt }),
    )
  })
}

function text(): string {
  return container.textContent ?? ''
}

describe('LiveCountdown', () => {
  it('renders the server-supplied deadline on mount', async () => {
    await mount({ endsAt: '2026-08-30T12:00:00.000Z' })
    expect(text()).toContain('Aega jäänud')
    expect(text()).toContain('3p 0h 0m 0s')
  })

  it('moves the rendered deadline on auction:extended without a refresh', async () => {
    await mount({ endsAt: '2026-08-30T12:00:00.000Z' })

    await act(async () => {
      stream.emit('auction:extended', {
        auctionId: 'a1',
        previousEndsAt: '2026-08-30T12:00:00.000Z',
        endsAt: '2026-08-31T12:00:00.000Z',
      })
    })

    expect(text()).toContain('4p 0h 0m 0s')
    expect(text()).not.toContain('3p 0h 0m 0s')
    // Moving the deadline is in-place; no router.refresh is involved.
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('ignores auction:extended for another auction', async () => {
    await mount({ endsAt: '2026-08-30T12:00:00.000Z' })

    await act(async () => {
      stream.emit('auction:extended', {
        auctionId: 'other',
        previousEndsAt: '2026-08-30T12:00:00.000Z',
        endsAt: '2026-08-31T12:00:00.000Z',
      })
    })

    expect(text()).toContain('3p 0h 0m 0s')
  })

  it('adopts the server endsAt again when the prop changes after a local move', async () => {
    await mount({ endsAt: '2026-08-30T12:00:00.000Z' })
    await act(async () => {
      stream.emit('auction:extended', {
        auctionId: 'a1',
        previousEndsAt: '2026-08-30T12:00:00.000Z',
        endsAt: '2026-08-31T12:00:00.000Z',
      })
    })
    expect(text()).toContain('4p 0h 0m 0s')

    await rerender({ endsAt: '2026-09-01T12:00:00.000Z' })
    expect(text()).toContain('5p 0h 0m 0s')
  })

  it('refreshes bid state through router.refresh at the zero crossing', async () => {
    await mount({ endsAt: '2026-08-27T12:00:05.000Z' })
    expect(nav.refresh).not.toHaveBeenCalled()

    await act(async () => {
      vi.advanceTimersByTime(5500)
    })

    expect(nav.refresh).toHaveBeenCalledTimes(1)
    expect(text()).toContain('Lõppenud')
  })

  it('subscribes only to auction:extended', async () => {
    await mount({ endsAt: '2026-08-30T12:00:00.000Z' })
    expect(stream.count('auction:extended')).toBe(1)
    expect(stream.count('auction:ended')).toBe(0)
  })
})
