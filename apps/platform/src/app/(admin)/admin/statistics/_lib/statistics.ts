import { startOfDayMs, successFeeCents } from '../../_lib/workspace'
import type {
  ChartColor,
  MonthlyStackedData,
  TypeDonutSegment,
  TrendData,
} from '../_components/Charts'


import type { CoreRepositories } from '@/lib/data/repositories'
import { centsToEuros } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'
import { auctionObjectTypes } from '@/lib/data/schema'

/**
 * Data layer for the Statistika page (12 demo). Pure aggregation functions
 * take plain row slices so tests can feed fixtures; `getStatisticsData` is
 * the one orchestrating fetcher the page calls after gating on
 * `statistics:read`. Reads run on system-context repositories: every export
 * here is an aggregated count or sum — no winner identities, no per-bidder
 * breakdowns ever leave this module.
 *
 * Completed-sale totals (count + final price) prefer statistics snapshots,
 * which are written on auction completion from the archive. A day with any
 * snapshot row is taken as authoritative for that day; days without snapshot
 * coverage (typically the newest days) fall back to live auction rows. All
 * other views read the live tables directly: snapshots carry no starting
 * price, county, or per-auction identity.
 */

const DAY_MS = 86_400_000

export const STATISTICS_PERIODS = [30, 90, 365] as const
export type StatisticsPeriod = (typeof STATISTICS_PERIODS)[number]

/** The bid trend card is always the last 30 days, regardless of period. */
export const TREND_DAYS = 30

/** Fetch ceiling for bids; the repository default of 100 cannot cover a year. */
const BID_FETCH_LIMIT = 20_000

/** Estonian short month labels, indexed 0-11 (demo bar-chart axis). */
export const MONTH_LABELS = [
  'Jaan',
  'Veebr',
  'Märts',
  'Apr',
  'Mai',
  'Juuni',
  'Juuli',
  'Aug',
  'Sept',
  'Okt',
  'Nov',
  'Dets',
] as const

export const OBJECT_TYPE_LABELS: Record<string, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire müük',
  pakett: 'Pakett',
}

/** Fixed donut palette order so segment colors never shuffle between renders. */
const OBJECT_TYPE_COLORS: Record<string, ChartColor> = {
  raieoigus: 'primary',
  kinnistu: 'accent',
  kiire: 'cta',
  pakett: 'info',
}

export const statisticsKpiLabels = {
  totalAuctions: 'Oksjonite koguarv',
  sold: 'Müüdud %',
  avgUplift: 'Keskmine ülepakkumine %',
  serviceFee: 'Teenustasu perioodil (€)',
  bidCount: 'Pakkumisi perioodil',
  avgFinalPrice: 'Keskmine müügihind (€)',
} as const

export function periodSubline(period: StatisticsPeriod): string {
  return period === 365 ? 'aasta jooksul' : `viimase ${String(period)} päeva jooksul`
}

export function soldSubline(count: number): string {
  return count === 1 ? '1 müüdud oksjon' : `${String(count)} müüdud oksjonit`
}

/** Minimal row shapes the aggregations read; repository docs satisfy them. */
export interface StatisticsAuctionSlice {
  id: string
  title: string
  status: string
  objectType: string
  type: string
  isQuickAuction: boolean
  countyId: string | null
  minBidCents: number
  finalPriceCents: number | null
  feeOverridePercent: number | null
  createdAt: string
  completedAt: string | null
  endedAt: string | null
  updatedAt: string
}

export interface StatisticsBidSlice {
  id: string
  auctionId: string
  amountCents: number
  createdAt: string
}

export interface StatisticsSnapshotSlice {
  date: string
  objectType: string
  count: number
  /** EUR at the repository boundary (snapshot eur_cents are decoded). */
  eur: number
}

export interface StatisticsContractSlice {
  lotId: string
  status: string
  /** Void time for the tühistatud month bucket. */
  updatedAt: string
}

