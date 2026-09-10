// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BidsView, type BidsViewProps } from '../bids-view'
import {
  matchesFilters,
  rowCategories,
  type BidFilterId,
  type MyBidRow,
} from '../types'

import type { BidStatus } from '@/lib/data/schema'

const state = vi.hoisted(() => ({
  handlers: new Map<string, (payload: unknown) => void>(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: state.replace, refresh: state.refresh }),
}))

vi.mock('next/link', () => ({
  default: (props: { href: string; children?: ReactNode }) =>
    createElement('a', { href: props.href }, props.children),
}))

vi.mock('@/app/(portal)/_lib/use-my-stream', () => ({
  useMyStream: () => ({
    status: 'live',
    subscribe: (event: string, handler: (payload: unknown) => void) => {
      state.handlers.set(event, handler)
      return () => {
        state.handlers.delete(event)
      }
    },
    onReconnect: () => () => undefined,
  }),
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function makeRow(overrides: {
  id: string
  auctionStatus?: MyBidRow['auction']['auctionStatus']
  auctionType?: 'open' | 'sealed'
  myBidStatus?: BidStatus
  outcome?: MyBidRow['outcome']
  contractPending?: boolean
}): MyBidRow {
  const active = ['scheduled', 'active'].includes(
    overrides.auctionStatus ?? 'active',
  )
  const row: MyBidRow = {
    auction: {
      id: overrides.id,
      title: `Oksjon ${overrides.id}`,
      objectType: 'raieoigus',
      auctionStatus: overrides.auctionStatus ?? 'active',
      auctionType: overrides.auctionType ?? 'open',
      endsAt: active ? '2099-01-01T00:00:00Z' : null,
      minBidEur: 1000,
      bidStepEur: 50,
      areaHa: 7.9,
      county: { id: 'c1', name: 'Tartu maakond', code: 'T' },
    },
    myBid: {
      amountEur: 7750,
      status: overrides.myBidStatus ?? 'leading',
      createdAt: '2026-01-01T00:00:00Z',
    },
    leadingAmountEur:
      overrides.auctionType === 'sealed' ? null : 7750,
  }
  if (!active) row.finalPriceEur = 8250
  if (overrides.outcome !== undefined) row.outcome = overrides.outcome
  if (overrides.contractPending) row.contractPending = true
  return row
}

const OPEN_LEADING = makeRow({ id: 'open-leading' })
const SEALED_ACTIVE = makeRow({
  id: 'sealed-active',
  auctionType: 'sealed',
})
const WON_PENDING = makeRow({
  id: 'won-pending',
  auctionStatus: 'ended',
  outcome: 'won',
  contractPending: true,
})
const LOST = makeRow({
  id: 'lost',
  auctionStatus: 'ended',
  outcome: 'lost',
})

let container: HTMLDivElement
let root: Root

async function mountView(
  props: Partial<BidsViewProps> & { initialActive?: MyBidRow[]; ended?: MyBidRow[] } = {},
): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(
      createElement(BidsView, {
        initialFilters: props.initialFilters ?? [],
        initialActive: props.initialActive ?? [],
        ended: props.ended ?? [],
      }),
    )
    await Promise.resolve()
  })
}

