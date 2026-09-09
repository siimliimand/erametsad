// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

const revealAction = vi.hoisted(() => vi.fn())
const approveAction = vi.hoisted(() => vi.fn())
const rejectAction = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => nav,
}))

vi.mock('../../../../../_actions/auctions', () => ({
  endAuctionManuallyAction: vi.fn(),
  revealBidderIdentityAction: revealAction,
  approveUnderbidAction: approveAction,
  rejectUnderbidAction: rejectAction,
}))

vi.mock('../../../../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(),
}))

import {
  BidMonitor,
  type MonitorBidRow,
  type MonitorUnderbidRow,
} from '../bid-monitor'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

// The monitor opens the SSE stream on mount; jsdom has no EventSource, so
// the tests run against an inert stub instead of a live connection.
class StubEventSource {
  static instances: StubEventSource[] = []

  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    StubEventSource.instances.push(this)
  }

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
    source: 'manual',
    status: 'leading',
    backfilled: false,
    bidderId: 'bidder-1',
    bidderAlias: 7,
    bidderAccountCreatedAt: '2020-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function underbidRow(overrides: Partial<MonitorUnderbidRow> = {}): MonitorUnderbidRow {
  return {
    key: 'underbid-ub-1',
    bidId: 'ub-1',
    bidderId: 'bidder-9',
    bidderAlias: 2,
    amountEur: 12_000,
    submittedAt: new Date(baseMs - 30_000).toISOString(),
    resultingLeadingEur: 12_000,
    canBecomeLeading: true,
    ...overrides,
  }
}

function baseProps(rows: MonitorBidRow[], overrides: Partial<MonitorProps> = {}): MonitorProps {
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
    canExportBids: false,
    canViewUsers: false,
    canViewCeremony: false,
    canDecideUnderbids: false,
    underbids: [],
    ...overrides,
  }
}

function plain(value: string): string {
  return value.replace(/[\u00a0\u202f]/g, ' ')
}

function eur(value: number): string {
  return plain(value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' }))
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

let container: HTMLDivElement
let root: Root

async function mountMonitor(props: MonitorProps): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(BidMonitor, props))
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
  approveAction.mockReset()
  rejectAction.mockReset()
})

describe('BidMonitor alapakkumised block', () => {
  it('lists pending alapakkumised with a Vaata kõik link to the global queue', async () => {
    await mountMonitor(
      baseProps([], {
        underbids: [underbidRow()],
        canDecideUnderbids: true,
      }),
    )

    expect(text()).toContain('Alapakkumised (1 ootel)')
    expect(text()).toContain(eur(12_000))
    expect(text()).toContain('Pakkuja #2')

    const link = [...container.querySelectorAll('a')].find((candidate) =>
      candidate.textContent.includes('Vaata kõik'),
    )
    expect(link?.getAttribute('href')).toBe('/admin/bids')
  })

  it('shows the explicit zero state when nothing is pending', async () => {
    await mountMonitor(baseProps([]))

    expect(text()).toContain('Alapakkumised (0 ootel)')
    expect(text()).toContain('Ootel alapakkumisi ei ole.')
  })

  it('confirms the acceptance naming the resulting leading amount', async () => {
    await mountMonitor(
      baseProps([], {
        underbids: [underbidRow()],
        canDecideUnderbids: true,
      }),
    )

    await clickButton(buttonByText('Nõustu'))

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(plain(dialog?.textContent ?? '')).toContain(eur(12_000))
    expect(plain(dialog?.textContent ?? '')).toContain('muutub juhtivaks pakkumiseks')

    const form = dialog?.querySelector('button[type="submit"]')?.closest('form')
    expect(form).not.toBeNull()
    expect(form?.querySelector<HTMLInputElement>('input[name="bidId"]')?.value).toBe('ub-1')
    expect(form?.querySelector<HTMLInputElement>('input[name="auctionId"]')?.value).toBe(
      'auction-1',
    )
    expect(form?.querySelector<HTMLInputElement>('input[name="redirectTo"]')?.value).toBe(
      '/admin/auctions/auction-1/monitor',
    )

    await clickButton(form?.querySelector<HTMLButtonElement>('button[type="submit"]') ?? (() => {
      throw new Error('submit button missing')
    })())

    expect(approveAction).toHaveBeenCalledTimes(1)
    const formData = approveAction.mock.calls[0]?.[0] as FormData
    expect(formData.get('bidId')).toBe('ub-1')
  })

  it('offers the reject path with a required reason', async () => {
    await mountMonitor(
      baseProps([], {
        underbids: [underbidRow()],
        canDecideUnderbids: true,
      }),
    )

    const summary = [...container.querySelectorAll('summary')].find((candidate) =>
      candidate.textContent.includes('Keeldu põhjusega'),
    )
    expect(summary).not.toBeUndefined()
    const form = summary?.closest('details')?.querySelector('form')
    const reason = form?.querySelector<HTMLTextAreaElement>('textarea[name="reason"]')
    expect(reason?.required).toBe(true)
    expect(reason?.minLength).toBe(5)
  })

  it('withholds the accept affordance when a higher leader blocks the promotion', async () => {
    await mountMonitor(
      baseProps([], {
        underbids: [underbidRow({ canBecomeLeading: false, resultingLeadingEur: null })],
        canDecideUnderbids: true,
      }),
    )

    expect(text()).toContain('Kõrgem pakkuja on juba juhtiv')
    expect(
      [...container.querySelectorAll('button')].some((candidate) =>
        candidate.textContent.includes('Nõustu'),
      ),
    ).toBe(false)
  })
})