export interface StatisticsCountySlice {
  id: string
  name: string
}

export interface SalesDayTotals {
  count: number
  finalCents: number
}

export interface StatisticsKpis {
  totalAuctions: number
  sold: { percent: number | null; count: number }
  avgUplift: { percent: number | null }
  serviceFee: { cents: number; eur: number }
  bidCount: number
  avgFinalPrice: { cents: number | null; eur: number | null }
}

export interface TopAuctionRow {
  id: string
  title: string
  objectType: string
  minBidCents: number
  finalPriceCents: number
  upliftPercent: number
}

export interface CountyStatRow {
  countyId: string
  name: string
  total: number
  sold: number
  avgFinalCents: number | null
  avgFinalEur: number | null
}

export interface StatisticsData {
  period: StatisticsPeriod
  filters: StatisticsFilters
  kpis: StatisticsKpis
  monthly: MonthlyStackedData
  donut: TypeDonutSegment[]
  trend: TrendData
  topAuctions: TopAuctionRow[]
  counties: CountyStatRow[]
  /** Every county, for the page's Maakond filter options. */
  countyOptions: StatisticsCountySlice[]
}

/**
 * searchParams-driven view filters (Tüüp incl. the kiiroksjon flag,
 * Maakond). They narrow the auction slice before every aggregation; only
 * the fixed 30-day bid trend stays unfiltered.
 */
export interface StatisticsFilters {
  /** One of `auctionObjectTypes`, or null for all. */
  objectType: string | null
  /** The Tüüp option "Kiiroksjon" (isQuickAuction flag). */
  quickAuctionOnly: boolean
  countyId: string | null
}

export const NO_STATISTICS_FILTERS: StatisticsFilters = {
  objectType: null,
  quickAuctionOnly: false,
  countyId: null,
}

/** Tüüp option value that filters on the kiiroksjon flag, not objectType. */
export const QUICK_AUCTION_FILTER = 'kiiroksjon'

export function parseStatisticsFilters(input: {
  type: string
  county: string
}): StatisticsFilters {
  const type = input.type.trim()
  const isType = (auctionObjectTypes as readonly string[]).includes(type)
  return {
    objectType: isType && type !== QUICK_AUCTION_FILTER ? type : null,
    quickAuctionOnly: type === QUICK_AUCTION_FILTER,
    countyId: input.county.trim() === '' ? null : input.county.trim(),
  }
}

export function statisticsFiltersActive(filters: StatisticsFilters): boolean {
  return (
    filters.objectType !== null || filters.quickAuctionOnly || filters.countyId !== null
  )
}

export function filterStatisticsAuctions(
  auctions: readonly StatisticsAuctionSlice[],
  filters: StatisticsFilters,
): StatisticsAuctionSlice[] {
  return auctions.filter(
    (auction) =>
      (!filters.quickAuctionOnly || auction.isQuickAuction) &&
      (!filters.objectType || auction.objectType === filters.objectType) &&
      (!filters.countyId || auction.countyId === filters.countyId),
  )
}

