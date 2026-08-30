// @vitest-environment jsdom
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => nav,
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; className?: string; children: ReactNode }) =>
    createElement('a', { href: props.href, className: props.className }, props.children),
}))

import { AutobidderControl } from '../AutobidderControl'
import { BidPanel, type BidPanelProps } from '../BidPanel'

// React SSR separates adjacent text nodes with <!-- --> comments and ICU
// emits narrow/no-break spaces; strip both so assertions read like the text.
function plain(value: string): string {
  return value.replace(/<!--.*?-->/g, '').replace(/[\u00a0\u202f]/g, ' ')
}

function inputAmount(value: number): string {
  return value.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

function renderControl(props: {
  existing?: { id: string; maxAmount: number } | null
  hasAutobidder?: boolean
  minBid?: number
  bidStep?: number | null
  currentLeading?: number | null
}): string {
  return renderToString(
    createElement(AutobidderControl, {
      auctionId: 'a1',
      minBid: props.minBid ?? 1000,
      bidStep: props.bidStep ?? 50,
      currentLeading: props.currentLeading ?? null,
      existing: props.existing ?? null,
      hasAutobidder: props.hasAutobidder ?? false,
    }),
  )
}

function renderPanel(props: Partial<BidPanelProps>): string {
  return renderToString(
    createElement(BidPanel, {
      auctionId: 'a1',
      objectType: 'raieoigus',
      status: 'active',
      startsAt: null,
      endsAt: '2026-09-30T12:00:00.000Z',
      minBid: 1000,
      bidStep: 50,
      leadingBidAmount: 4000,
      finalPrice: null,
      antiSnipeMinutes: null,
      viewer: {
        hasBid: false,
        isLeading: false,
        hasRights: true,
        hasRaamleping: true,
        ...props.viewer,
      },
      ...props,
    }),
  )
}

describe('AutobidderControl prefill', () => {
  it('prefills the input and texts from the caller\'s own row', () => {
    const html = plain(
      renderControl({ existing: { id: 'ab1', maxAmount: 5000 }, currentLeading: 4000 }),
    )
    expect(html).toContain(`value="${plain(inputAmount(5000))}"`)
    expect(html).toContain('Uuenda')
    expect(html).toContain('Eemalda')
    expect(html).toContain(`kuni ${plain(eur(5000))} summani`)
    // Upward-only floor: max(leading+step, current max + 0.01).
    expect(html).toContain(`Vähim lubatud: ${plain(inputAmount(5000.01))} €`)
  })

  it('falls back to leading bid + step and hides delete without a row', () => {
    const html = plain(renderControl({ currentLeading: 4000 }))
    expect(html).toContain(`value="${plain(inputAmount(4050))}"`)
    expect(html).toContain('Määra')
    expect(html).not.toContain('Eemalda')
    expect(html).not.toContain('Uuenda')
  })

  it('falls back to the start price when nobody leads yet', () => {
    const html = plain(renderControl({ currentLeading: null }))
    expect(html).toContain(`value="${plain(inputAmount(1000))}"`)
    expect(html).toContain('Määra')
  })

  it('shows the update label for a reported autobidder without its row but still hides delete', () => {
    const html = plain(renderControl({ hasAutobidder: true, currentLeading: 4000 }))
    expect(html).toContain('Uuenda')
    expect(html).not.toContain('Eemalda')
  })
})

describe('BidPanel autobidder wiring', () => {
  it('prefills the control from viewer.autobidderId and autobidderMaxAmount', () => {
    const html = plain(
      renderPanel({
        viewer: {
          hasBid: false,
          isLeading: false,
          hasRights: true,
          hasRaamleping: true,
          autobidderId: 'ab1',
          autobidderMaxAmount: 5000,
        },
      }),
    )
    expect(html).toContain(`value="${plain(inputAmount(5000))}"`)
    expect(html).toContain('Eemalda')
    expect(html).toContain(`kuni ${plain(eur(5000))} summani`)
  })

  it('hides delete when the page cannot supply the autobidder row', () => {
    const html = plain(
      renderPanel({
        viewer: {
          hasBid: false,
          isLeading: false,
          hasRights: true,
          hasRaamleping: true,
          hasAutobidder: true,
        },
      }),
    )
    expect(html).toContain('Automaatpakkuja')
    expect(html).not.toContain('Eemalda')
  })
})

// ── Click flows ─────────────────────────────────────────────────────────

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement | null = null
let root: Root | null = null

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
})

afterEach(() => {
  // SSR-only tests never mount a root; unmount only what exists.
  if (root !== null) {
    act(() => {
      root?.unmount()
    })
    root = null
  }
  container?.remove()
  container = null
  vi.unstubAllGlobals()
  nav.refresh.mockReset()
  nav.push.mockReset()
})

function node(): HTMLElement {
  if (container === null) throw new Error('container missing')
  return container
}

async function mount(element: ReactElement): Promise<void> {
  const el = node()
  await act(async () => {
    root = createRoot(el)
    root.render(element)
    await Promise.resolve()
  })
}

function findButton(label: string): HTMLButtonElement {
  const button = Array.from(node().querySelectorAll('button')).find(
    (item) => item.textContent === label,
  )
  if (button === undefined) throw new Error(`button not found: ${label}`)
  return button
}

function setInputValue(input: HTMLInputElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
  if (descriptor?.set === undefined) throw new Error('value setter unavailable')
  descriptor.set.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function mountControl(existing: { id: string; maxAmount: number } | null): Promise<void> {
  return mount(
    createElement(AutobidderControl, {
      auctionId: 'a1',
      minBid: 1000,
      bidStep: 50,
      currentLeading: 4000,
      existing,
      hasAutobidder: existing !== null,
    }),
  )
}

describe('AutobidderControl flows', () => {
  it('PATCHes the existing row when saving a new maximum', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () =>
          Promise.resolve(
            new Response(JSON.stringify({ id: 'ab1' }), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            }),
          ),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mountControl({ id: 'ab1', maxAmount: 5000 })

    const input = node().querySelector<HTMLInputElement>('#autobidder-max')
    if (input === null) throw new Error('input not found')
    act(() => {
      setInputValue(input, '5200')
    })
    await act(async () => {
      findButton('Uuenda').click()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    if (call === undefined) throw new Error('fetch was not called')
    const [url, init] = call
    if (init === undefined) throw new Error('fetch init missing')
    expect(url).toBe('/api/v1/auto-bidders/ab1')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body as string)).toEqual({ maxAmount: 5200 })
    expect(plain(node().textContent)).toContain(
      `Automaatpakkuja maksimaalne summa on ${plain(eur(5200))}.`,
    )
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('DELETEs the row, hides delete and announces the removal', async () => {
    const fetchMock =
      vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
        () => Promise.resolve(new Response(null, { status: 204 })),
      )
    vi.stubGlobal('fetch', fetchMock)
    await mountControl({ id: 'ab1', maxAmount: 5000 })

    await act(async () => {
      findButton('Eemalda').click()
      await Promise.resolve()
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const call = fetchMock.mock.calls[0]
    if (call === undefined) throw new Error('fetch was not called')
    const [url, init] = call
    if (init === undefined) throw new Error('fetch init missing')
    expect(url).toBe('/api/v1/auto-bidders/ab1')
    expect(init.method).toBe('DELETE')
    expect(plain(node().textContent)).toContain(
      'Automaatpakkuja on eemaldatud. Viimane tehtud pakkumine jääb jõusse.',
    )
    expect(
      Array.from(node().querySelectorAll('button')).some(
        (b) => b.textContent === 'Eemalda',
      ),
    ).toBe(false)
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })
})
