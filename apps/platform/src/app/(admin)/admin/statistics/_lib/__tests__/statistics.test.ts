import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { startOfDayMs } from '../../../_lib/workspace'
import {
  MONTH_LABELS,
  STATISTICS_PERIODS,
  TREND_DAYS,
  buildStatisticsKpis,
  countyOverview,
  dailyBidTrend,
  getStatisticsData,
  isSold,
  localDayKey,
  monthBuckets,
  monthlyResultBuckets,
  objectTypeDonut,
  periodSubline,
  round1,
  salesByDay,
  soldSubline,
  statisticsToCsv,
  topAuctions,
  windowStartMs,
  type CountyStatRow,
  type StatisticsAuctionSlice,
  type StatisticsBidSlice,
  type StatisticsCountySlice,
  type StatisticsData,
  type StatisticsSnapshotSlice,
} from '../statistics'


const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const NOW = new Date('2026-09-08T10:30:00.000Z').getTime()

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

function dayLabel(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthKeyOf(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getFullYear())}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function assertFiniteNumbers(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `expected a finite number, got ${String(value)}`).toBe(true)
  } else if (Array.isArray(value)) {
    for (const item of value) assertFiniteNumbers(item)
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) assertFiniteNumbers(item)
  }
}

let auctionSeq = 0
function auction(overrides: Partial<StatisticsAuctionSlice> = {}): StatisticsAuctionSlice {
  auctionSeq += 1
  return {
    id: `auction-${String(auctionSeq)}`,
    title: 'Metsaoksjon',
    status: 'active',
    objectType: 'raieoigus',
    type: 'open',
    countyId: 'harju',
    minBidCents: 10_000,
    finalPriceCents: null,
    feeOverridePercent: null,
    createdAt: iso(NOW - DAY_MS),
    completedAt: null,
    ...overrides,
  }
}

function sold(overrides: Partial<StatisticsAuctionSlice> = {}): StatisticsAuctionSlice {
  return auction({
    status: 'completed',
    finalPriceCents: 20_000,
    createdAt: iso(NOW - 2 * DAY_MS),
    completedAt: iso(NOW - DAY_MS),
    ...overrides,
  })
}

let bidSeq = 0
function bid(overrides: Partial<StatisticsBidSlice> = {}): StatisticsBidSlice {
  bidSeq += 1
  return {
    id: `bid-${String(bidSeq)}`,
    auctionId: 'auction-1',
    amountCents: 10_000,
    createdAt: iso(NOW - HOUR_MS),
    ...overrides,
  }
}

function snapshot(overrides: Partial<StatisticsSnapshotSlice> = {}): StatisticsSnapshotSlice {
  return {
    date: iso(NOW),
    objectType: 'raieoigus',
    count: 1,
    eur: 100,
    ...overrides,
  }
}

function county(id: string, name: string): StatisticsCountySlice {
  return { id, name }
}