async function unmountView(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

function card(id: string): HTMLElement {
  const element = container.querySelector<HTMLElement>(
    `article[data-auction-id="${id}"]`,
  )
  if (element === null) throw new Error(`bid card ${id} not found`)
  return element
}

function text(): string {
  return container.textContent
}

afterEach(async () => {
  await unmountView()
  state.handlers.clear()
  state.replace.mockClear()
  state.refresh.mockClear()
})

describe('BidsView chrome', () => {
  it('renders the hint banner with the demo copy and the notifications link', async () => {
    await mountView({ initialActive: [OPEN_LEADING] })
    expect(text()).toContain(
      'Lülita teavitused sisse, et mitte oksjoni lõppu magama jääda.',
    )
    const link = container.querySelector<HTMLAnchorElement>(
      'a[href="/user/notifications"]',
    )
    expect(link?.textContent).toContain('Ava teavitused')
  })

  it('renders the four demo filter chips as toggle buttons', async () => {
    await mountView({ initialActive: [OPEN_LEADING] })
    const chips = [
      ...container.querySelectorAll<HTMLButtonElement>(
        '[role="group"][aria-label="Filtreeri pakkumisi"] button',
      ),
    ]
    expect(chips.map((chip) => chip.textContent)).toEqual([
      'Käimasolevad',
      'Lõppenud',
      'Võidetud',
      'Kaotatud',
    ])
    expect(chips.every((chip) => chip.getAttribute('aria-pressed') === 'false')).toBe(
      true,
    )
  })
})

describe('Bid cards', () => {
  it('renders an open leading card with the working switch and action', async () => {
    await mountView({ initialActive: [OPEN_LEADING] })
    const element = card('open-leading')
    expect(element.textContent).toContain('Juhtiv pakkumine')
    expect(element.textContent).toContain('Minu pakkumine')
    expect(element.textContent).toContain('Hetkel juhtiv')
    expect(element.textContent).toContain('Automaatpakkuja')
    expect(element.textContent).toContain('Muuda')
    const control = element.querySelector('[role="switch"]')
    expect(control).not.toBeNull()
    const viewAction = [
      ...element.querySelectorAll<HTMLAnchorElement>(
        'a[href="/oksjon/open-leading"]',
      ),
    ].find((anchor) => anchor.textContent.includes('Vaata oksjonit'))
    expect(viewAction).toBeDefined()
  })

  it('masks the sealed leading amount with the tooltip and hides the autobidder', async () => {
    await mountView({ initialActive: [SEALED_ACTIVE] })
    const element = card('sealed-active')
    expect(element.textContent).toContain('Pimepakkumine')
    expect(element.textContent).toContain('Ootel avamine')
    const masked = element.querySelector<HTMLElement>('[title]')
    expect(masked?.getAttribute('title')).toBe(
      'Suletud pakkumised avaldatakse pärast lõppemist',
    )
    expect(masked?.textContent).toBe('—')
    expect(element.querySelector('[role="switch"]')).toBeNull()
    expect(element.textContent).toContain(
      'Kõik pakkumised avatakse korraga pärast oksjoni tähtaega.',
    )
  })

  it('shows the won card with the pending-contract pill and the signing action', async () => {
    await mountView({ ended: [WON_PENDING] })
    const element = card('won-pending')
    expect(element.textContent).toContain('Võitsid')
    expect(element.textContent).toContain('Leping allkirja ootel')
    expect(element.textContent).toContain('Lõpphind')
    const sign = element.querySelector<HTMLAnchorElement>(
      'a[href="/lepingud/oksjonileping/won-pending"]',
    )
    expect(sign?.textContent).toContain('Allkirjasta leping')
  })

  it('renders the lost card dimmed with the result action', async () => {
    await mountView({ ended: [LOST] })
    const element = card('lost')
    expect(element.textContent).toContain('Ei võitnud')
    expect(element.textContent).toContain('Vaata tulemust')
    expect(element.className).toContain('opacity-70')
    expect(element.querySelector('a[href="/lepingud/oksjonileping/lost"]')).toBeNull()
  })
})

describe('Filter chips', () => {
  it('show only the matching cards when a chip arrives pressed', async () => {
    await mountView({
      initialFilters: ['won'],
      initialActive: [OPEN_LEADING],
      ended: [WON_PENDING, LOST],
    })
    expect(card('won-pending')).toBeDefined()
    expect(() => card('open-leading')).toThrow()
    expect(() => card('lost')).toThrow()
  })

  it('offer the demo empty state with Tühjenda filtrid when nothing matches', async () => {
    await mountView({
      initialFilters: ['won'],
      initialActive: [OPEN_LEADING],
    })
    expect(text()).toContain('Filtritele ei vasta ükski pakkumine')
    const clear = [
      ...container.querySelectorAll<HTMLButtonElement>('button'),
    ].find((button) => button.textContent === 'Tühjenda filtrid')
    expect(clear).toBeDefined()
    await act(async () => {
      clear?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(card('open-leading')).toBeDefined()
    expect(state.replace).toHaveBeenCalledWith('/user/bids', {
      scroll: false,
    })
  })

  it('write the pressed chips into the olek URL parameter', async () => {
    await mountView({ initialActive: [OPEN_LEADING] })
    const chip = container.querySelector<HTMLButtonElement>(
      '[role="group"][aria-label="Filtreeri pakkumisi"] button',
    )
    await act(async () => {
      chip?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })
    expect(state.replace).toHaveBeenCalledWith('/user/bids?olek=active', {
      scroll: false,
    })
  })
})

describe('SSE behaviors', () => {
  it('highlights the outbid card, flips its status and raises the toast', async () => {
    await mountView({ initialActive: [OPEN_LEADING] })
    const handler = state.handlers.get('outbid')
    expect(handler).toBeTypeOf('function')
    await act(async () => {
      handler?.({
        auctionId: 'open-leading',
        auctionTitle: 'Lepsi raieõigus',
        newAmount: 8250,
        placedAt: '2026-09-10T12:00:00Z',
      })
      await Promise.resolve()
    })
    const element = card('open-leading')
    expect(element.className).toContain('border-danger')
    expect(element.textContent).toContain('Üle pakutud')
    expect(element.textContent).not.toContain('Juhtiv pakkumine')
    expect(text()).toContain('Lepsi raieõigus')
    expect(text()).toContain(eur(8250))
    expect(text()).toContain('keegi pakkus üle sinu pakkumise')
  })

  it('keeps sealed amounts masked when an outbid event arrives', async () => {
    await mountView({ initialActive: [SEALED_ACTIVE] })
    const handler = state.handlers.get('outbid')
    await act(async () => {
      handler?.({
        auctionId: 'sealed-active',
        auctionTitle: 'Ööviiuli kinnistu',
        newAmount: 60000,
        placedAt: '2026-09-10T12:00:00Z',
      })
      await Promise.resolve()
    })
    const masked = card('sealed-active').querySelector<HTMLElement>('[title]')
    expect(masked?.textContent).toBe('—')
  })

  it('refreshes server rows on auction_end so cards move between chips', async () => {
    await mountView({ initialActive: [OPEN_LEADING] })
    const handler = state.handlers.get('auction_end')
    await act(async () => {
      handler?.({
        auctionId: 'open-leading',
        outcome: 'won',
        endedAt: '2026-09-10T12:00:00Z',
      })
      await Promise.resolve()
    })
    expect(state.refresh).toHaveBeenCalled()
  })
})

describe('chip mapping helpers', () => {
  it('categorize rows for the demo chips', () => {
    expect(rowCategories(OPEN_LEADING)).toEqual(['active'])
    expect(rowCategories(WON_PENDING)).toEqual(['ended', 'won'])
    expect(rowCategories(LOST)).toEqual(['ended', 'lost'])
    expect(rowCategories(SEALED_ACTIVE)).toEqual(['active'])
  })

  it('treat an empty chip set as show-everything and pressed chips as OR', () => {
    const empty = new Set<BidFilterId>()
    expect(matchesFilters(OPEN_LEADING, empty)).toBe(true)
    expect(matchesFilters(WON_PENDING, empty)).toBe(true)
    const both = new Set<BidFilterId>(['active', 'won'])
    expect(matchesFilters(OPEN_LEADING, both)).toBe(true)
    expect(matchesFilters(WON_PENDING, both)).toBe(true)
    expect(matchesFilters(LOST, both)).toBe(false)
  })
})
