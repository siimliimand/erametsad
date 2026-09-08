// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

const revealAction = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => nav,
}))

vi.mock('../../../../../_actions/auctions', () => ({
  endAuctionManuallyAction: vi.fn(),
  revealBidderIdentityAction: revealAction,
}))

vi.mock('../../../../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(),
}))

import { BidMonitor, type MonitorBidRow } from '../bid-monitor'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

// The monitor opens the SSE stream on mount; jsdom has no EventSource, so the
// tests run against an inert stub instead of a live connection.
class StubEventSource {
  static instances: StubEventSource[] = []

  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    StubEventSource.instances.push(this)
  }

  // The tests never emit stream frames, so a recording no-op is enough.
  readonly addEventListener = vi.fn()

  close(): void {
    this.closed = true
  }
}

type MonitorProps = Parameters<typeof BidMonitor>[0]

const baseMs = Date.now() - 60_000

function feedRow(offsetMs: number, overrides: Partial<MonitorBidRow> = {}): MonitorBidRow {
  return {
    key: `bid-${String(offsetMs)}`,
    bidId: `bid-${String(offsetMs)}`,
    amountEur: 500,
    placedAt: new Date(baseMs - offsetMs).toISOString(),
    source: 'autobidder',
    status: 'leading',
    backfilled: false,
    bidderId: 'bidder-1',
    bidderAlias: 7,
    bidderAccountCreatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function baseProps(rows: MonitorBidRow[]): MonitorProps {
  return {
    auctionId: 'auction-1',
    title: 'Harjumaa raieõigus',
    isSealed: false,
    sealedBidCount: null,
    initialRows: rows,
    initialPriceEur: 500,
    marginToSecondEur: null,
    minNextBidEur: 510,
    bidStepEur: 10,
    endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    initialEnded: false,
    serverTimeIso: new Date().toISOString(),
    antiSnipeMinutes: 5,
    initialExtensions: [],
    canEndManually: false,
    canFlagAnomalies: false,
  }
}

function plain(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ')
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

let container: HTMLDivElement
let root: Root

async function mountMonitor(rows: MonitorBidRow[]): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(BidMonitor, baseProps(rows)))
    await Promise.resolve()
  })
}

async function unmountMonitor(): Promise<void> {
  await act(async () => {
    root.unmount()
    await Promise.resolve()
  })
  container.remove()
}

function text(): string {
  return plain(container.textContent)
}

function buttonByText(label: string): HTMLButtonElement {
  const button = [...container.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) => candidate.textContent.includes(label),
  )
  if (button === undefined) throw new Error(`button ${label} not found`)
  return button
}

async function clickButton(button: HTMLButtonElement): Promise<void> {
  await act(async () => {
    button.click()
    await sleep(5)
  })
}

beforeEach(() => {
  vi.stubGlobal('EventSource', StubEventSource)
  StubEventSource.instances = []
})

afterEach(async () => {
  await unmountMonitor()
  vi.unstubAllGlobals()
  nav.refresh.mockReset()
  revealAction.mockReset()
})

describe('BidMonitor autobidder duel collapse', () => {
  it('collapses a rapid autobid run behind one expandable duel row', async () => {
    await mountMonitor([
      feedRow(0),
      feedRow(10_000, { amountEur: 505 }),
      feedRow(20_000, { amountEur: 510 }),
      feedRow(30_000, { amountEur: 515 }),
      feedRow(60_000, { source: 'manual', amountEur: 520 }),
    ])

    const toggle = buttonByText('Automaatpakkujate duell')
    expect(toggle.textContent).toContain('4 sammu')
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('Laienda')
    expect(text()).not.toContain(plain(eur(505)))
    expect(text()).toContain(plain(eur(520)))

    await clickButton(toggle)
    const expanded = buttonByText('Automaatpakkujate duell')
    expect(expanded.getAttribute('aria-expanded')).toBe('true')
    expect(expanded.textContent).toContain('Ahenda')
    expect(text()).toContain(plain(eur(505)))
    expect(text()).toContain(plain(eur(515)))

    await clickButton(expanded)
    const collapsed = buttonByText('Automaatpakkujate duell')
    expect(collapsed.getAttribute('aria-expanded')).toBe('false')
    expect(text()).not.toContain(plain(eur(505)))
  })

  it('leaves scattered or short autobid runs as plain rows', async () => {
    await mountMonitor([
      feedRow(0),
      feedRow(10_000, { amountEur: 505 }),
      feedRow(45_000, { amountEur: 510 }),
      feedRow(85_000, { amountEur: 515 }),
    ])

    expect(text()).not.toContain('Automaatpakkujate duell')
    expect(text()).toContain(plain(eur(505)))
    expect(text()).toContain(plain(eur(515)))
  })
})

describe('BidMonitor bidder reveal chip', () => {
  it('reveals the identity through the audited action and marks the chip', async () => {
    revealAction.mockResolvedValue({
      ok: true,
      identity: { name: 'Mari Maasikas', email: 'mari@naide.ee' },
    })
    await mountMonitor([feedRow(0, { source: 'manual' })])

    const chip = buttonByText('Pakkuja #7')
    expect(chip.getAttribute('title')).toBe('Paljasta pakkuja nimi (logitakse auditisse)')
    await clickButton(chip)

    expect(revealAction).toHaveBeenCalledWith('bid-0')
    expect(text()).toContain('Mari Maasikas')
    expect(text()).toContain('(mari@naide.ee)')
    expect(text()).toContain('paljastatud — logitud auditisse')
    expect(
      [...container.querySelectorAll('button')].some((button) =>
        button.textContent.includes('Pakkuja #'),
      ),
    ).toBe(false)
  })

  it('renders the server error when the reveal is denied', async () => {
    revealAction.mockResolvedValue({ ok: false, error: 'Oksjon ei ole teie tööulatuses.' })
    await mountMonitor([feedRow(0, { source: 'manual' })])

    await clickButton(buttonByText('Pakkuja #7'))

    expect(text()).toContain('Oksjon ei ole teie tööulatuses.')
    expect(text()).not.toContain('paljastatud')
  })

  it('shows a static alias when the row has no bid id', async () => {
    await mountMonitor([feedRow(0, { source: 'manual', bidId: null, bidderAlias: 5 })])

    expect(text()).toContain('Pakkuja #5')
    expect(
      [...container.querySelectorAll('button')].some((button) =>
        button.textContent.includes('Pakkuja #'),
      ),
    ).toBe(false)
  })
})