describe('period windows', () => {
  it('exposes the 30/90/365 selector periods and a fixed 30-day trend', () => {
    expect(STATISTICS_PERIODS).toEqual([30, 90, 365])
    expect(TREND_DAYS).toBe(30)
  })

  it('starts each period window at local midnight, period-1 days back', () => {
    expect(windowStartMs(NOW, 30)).toBe(startOfDayMs(NOW) - 29 * DAY_MS)
    expect(windowStartMs(NOW, 90)).toBe(startOfDayMs(NOW) - 89 * DAY_MS)
    expect(windowStartMs(NOW, 365)).toBe(startOfDayMs(NOW) - 364 * DAY_MS)
  })

  it('keeps the window edges inclusive and drops unparsable timestamps', () => {
    const from = windowStartMs(NOW, 30)
    const bidCount = buildStatisticsKpis({
      now: NOW,
      period: 30,
      auctions: [],
      bids: [
        bid({ id: 'at-start', createdAt: iso(from) }),
        bid({ id: 'now', createdAt: iso(NOW) }),
        bid({ id: 'before', createdAt: iso(from - 1) }),
        bid({ id: 'after', createdAt: iso(NOW + HOUR_MS) }),
        bid({ id: 'broken', createdAt: 'not-a-date' }),
      ],
      sales: new Map(),
    }).bidCount
    expect(bidCount).toBe(2)
  })

  it('moves the window edges when the period selector changes', () => {
    const midBid = bid({ id: 'mid', createdAt: iso(startOfDayMs(NOW) - 60 * DAY_MS) })
    const counts = STATISTICS_PERIODS.map(
      (period) =>
        buildStatisticsKpis({
          now: NOW,
          period,
          auctions: [],
          bids: [midBid],
          sales: new Map(),
        }).bidCount,
    )
    expect(counts).toEqual([0, 1, 1])
  })

  it('never counts drafts even when created inside the window', () => {
    const kpis = buildStatisticsKpis({
      now: NOW,
      period: 30,
      auctions: [auction({ id: 'draft', status: 'draft' }), auction({ id: 'live' })],
      bids: [],
      sales: new Map(),
    })
    expect(kpis.totalAuctions).toBe(1)
  })
})

describe('rounding helpers', () => {
  it('rounds percentages to one decimal', () => {
    expect(round1(33.33)).toBe(33.3)
    expect(round1(33.36)).toBe(33.4)
    expect(round1(50)).toBe(50)
    expect(round1(0.04)).toBe(0)
  })
})

describe('isSold', () => {
  it('accepts completed and archived lots with a positive final price', () => {
    expect(isSold(sold())).toBe(true)
    expect(isSold(sold({ status: 'archived' }))).toBe(true)
  })

  it('rejects unsold statuses and zero, negative, or missing prices', () => {
    expect(isSold(auction({ status: 'ended', finalPriceCents: 5_000 }))).toBe(false)
    expect(isSold(sold({ finalPriceCents: 0 }))).toBe(false)
    expect(isSold(sold({ finalPriceCents: -5 }))).toBe(false)
    expect(isSold(auction())).toBe(false)
  })
})

describe('salesByDay', () => {
  const covered = startOfDayMs(NOW)
  const uncovered = covered - 2 * DAY_MS
  const third = covered - 3 * DAY_MS

  it('prefers snapshot days and falls back to live completions elsewhere', () => {
    const sales = salesByDay(
      [
        snapshot({ date: iso(covered), objectType: 'raieoigus', count: 2, eur: 250.5 }),
        snapshot({ date: iso(covered), objectType: 'kinnistu', count: 1, eur: 100 }),
        snapshot({ date: iso(third), count: 1, eur: 10.129 }),
      ],
      [
        sold({ id: 'on-covered', finalPriceCents: 99_999, completedAt: iso(covered + HOUR_MS) }),
        sold({ id: 'on-fallback', finalPriceCents: 50_000, completedAt: iso(uncovered + HOUR_MS) }),
        sold({
          id: 'on-fallback-later',
          finalPriceCents: 7_000,
          completedAt: iso(uncovered + 2 * HOUR_MS),
        }),
      ],
      NOW,
      30,
    )
    expect(sales.size).toBe(3)
    expect(sales.get(localDayKey(covered))).toEqual({ count: 3, finalCents: 35_050 })
    expect(sales.get(localDayKey(uncovered))).toEqual({ count: 2, finalCents: 57_000 })
    expect(sales.get(localDayKey(third))).toEqual({ count: 1, finalCents: 1_013 })
  })

  it('drops snapshots outside the window and keeps the start edge inclusive', () => {
    const from = windowStartMs(NOW, 30)
    const sales = salesByDay(
      [
        snapshot({ date: iso(from), count: 1, eur: 10 }),
        snapshot({ date: iso(from - 1), count: 5, eur: 500 }),
        snapshot({ date: iso(NOW + HOUR_MS), count: 9, eur: 900 }),
      ],
      [],
      NOW,
      30,
    )
    expect(sales.size).toBe(1)
    expect(sales.get(localDayKey(from))).toEqual({ count: 1, finalCents: 1_000 })
  })

  it('returns an empty map for empty inputs', () => {
    expect(salesByDay([], [], NOW, 365).size).toBe(0)
  })
})