function parseTime(iso: string): number | null {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? null : time
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** Local calendar-day key; snapshots store local midnights, so keys align. */
export function localDayKey(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function monthKey(ms: number): string {
  const date = new Date(ms)
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}`
}

export function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function windowStartMs(now: number, period: StatisticsPeriod): number {
  return startOfDayMs(now) - (period - 1) * DAY_MS
}

function inWindow(iso: string, fromMs: number, toMs: number): boolean {
  const time = parseTime(iso)
  return time !== null && time >= fromMs && time <= toMs
}

/** Auctions visible to statistics: anything the window created, drafts never. */
function windowAuctions(
  auctions: readonly StatisticsAuctionSlice[],
  now: number,
  period: StatisticsPeriod,
): StatisticsAuctionSlice[] {
  const from = windowStartMs(now, period)
  return auctions.filter(
    (auction) => auction.status !== 'draft' && inWindow(auction.createdAt, from, now),
  )
}

/** A sold auction: completed or archived with a positive final price. */
export function isSold(auction: StatisticsAuctionSlice): boolean {
  return (
    (auction.status === 'completed' || auction.status === 'archived') &&
    auction.finalPriceCents !== null &&
    auction.finalPriceCents > 0
  )
}

/**
 * Completed-sale totals per local day. Snapshot days win; uncovered days fall
 * back to live completed auctions, so the newest completions are never lost
 * to a snapshot lag.
 */
export function salesByDay(
  snapshots: readonly StatisticsSnapshotSlice[],
  auctions: readonly StatisticsAuctionSlice[],
  now: number,
  period: StatisticsPeriod,
): Map<string, SalesDayTotals> {
  const from = windowStartMs(now, period)
  const merged = new Map<string, SalesDayTotals>()
  const snapshotDays = new Set<string>()
  for (const snapshot of snapshots) {
    const time = parseTime(snapshot.date)
    if (time === null || time < from || time > now) continue
    const key = localDayKey(time)
    snapshotDays.add(key)
    const totals = merged.get(key) ?? { count: 0, finalCents: 0 }
    totals.count += snapshot.count
    totals.finalCents += Math.round(snapshot.eur * 100)
    merged.set(key, totals)
  }
  for (const auction of auctions) {
    if (!isSold(auction) || !inWindow(auction.completedAt ?? '', from, now)) continue
    const key = localDayKey(parseTime(auction.completedAt ?? '') ?? now)
    if (snapshotDays.has(key)) continue
    const existing = merged.get(key)
    merged.set(key, {
      count: (existing?.count ?? 0) + 1,
      finalCents: (existing?.finalCents ?? 0) + (auction.finalPriceCents ?? 0),
    })
  }
  return merged
}

function salesTotals(sales: Map<string, SalesDayTotals>): SalesDayTotals {
  let count = 0
  let finalCents = 0
  for (const totals of sales.values()) {
    count += totals.count
    finalCents += totals.finalCents
  }
  return { count, finalCents }
}

export interface StatisticsKpiInput {
  now: number
  period: StatisticsPeriod
  /** Non-draft auction rows; snapshots already merged into `sales`. */
  auctions: readonly StatisticsAuctionSlice[]
  bids: readonly StatisticsBidSlice[]
  sales: Map<string, SalesDayTotals>
}

export function buildStatisticsKpis(input: StatisticsKpiInput): StatisticsKpis {
  const { now, period, auctions, bids, sales } = input
  const from = windowStartMs(now, period)
  const windowed = windowAuctions(auctions, now, period)
  const soldAuctions = windowed.filter(isSold)
  const { count: soldCount, finalCents } = salesTotals(sales)

  const uplifts: number[] = []
  let feeCents = 0
  for (const auction of soldAuctions) {
    const min = auction.minBidCents
    const final = auction.finalPriceCents ?? 0
    if (min > 0) uplifts.push(((final - min) / min) * 100)
    if (inWindow(auction.completedAt ?? '', from, now)) {
      feeCents += successFeeCents(final, auction.feeOverridePercent)
    }
  }

  const bidCount = bids.reduce(
    (total, bid) => (inWindow(bid.createdAt, from, now) ? total + 1 : total),
    0,
  )

  const avgFinalCents = soldCount > 0 ? Math.round(finalCents / soldCount) : null
  return {
    totalAuctions: windowed.length,
    sold: {
      percent: windowed.length > 0 ? round1((100 * soldCount) / windowed.length) : null,
      count: soldCount,
    },
    avgUplift: {
      percent: uplifts.length > 0 ? round1(uplifts.reduce((a, b) => a + b, 0) / uplifts.length) : null,
    },
    serviceFee: { cents: feeCents, eur: centsToEuros(feeCents) },
    bidCount,
    avgFinalPrice: {
      cents: avgFinalCents,
      eur: avgFinalCents === null ? null : centsToEuros(avgFinalCents),
    },
  }
}

export interface MonthBucket {
  key: string
  label: string
}

export function monthBuckets(now: number, period: StatisticsPeriod): MonthBucket[] {
  const from = windowStartMs(now, period)
  const buckets: MonthBucket[] = []
  const cursor = new Date(from)
  cursor.setDate(1)
  cursor.setHours(0, 0, 0, 0)
  const endKey = monthKey(now)
  while (monthKey(cursor.getTime()) <= endKey) {
    const month = cursor.getMonth()
    buckets.push({ key: monthKey(cursor.getTime()), label: MONTH_LABELS[month] ?? '' })
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return buckets
}

/**
 * Outcome timestamps bucket the monthly chart: completion for sold lots,
 * otherwise the end stamp, else the last update.
 */
export function outcomeAt(auction: StatisticsAuctionSlice): string {
  return auction.completedAt ?? auction.endedAt ?? auction.updatedAt
}

/** Fixed stacked series order: müüdud, müümata, tühistatud. */
export const OUTCOME_SERIES: readonly {
  name: string
  color: ChartColor
}[] = [
  { name: 'Müüdud', color: 'primary' },
  { name: 'Müümata', color: 'accent' },
  { name: 'Tühistatud', color: 'danger' },
]

/**
 * Demo card "Oksjonite tulemused kuupõhiselt", now counting outcomes per
 * month instead of euros: müüdud (sold per `isSold`), müümata (`unsold`
 * branch), tühistatud (voided contracts — the machine has no cancelled
 * auction status, the contract status list does). Buckets use the outcome
 * date, so lots created before the window still land in their outcome
 * month.
 */
export function monthlyOutcomeBuckets(
  auctions: readonly StatisticsAuctionSlice[],
  voidedContracts: readonly StatisticsContractSlice[],
  now: number,
  period: StatisticsPeriod,
): MonthlyStackedData {
  const buckets = monthBuckets(now, period)
  const from = windowStartMs(now, period)
  const index = new Map(buckets.map((bucket, i) => [bucket.key, i]))
  const sold = Array.from({ length: buckets.length }, () => 0)
  const unsold = Array.from({ length: buckets.length }, () => 0)
  const cancelled = Array.from({ length: buckets.length }, () => 0)

  const bucketOf = (iso: string): number | undefined => {
    const time = parseTime(iso)
    if (time === null || time < from || time > now) return undefined
    return index.get(monthKey(time))
  }

  for (const auction of auctions) {
    if (isSold(auction)) {
      const i = bucketOf(outcomeAt(auction))
      if (i !== undefined) sold[i] = (sold[i] ?? 0) + 1
    } else if (auction.status === 'unsold') {
      const i = bucketOf(outcomeAt(auction))
      if (i !== undefined) unsold[i] = (unsold[i] ?? 0) + 1
    }
  }
  for (const contract of voidedContracts) {
    const i = bucketOf(contract.updatedAt)
    if (i !== undefined) cancelled[i] = (cancelled[i] ?? 0) + 1
  }

  return {
    months: buckets.map((bucket) => bucket.label),
    series: OUTCOME_SERIES.map((meta, seriesIndex) => ({
      ...meta,
      values: [sold, unsold, cancelled][seriesIndex] ?? [],
    })),
  }
}

export function objectTypeDonut(
  auctions: readonly StatisticsAuctionSlice[],
  now: number,
  period: StatisticsPeriod,
): TypeDonutSegment[] {
  const counts = new Map<string, number>()
  for (const auction of windowAuctions(auctions, now, period)) {
    counts.set(auction.objectType, (counts.get(auction.objectType) ?? 0) + 1)
  }
  return Object.keys(OBJECT_TYPE_LABELS)
    .filter((objectType) => (counts.get(objectType) ?? 0) > 0)
    .map((objectType) => ({
      label: OBJECT_TYPE_LABELS[objectType] ?? objectType,
      value: counts.get(objectType) ?? 0,
      color: OBJECT_TYPE_COLORS[objectType] ?? 'info',
    }))
}

/** Demo "Pakkumiste arv": fixed 30-day daily counts, zero-filled. */
export function dailyBidTrend(
  bids: readonly StatisticsBidSlice[],
  now: number,
): TrendData {
  const dayStart = startOfDayMs(now)
  const counts = new Map<string, number>()
  for (const bid of bids) {
    const time = parseTime(bid.createdAt)
    if (time === null || time < dayStart - (TREND_DAYS - 1) * DAY_MS) continue
    const key = localDayKey(time)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const labels: string[] = []
  const values: number[] = []
  for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
    const dayMs = dayStart - i * DAY_MS
    const date = new Date(dayMs)
    labels.push(`${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}`)
    values.push(counts.get(localDayKey(dayMs)) ?? 0)
  }
  return { labels, values }
}

/** Top sold auctions by overbid percent (demo "ülepakkumise % järgi"). */
export function topAuctions(
  auctions: readonly StatisticsAuctionSlice[],
  now: number,
  period: StatisticsPeriod,
  limit = 5,
): TopAuctionRow[] {
  const from = windowStartMs(now, period)
  return windowAuctions(auctions, now, period)
    .filter((auction) => isSold(auction) && inWindow(auction.completedAt ?? '', from, now))
    .map((auction) => {
      const min = auction.minBidCents
      const final = auction.finalPriceCents ?? 0
      return {
        id: auction.id,
        title: auction.title,
        objectType: auction.objectType,
        minBidCents: min,
        finalPriceCents: final,
        upliftPercent: round1(min > 0 ? ((final - min) / min) * 100 : 0),
      }
    })
    .sort((a, b) =>
      b.upliftPercent === a.upliftPercent
        ? b.finalPriceCents - a.finalPriceCents
        : b.upliftPercent - a.upliftPercent,
    )
    .slice(0, limit)
}

export function countyOverview(
  auctions: readonly StatisticsAuctionSlice[],
  counties: readonly StatisticsCountySlice[],
  now: number,
  period: StatisticsPeriod,
): CountyStatRow[] {
  const names = new Map(counties.map((county) => [county.id, county.name]))
  const grouped = new Map<
    string,
    { total: number; sold: number; finalCents: number }
  >()
  for (const auction of windowAuctions(auctions, now, period)) {
    if (auction.countyId === null) continue
    const row = grouped.get(auction.countyId) ?? { total: 0, sold: 0, finalCents: 0 }
    row.total += 1
    if (isSold(auction)) {
      row.sold += 1
      row.finalCents += auction.finalPriceCents ?? 0
    }
    grouped.set(auction.countyId, row)
  }
  return [...grouped.entries()]
    .map(([countyId, row]) => {
      const avgFinalCents = row.sold > 0 ? Math.round(row.finalCents / row.sold) : null
      return {
        countyId,
        name: names.get(countyId) ?? countyId,
        total: row.total,
        sold: row.sold,
        avgFinalCents,
        avgFinalEur: avgFinalCents === null ? null : centsToEuros(avgFinalCents),
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'et'))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

function csvRow(cells: readonly (string | number)[]): string {
  return cells.map(csvCell).join(';')
}

/** Semicolon-separated CSV of every aggregation, period preserved via `data`. */
export function statisticsToCsv(data: StatisticsData): string {
  const { kpis } = data
  const lines: string[] = [
    csvRow(['Osal;Näitaja;Väärtus']),
    csvRow(['NPK', statisticsKpiLabels.totalAuctions, kpis.totalAuctions]),
    csvRow(['NPK', statisticsKpiLabels.sold, kpis.sold.percent ?? 0]),
    csvRow(['NPK', soldSubline(kpis.sold.count), kpis.sold.count]),
    csvRow(['NPK', statisticsKpiLabels.avgUplift, kpis.avgUplift.percent ?? 0]),
    csvRow(['NPK', statisticsKpiLabels.serviceFee, Math.round(kpis.serviceFee.eur)]),
    csvRow(['NPK', statisticsKpiLabels.bidCount, kpis.bidCount]),
    csvRow([
      'NPK',
      statisticsKpiLabels.avgFinalPrice,
      kpis.avgFinalPrice.eur === null ? '' : Math.round(kpis.avgFinalPrice.eur),
    ]),
    '',
    csvRow(['Kuud;Kuu;Müüdud;Müümata;Tühistatud']),
    ...data.monthly.months.map((month, i) =>
      csvRow([
        'KUU',
        month,
        data.monthly.series[0]?.values[i] ?? 0,
        data.monthly.series[1]?.values[i] ?? 0,
        data.monthly.series[2]?.values[i] ?? 0,
      ]),
    ),
    '',
    csvRow(['Tüüpjaotus;Tüüp;Oksjonid']),
    ...data.donut.map((segment) => csvRow(['TYYP', segment.label, segment.value])),
    '',
    csvRow(['Maakonnad;Maakond;Oksjonid;Müüdud;Keskmine hind (EUR)']),
    ...data.counties.map((county) =>
      csvRow([
        'MK',
        county.name,
        county.total,
        county.sold,
        county.avgFinalEur === null ? '' : Math.round(county.avgFinalEur),
      ]),
    ),
  ]
  return `${lines.join('\r\n')}\r\n`
}

/**
 * One fetcher for the Statistika page. The caller must have authenticated
 * through requireAdminRepositories and hold `statistics:read`; reads run as
 * system context because aggregated views need the full table, not a
 * request-scoped slice. The optional filters narrow the auction slice (and,
 * with any filter active, skip the type-blind snapshot merge so a filtered
 * KPI never mixes in other types' snapshot totals).
 */
export async function getStatisticsData(
  period: StatisticsPeriod,
  filters: StatisticsFilters = NO_STATISTICS_FILTERS,
): Promise<StatisticsData> {
  const repositories: CoreRepositories = await getRepositories()
  const now = Date.now()

  const [auctionDocs, bidDocs, snapshotDocs, countyDocs, contractDocs] = await Promise.all([
    repositories.find({
      collection: 'auctions',
      where: { status: { not_equals: 'draft' } },
      pagination: false,
    }),
    repositories.find({
      collection: 'bids',
      sort: '-createdAt',
      limit: BID_FETCH_LIMIT,
    }),
    repositories.find({ collection: 'statistics-snapshots', pagination: false }),
    repositories.find({ collection: 'counties', pagination: false }),
    repositories.find({
      collection: 'contracts',
      where: { status: { equals: 'voided' } },
      pagination: false,
    }),
  ])

  const auctions = filterStatisticsAuctions(auctionDocs.docs, filters)
  const bids: StatisticsBidSlice[] = bidDocs.docs
  const snapshots: StatisticsSnapshotSlice[] = snapshotDocs.docs
  const counties: StatisticsCountySlice[] = countyDocs.docs
  const voidedContracts: StatisticsContractSlice[] = contractDocs.docs.filter(
    (contract) => contract.status === 'voided',
  )
  const sales = salesByDay(
    statisticsFiltersActive(filters) ? [] : snapshots,
    auctions,
    now,
    period,
  )

  return {
    period,
    filters,
    kpis: buildStatisticsKpis({ now, period, auctions, bids, sales }),
    monthly: monthlyOutcomeBuckets(auctions, voidedContracts, now, period),
    donut: objectTypeDonut(auctions, now, period),
    trend: dailyBidTrend(bids, now),
    topAuctions: topAuctions(auctions, now, period),
    counties: countyOverview(auctions, counties, now, period),
    countyOptions: counties,
  }
}
