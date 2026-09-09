// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => nav,
}))

vi.mock('../../../../../_actions/auctions', () => ({
  endAuctionManuallyAction: vi.fn(),
  revealBidderIdentityAction: vi.fn(),
}))

vi.mock('../../../../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(),
}))

import { BidMonitor, type MonitorBidRow } from '../bid-monitor'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

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
    ipHash: null,
    ...overrides,
  }
}

function baseProps(
  rows: MonitorBidRow[],
  overrides: Partial<MonitorProps> = {},
): MonitorProps {
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
    canViewAnomalies: true,
    canExportBids: false,
    canViewUsers: false,
    canViewCeremony: false,
    canDecideUnderbids: false,
    underbids: [],
    flaggedBidderIds: [],
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

async function mountMonitor(
  rows: MonitorBidRow[],
  overrides: Partial<MonitorProps> = {},
): Promise<void> {
  await act(async () => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    root.render(createElement(BidMonitor, baseProps(rows, overrides)))
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

beforeEach(() => {
  vi.stubGlobal('EventSource', StubEventSource)
  StubEventSource.instances = []
})

afterEach(async () => {
  await unmountMonitor()
  vi.unstubAllGlobals()
  nav.refresh.mockReset()
})

describe('BidMonitor shill flag marks', () => {
  it('marks the reveal chip of a flagged bidder', async () => {
    await mountMonitor([
      feedRow(0, { bidderId: 'bidder-flagged' }),
      feedRow(10_000, { bidderId: 'bidder-clean', bidderAlias: 8 }),
    ], { flaggedBidderIds: ['bidder-flagged'] })

    const marks = [...container.querySelectorAll('[title="Märgitud shill-uurimiseks"]')]
    expect(marks).toHaveLength(1)
    const mark = marks[0]
    if (!mark) throw new Error('flag mark not found')
    expect(mark.closest('td')?.textContent).toContain('Pakkuja #7')
  })

  it('marks anomaly cards that involve a flagged bidder', async () => {
    // A rapid-overtake pattern between the flagged bidder-1 and bidder-2:
    // five leading-status flips under the 10 second window.
    const rows: MonitorBidRow[] = []
    for (let index = 0; index < 10; index += 1) {
      rows.push(
        feedRow(index * 5_000, {
          bidderId: index % 2 === 0 ? 'bidder-1' : 'bidder-2',
          bidderAlias: index % 2 === 0 ? 7 : 8,
          amountEur: 500 + index * 5,
        }),
      )
    }
    await mountMonitor(rows, { flaggedBidderIds: ['bidder-1'] })

    const anomalyPanel = container.querySelector('[aria-label="Anomaaliad ja shill-hoiatused"]')
    expect(anomalyPanel).not.toBeNull()
    expect(anomalyPanel?.textContent).toContain('Kiire ülevõtmine')
    const marks = [...container.querySelectorAll('[title="Märgitud shill-uurimiseks"]')]
    expect(marks.length).toBeGreaterThanOrEqual(2)
  })

  it('marks no chips when the flagged list is empty', async () => {
    await mountMonitor([feedRow(0)])

    expect(container.querySelectorAll('[title="Märgitud shill-uurimiseks"]')).toHaveLength(0)
  })
})