describe('buildStatisticsKpis', () => {
  it('returns zeroed kpis for empty input without NaN leaks', () => {
    const kpis = buildStatisticsKpis({
      now: NOW,
      period: 30,
      auctions: [],
      bids: [],
      sales: new Map(),
    })
    expect(kpis).toStrictEqual({
      totalAuctions: 0,
      sold: { percent: null, count: 0 },
      avgUplift: { percent: null },
      serviceFee: { cents: 0, eur: 0 },
      bidCount: 0,
      avgFinalPrice: { cents: null, eur: null },
    })
    assertFiniteNumbers(kpis)
  })

  it('averages uplift over sold lots and rounds share, fee, and average price', () => {
    const auctions = [
      sold({ id: 'up-1', minBidCents: 10_000, finalPriceCents: 20_000 }),
      sold({ id: 'up-2', minBidCents: 20_000, finalPriceCents: 21_000 }),
      auction({ id: 'active' }),
      auction({ id: 'ended', status: 'ended', finalPriceCents: 5_000 }),
    ]
    const kpis = buildStatisticsKpis({
      now: NOW,
      period: 30,
      auctions,
      bids: [],
      sales: salesByDay([], auctions, NOW, 30),
    })
    expect(kpis.totalAuctions).toBe(4)
    expect(kpis.sold).toEqual({ percent: 50, count: 2 })
    expect(kpis.avgUplift).toEqual({ percent: 52.5 })
    expect(kpis.serviceFee).toEqual({ cents: 1_501, eur: 15.01 })
    expect(kpis.avgFinalPrice).toEqual({ cents: 20_500, eur: 205 })
  })

  it('charges the 3% + VAT fee only on completions inside the window', () => {
    const from = windowStartMs(NOW, 30)
    const auctions = [
      sold({ id: 'fee-in', finalPriceCents: 10_000 }),
      sold({ id: 'fee-zero', finalPriceCents: 10_000, feeOverridePercent: 0 }),
      sold({ id: 'fee-stale', completedAt: iso(from - DAY_MS) }),
    ]
    const kpis = buildStatisticsKpis({
      now: NOW,
      period: 30,
      auctions,
      bids: [],
      sales: salesByDay([], auctions, NOW, 30),
    })
    expect(kpis.serviceFee).toEqual({ cents: 366, eur: 3.66 })
    expect(kpis.avgUplift).toEqual({ percent: 33.3 })
    expect(kpis.sold.count).toBe(2)
  })

  it('skips zero starting prices in the uplift average', () => {
    const auctions = [
      sold({ id: 'no-min', minBidCents: 0, finalPriceCents: 5_000 }),
      sold({ id: 'normal', minBidCents: 10_000, finalPriceCents: 15_000 }),
    ]
    const kpis = buildStatisticsKpis({
      now: NOW,
      period: 30,
      auctions,
      bids: [],
      sales: salesByDay([], auctions, NOW, 30),
    })
    expect(kpis.avgUplift).toEqual({ percent: 50 })
  })
})