describe('BidMonitor anomaly zero state', () => {
  it('shows the green zero state when no anomalies are detected', async () => {
    await mountMonitor(baseProps([feedRow(0)]))

    const status = container.querySelector('p[role="status"]')
    expect(status?.textContent).toContain('Anomaaliaid ei tuvastatud')
    expect(text()).not.toContain('anomaaliat tuvastatud')
  })

  it('keeps the anomaly cards when heuristics flag the feed', async () => {
    await mountMonitor(
      baseProps([
        feedRow(0, { bidderId: 'bidder-a', bidderAlias: 1 }),
        feedRow(30_000, { bidderId: 'bidder-b', bidderAlias: 2, amountEur: 505 }),
        feedRow(60_000, { bidderId: 'bidder-a', bidderAlias: 1, amountEur: 510 }),
        feedRow(90_000, { bidderId: 'bidder-b', bidderAlias: 2, amountEur: 515 }),
        feedRow(120_000, { bidderId: 'bidder-a', bidderAlias: 1, amountEur: 520 }),
      ]),
    )

    expect(text()).toContain('anomaaliat tuvastatud')
    expect(text()).not.toContain('Anomaaliaid ei tuvastatud')
  })
})

describe('BidMonitor sealed-count ceremony link', () => {
  it('links the sealed-bid count to the opening ceremony', async () => {
    await mountMonitor(
      baseProps([], {
        isSealed: true,
        sealedBidCount: 12,
        canViewCeremony: true,
      }),
    )

    const link = [...container.querySelectorAll('a')].find((candidate) =>
      candidate.textContent.trim() === '12',
    )
    expect(link?.getAttribute('href')).toBe('/admin/auctions/auction-1/ceremony')
  })

  it('keeps the count static without the ceremony permission', async () => {
    await mountMonitor(
      baseProps([], {
        isSealed: true,
        sealedBidCount: 12,
        canViewCeremony: false,
      }),
    )

    expect(
      [...container.querySelectorAll('a')].some(
        (candidate) => candidate.getAttribute('href')?.endsWith('/ceremony'),
      ),
    ).toBe(false)
  })
})

describe('BidMonitor identity chip user link', () => {
  it('links the revealed identity to the user detail for users:read roles', async () => {
    revealAction.mockResolvedValue({
      ok: true,
      identity: { name: 'Mari Maasikas', email: 'mari@naide.ee' },
    })
    await mountMonitor(
      baseProps([feedRow(0)], { canViewUsers: true }),
    )

    await clickButton(buttonByText('Pakkuja #7'))

    const link = [...container.querySelectorAll('a')].find((candidate) =>
      candidate.textContent.includes('Mari Maasikas'),
    )
    expect(link?.getAttribute('href')).toBe('/admin/users/bidder-1')
    expect(text()).toContain('paljastatud — logitud auditisse')
  })

  it('keeps the revealed identity unlinked without users:read', async () => {
    revealAction.mockResolvedValue({
      ok: true,
      identity: { name: 'Mari Maasikas', email: 'mari@naide.ee' },
    })
    await mountMonitor(baseProps([feedRow(0)], { canViewUsers: false }))

    await clickButton(buttonByText('Pakkuja #7'))

    expect(text()).toContain('Mari Maasikas')
    expect(
      [...container.querySelectorAll('a')].some((candidate) =>
        candidate.textContent.includes('Mari Maasikas'),
      ),
    ).toBe(false)
  })
})

describe('BidMonitor export button', () => {
  it('links to the bids export route only for exporters', async () => {
    await mountMonitor(baseProps([feedRow(0)], { canExportBids: true }))

    const link = [...container.querySelectorAll('a')].find((candidate) =>
      candidate.textContent.includes('Ekspordi pakkumiste logi'),
    )
    expect(link?.getAttribute('href')).toBe(
      '/api/v1/admin/bids/export?auction=auction-1',
    )
  })

  it('hides the export affordance without the export permission', async () => {
    await mountMonitor(baseProps([feedRow(0)], { canExportBids: false }))

    expect(text()).not.toContain('Ekspordi pakkumiste logi')
  })
})