describe('monthly chart data', () => {
  it('builds one bucket per calendar month touched by the window', () => {
    expect(monthBuckets(NOW, 30).map((bucket) => bucket.key)).toEqual([
      monthKeyOf(windowStartMs(NOW, 30)),
      monthKeyOf(NOW),
    ])
    expect(monthBuckets(NOW, 90)).toHaveLength(4)
    expect(monthBuckets(NOW, 365)).toHaveLength(13)
    const lastLabel = MONTH_LABELS[new Date(NOW).getMonth()]
    expect(monthBuckets(NOW, 90).at(-1)?.label).toBe(lastLabel)
    expect(monthBuckets(NOW, 365).at(-1)?.label).toBe(lastLabel)
  })

  it('shapes grouped bars with starting prices and snapshot-first final sums', () => {
    const auctions = [
      sold({
        id: 'aug',
        minBidCents: 12_345,
        finalPriceCents: 23_456,
        createdAt: iso(NOW - 20 * DAY_MS),
        completedAt: iso(NOW - 19 * DAY_MS),
      }),
      auction({ id: 'active', minBidCents: 50_000, createdAt: iso(NOW - 5 * DAY_MS) }),
    ]
    const monthly = monthlyResultBuckets(auctions, [snapshot({ count: 1, eur: 100.5 })], NOW, 30)
    expect(monthly.months).toHaveLength(2)
    expect(monthly.series).toEqual([
      { name: 'Alghind', color: 'primary', values: [123, 0] },
      { name: 'Lõpphind', color: 'accent', values: [235, 101] },
    ])
  })

  it('keeps bars at zero when the window has no sales', () => {
    const monthly = monthlyResultBuckets([auction({ id: 'live' })], [], NOW, 90)
    expect(monthly.series.every((series) => series.values.every((value) => value === 0))).toBe(
      true,
    )
  })
})

describe('type donut data', () => {
  it('counts windowed lots per known type in the fixed label order', () => {
    const from = windowStartMs(NOW, 30)
    const donut = objectTypeDonut(
      [
        auction({ id: 'a', objectType: 'kinnistu', createdAt: iso(NOW - DAY_MS) }),
        auction({ id: 'b', objectType: 'raieoigus', createdAt: iso(NOW - 2 * DAY_MS) }),
        auction({ id: 'c', objectType: 'raieoigus', createdAt: iso(NOW - 3 * DAY_MS) }),
        auction({ id: 'd', objectType: 'muu', createdAt: iso(NOW - 4 * DAY_MS) }),
        auction({ id: 'draft', objectType: 'raieoigus', status: 'draft' }),
        auction({ id: 'old', objectType: 'kiire', createdAt: iso(from - DAY_MS) }),
      ],
      NOW,
      30,
    )
    expect(donut).toEqual([
      { label: 'Raieõigus', value: 2, color: 'primary' },
      { label: 'Kinnistu', value: 1, color: 'accent' },
    ])
    const total = donut.reduce((sum, segment) => sum + segment.value, 0)
    expect(total).toBe(3)
  })

  it('returns no segments for an empty window', () => {
    expect(objectTypeDonut([], NOW, 365)).toEqual([])
  })
})

describe('bid trend data', () => {
  it('fills a fixed 30-day series with inclusive window edges', () => {
    const dayStart = startOfDayMs(NOW)
    const trend = dailyBidTrend(
      [
        bid({ id: 'today', createdAt: iso(NOW) }),
        bid({ id: 'first-day', createdAt: iso(dayStart - (TREND_DAYS - 1) * DAY_MS) }),
        bid({ id: 'too-old', createdAt: iso(dayStart - TREND_DAYS * DAY_MS) }),
        bid({ id: 'broken', createdAt: 'not-a-date' }),
      ],
      NOW,
    )
    expect(trend.values).toHaveLength(TREND_DAYS)
    expect(trend.labels).toHaveLength(TREND_DAYS)
    expect(trend.labels[0]).toBe(dayLabel(dayStart - (TREND_DAYS - 1) * DAY_MS))
    expect(trend.labels.at(-1)).toBe(dayLabel(dayStart))
    expect(trend.values[0]).toBe(1)
    expect(trend.values.at(-1)).toBe(1)
    expect(trend.values.slice(1, -1).every((value) => value === 0)).toBe(true)
  })

  it('returns a zero-filled 30-day series for empty input', () => {
    const trend = dailyBidTrend([], NOW)
    expect(trend.values).toHaveLength(TREND_DAYS)
    expect(trend.values.every((value) => value === 0)).toBe(true)
  })
})

describe('top auctions', () => {
  it('ranks by uplift percent then final price and caps at five', () => {
    const rows = topAuctions(
      [
        sold({ id: 't-1', minBidCents: 10_000, finalPriceCents: 20_000 }),
        sold({ id: 't-2', minBidCents: 20_000, finalPriceCents: 40_000 }),
        sold({ id: 't-3', minBidCents: 50_000, finalPriceCents: 51_000 }),
        sold({ id: 't-4', minBidCents: 0, finalPriceCents: 3_000 }),
        sold({ id: 't-5', completedAt: iso(windowStartMs(NOW, 30) - DAY_MS) }),
        auction({ id: 't-6', status: 'active' }),
        sold({ id: 't-7', minBidCents: 10_000, finalPriceCents: 11_000 }),
      ],
      NOW,
      30,
    )
    expect(rows.map((row) => row.id)).toEqual(['t-2', 't-1', 't-7', 't-3', 't-4'])
    expect(rows[0]).toEqual({
      id: 't-2',
      title: 'Metsaoksjon',
      objectType: 'raieoigus',
      minBidCents: 20_000,
      finalPriceCents: 40_000,
      upliftPercent: 100,
    })
  })

  it('honours a custom limit', () => {
    const rows = topAuctions([sold({ id: 'only' })], NOW, 30, 1)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.upliftPercent).toBe(100)
  })
})

describe('county overview', () => {
  it('aggregates totals, sold counts, and average finals per county', () => {
    const rows = countyOverview(
      [
        sold({ id: 'h-1', countyId: 'harju', minBidCents: 10_000, finalPriceCents: 10_000 }),
        sold({
          id: 'h-2',
          countyId: 'harju',
          minBidCents: 10_000,
          finalPriceCents: 30_000,
          createdAt: iso(NOW - 3 * DAY_MS),
          completedAt: iso(NOW - 2 * DAY_MS),
        }),
        auction({ id: 'h-3', countyId: 'harju' }),
        sold({ id: 't-1', countyId: 'tartu', minBidCents: 7_000, finalPriceCents: 7_000 }),
        auction({ id: 't-2', countyId: 'tartu', status: 'ended', finalPriceCents: 5_000 }),
        auction({
          id: 't-3',
          countyId: 'tartu',
          status: 'ended',
          finalPriceCents: 5_000,
          createdAt: iso(NOW - 2 * DAY_MS),
        }),
        sold({ id: 'x-1', countyId: 'x', minBidCents: 5_000, finalPriceCents: 5_000 }),
      ],
      [county('harju', 'Harju'), county('tartu', 'Tartu')],
      NOW,
      30,
    )
    expect(rows.map((row) => row.countyId)).toEqual(['harju', 'tartu', 'x'])
    expect(rows[0]).toEqual({
      countyId: 'harju',
      name: 'Harju',
      total: 3,
      sold: 2,
      avgFinalCents: 20_000,
      avgFinalEur: 200,
    })
    expect(rows[1]?.sold).toBe(1)
    expect(rows[1]?.avgFinalEur).toBe(70)
    expect(rows[2]?.name).toBe('x')
  })

  it('reports a null average for counties without sales', () => {
    const rows = countyOverview(
      [auction({ id: 'only', countyId: 'harju', status: 'ended' })],
      [county('harju', 'Harju')],
      NOW,
      30,
    )
    expect(rows[0]).toEqual({
      countyId: 'harju',
      name: 'Harju',
      total: 1,
      sold: 0,
      avgFinalCents: null,
      avgFinalEur: null,
    })
  })
})

describe('kpi sublines', () => {
  it('formats the period subline for every selector option', () => {
    expect(periodSubline(30)).toBe('viimase 30 päeva jooksul')
    expect(periodSubline(90)).toBe('viimase 90 päeva jooksul')
    expect(periodSubline(365)).toBe('aasta jooksul')
  })

  it('formats sold counts with the Estonian partitive', () => {
    expect(soldSubline(1)).toBe('1 müüdud oksjon')
    expect(soldSubline(0)).toBe('0 müüdud oksjonit')
    expect(soldSubline(27)).toBe('27 müüdud oksjonit')
  })
})

describe('csv export', () => {
  function csvData(counties: CountyStatRow[]): StatisticsData {
    return {
      period: 30,
      kpis: {
        totalAuctions: 3,
        sold: { percent: 66.7, count: 2 },
        avgUplift: { percent: 12.5 },
        serviceFee: { cents: 732, eur: 7.32 },
        bidCount: 9,
        avgFinalPrice: { cents: null, eur: null },
      },
      monthly: {
        months: ['Aug', 'Sept'],
        series: [
          { name: 'Alghind', color: 'primary', values: [100, 200] },
          { name: 'Lõpphind', color: 'accent', values: [150, 250] },
        ],
      },
      donut: [{ label: 'Raieõigus', value: 3, color: 'primary' }],
      trend: { labels: ['10.08'], values: [0] },
      topAuctions: [],
      counties,
    }
  }

  it('exports every aggregation as semicolon-separated CRLF rows', () => {
    const csv = statisticsToCsv(
      csvData([
        {
          countyId: 'harju',
          name: 'Harju',
          total: 3,
          sold: 2,
          avgFinalCents: 20_000,
          avgFinalEur: 200,
        },
      ]),
    )
    const lines = csv.split('\r\n')
    expect(lines[0]).toBe('"Osal;Näitaja;Väärtus"')
    expect(lines).toContain('NPK;Oksjonite koguarv;3')
    expect(lines).toContain('NPK;Müüdud %;66.7')
    expect(lines).toContain('NPK;2 müüdud oksjonit;2')
    expect(lines).toContain('NPK;Teenustasu perioodil (€);7')
    expect(lines).toContain('NPK;Keskmine müügihind (€);')
    expect(lines).toContain('KUU;Aug;100;150')
    expect(lines).toContain('TYYP;Raieõigus;3')
    expect(lines).toContain('MK;Harju;3;2;200')
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('quotes cells that contain separators or double quotes', () => {
    const csv = statisticsToCsv(
      csvData([
        {
          countyId: 'a',
          name: 'Põhja;Ida',
          total: 1,
          sold: 0,
          avgFinalCents: null,
          avgFinalEur: null,
        },
        { countyId: 'b', name: 'Muu"Osa', total: 1, sold: 1, avgFinalCents: 500, avgFinalEur: 5 },
      ]),
    )
    expect(csv).toContain('"Põhja;Ida";1;0;')
    expect(csv).toContain('"Muu""Osa";1;1;5')
  })
})

interface StatisticsFindArgs {
  collection: string
  where?: Record<string, unknown>
  sort?: string
  limit?: number
  pagination?: boolean
}

interface RepositoryFixtures {
  auctions: unknown[]
  bids: unknown[]
  snapshots: unknown[]
  counties: unknown[]
}

const state = vi.hoisted(() => ({
  repositories: null as {
    find: (args: {
      collection: string
      where?: Record<string, unknown>
      sort?: string
      limit?: number
      pagination?: boolean
    }) => Promise<{ docs: unknown[] }>
  } | null,
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: () => {
    if (state.repositories === null) {
      return Promise.reject(new Error('test repositories not seeded'))
    }
    return Promise.resolve(state.repositories)
  },
}))

function docsFor(fixtures: RepositoryFixtures, args: StatisticsFindArgs): unknown[] {
  switch (args.collection) {
    case 'auctions':
      return fixtures.auctions
    case 'bids':
      return fixtures.bids
    case 'statistics-snapshots':
      return fixtures.snapshots
    case 'counties':
      return fixtures.counties
    default:
      return []
  }
}

function seedRepositories(overrides: Partial<RepositoryFixtures> = {}): StatisticsFindArgs[] {
  const fixtures: RepositoryFixtures = {
    auctions: [],
    bids: [],
    snapshots: [],
    counties: [],
    ...overrides,
  }
  const calls: StatisticsFindArgs[] = []
  state.repositories = {
    find: (args: StatisticsFindArgs) => {
      calls.push(args)
      return Promise.resolve({ docs: docsFor(fixtures, args) })
    },
  }
  return calls
}

function oldAuctionRows(): StatisticsAuctionSlice[] {
  return [
    sold({
      id: 'old',
      createdAt: iso(NOW - 40 * DAY_MS),
      completedAt: iso(NOW - 39 * DAY_MS),
      minBidCents: 10_000,
      finalPriceCents: 20_000,
    }),
  ]
}

describe('getStatisticsData', () => {
  let nowSpy: { mockReturnValue: (value: number) => unknown; mockRestore: () => void } | undefined

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(NOW)
  })

  afterEach(() => {
    nowSpy?.mockRestore()
    nowSpy = undefined
    state.repositories = null
  })

  it('returns zeroed structures for an empty database without NaN leaks', async () => {
    seedRepositories()
    const data = await getStatisticsData(30)
    expect(data.period).toBe(30)
    expect(data.kpis).toStrictEqual({
      totalAuctions: 0,
      sold: { percent: null, count: 0 },
      avgUplift: { percent: null },
      serviceFee: { cents: 0, eur: 0 },
      bidCount: 0,
      avgFinalPrice: { cents: null, eur: null },
    })
    expect(data.donut).toEqual([])
    expect(data.topAuctions).toEqual([])
    expect(data.counties).toEqual([])
    expect(data.monthly.months).toHaveLength(2)
    expect(data.trend.labels).toHaveLength(TREND_DAYS)
    expect(data.trend.values.every((value) => value === 0)).toBe(true)
    assertFiniteNumbers(data)
  })

  it('fetches the non-draft slice and a bid window that covers a year', async () => {
    const calls = seedRepositories({
      auctions: oldAuctionRows(),
      bids: [bid({ id: 'old-bid', auctionId: 'old', createdAt: iso(NOW - 40 * DAY_MS) })],
      counties: [county('harju', 'Harju')],
    })
    const data = await getStatisticsData(90)
    expect(data.kpis.totalAuctions).toBe(1)
    expect(data.kpis.sold).toEqual({ percent: 100, count: 1 })
    expect(data.kpis.avgFinalPrice).toEqual({ cents: 20_000, eur: 200 })
    expect(data.kpis.bidCount).toBe(1)
    expect(data.counties).toEqual([
      {
        countyId: 'harju',
        name: 'Harju',
        total: 1,
        sold: 1,
        avgFinalCents: 20_000,
        avgFinalEur: 200,
      },
    ])
    expect(data.trend.values.every((value) => value === 0)).toBe(true)
    const auctionCall = calls.find((args) => args.collection === 'auctions')
    expect(auctionCall?.where).toEqual({ status: { not_equals: 'draft' } })
    const bidCall = calls.find((args) => args.collection === 'bids')
    expect(bidCall?.sort).toBe('-createdAt')
    expect(bidCall?.limit ?? 0).toBeGreaterThanOrEqual(1_000)
  })

  it('switches the aggregation window with the period while the trend stays fixed', async () => {
    seedRepositories({
      auctions: oldAuctionRows(),
      bids: [bid({ id: 'old-bid', auctionId: 'old', createdAt: iso(NOW - 40 * DAY_MS) })],
      counties: [county('harju', 'Harju')],
    })
    const short = await getStatisticsData(30)
    const long = await getStatisticsData(90)
    expect(short.kpis.totalAuctions).toBe(0)
    expect(long.kpis.totalAuctions).toBe(1)
    expect(short.kpis.bidCount).toBe(0)
    expect(long.kpis.bidCount).toBe(1)
    expect(short.trend).toEqual(long.trend)
    expect(short.counties).toEqual([])
    expect(long.counties).toHaveLength(1)
    expect(short.monthly.months).toHaveLength(2)
    expect(long.monthly.months).toHaveLength(4)
  })
})
