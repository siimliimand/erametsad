import { Card } from '@erametsad/ui'
import { ChevronLeft, ChevronRight, FilterX, Info, RotateCcw } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import {
  LISTING_TAB_IDS,
  listingTabDef,
  resolveListingTab,
  type RawSearchParams,
} from '../_components/ListingTabs'
import {
  parseListingFilters,
  type ListingFilterState,
  type ListingSortDirection,
  type ListingSortField,
} from '../_lib/filter-params'
import { formatEstonianInteger, type ListingTabId } from '../_lib/summary'

import {
  archivedStatsByObjectType,
  listArchivedAuctions,
  type ArchivedAuctionTypeStats,
  type AuctionListResult,
  type AuctionSummary,
} from '@/lib/auction/queries'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { AuctionObjectType, AuctionStatus } from '@/lib/data/schema'

export const dynamic = 'force-dynamic'

const ARCHIVE_PAGE_SIZE = 24

const EMPTY_RESULT: AuctionListResult = {
  auctions: [],
  total: 0,
  page: 1,
  limit: ARCHIVE_PAGE_SIZE,
  totalPages: 1,
}

// Demo Tüüp chips (04-ajalugu). Põllumaa has no objectType in the schema
// yet (same gap as the Põllumaad tab), so its selection reduces to an empty
// result set until the data layer adopts the type.
const ARCHIVE_TYPE_OPTIONS = [
  { value: 'raieoigus', label: 'Raieõigus' },
  { value: 'kinnistu', label: 'Kinnistu' },
  { value: 'pollumaa', label: 'Põllumaa' },
  { value: 'pakett', label: 'Pakett' },
] as const

const CHIP_TYPES: readonly AuctionObjectType[] = ['raieoigus', 'kinnistu', 'pakett']

/** Demo type-chip colors: raie green, kinnistu blue, pollumaa amber, rest muted. */
const TYPE_CHIPS: Record<AuctionObjectType, { label: string; className: string }> = {
  raieoigus: { label: 'Raieõigus', className: 'bg-primaryLight text-primaryHover' },
  kinnistu: { label: 'Kinnistu', className: 'bg-infoLight text-info' },
  pakett: { label: 'Pakett', className: 'bg-[#EDEFEA] text-inkMuted' },
  kiire: { label: 'Kiiroksjon', className: 'bg-[#EDEFEA] text-inkMuted' },
}

// Demo Olek chips mapped onto archived statuses: "Lõppenud" lists only lots
// with a published result, "Müümata" the unsold/appraised branch. The
// transient `ended` state renders in the unfiltered view only, where the
// row still shows the Müümata pill (finalPrice null).
const OLEK_OPTIONS = [
  { value: 'loppenud', label: 'Lõppenud' },
  { value: 'muumata', label: 'Müümata' },
] as const

const OLEK_STATUSES: Record<string, readonly AuctionStatus[]> = {
  loppenud: ['contract', 'completed', 'archived'],
  muumata: ['unsold', 'appraised'],
}

/** Demo toolbar sort labels; the single `sort` param encodes desc as `-field`. */
const ARCHIVE_TOOLBAR_SORTS = [
  { value: '-endTime', label: 'Uuemad eespool' },
  { value: 'endTime', label: 'Vanemad eespool' },
  { value: '-endPrice', label: 'Lõpphind kahanevalt' },
  { value: 'endPrice', label: 'Lõpphind kasvavalt' },
] as const

const PRIVACY_NOTE = 'Avalikustame ainult lõpphinda — võitja andmeid ei avaldata.'

function rawPage(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
}

function paramBag(params: RawSearchParams): URLSearchParams {
  const bag = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value])
      bag.append(key, entry)
  }
  return bag
}

function csvValues(params: RawSearchParams, key: string): string[] {
  const values = params[key]
  if (values === undefined) return []
  return (Array.isArray(values) ? values : [values])
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '')
}

function toggleToken(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((token) => token !== value)
    : [...list, value]
}

/** Shareable href: switches tab, tweaks params, resets pagination. */
function archiveHref(
  tab: ListingTabId,
  params: RawSearchParams,
  overrides?: Record<string, string | null>,
  page?: number,
): string {
  const search = paramBag(params)
  search.delete('tab')
  search.delete('page')
  if (overrides !== undefined) {
    for (const [key, value] of Object.entries(overrides)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
  }
  search.set('tab', tab)
  if (page !== undefined && page > 1) search.set('page', String(page))
  const qs = search.toString()
  return qs === '' ? '/ajalugu' : `/ajalugu?${qs}`
}

/**
 * The archive keeps the listing parser but flips the no-param default to
 * the demo "Uuemad eespool" (endTime desc); the listing defaults to
 * lõpuaeg asc.
 */
function archiveFilterState(params: RawSearchParams): ListingFilterState {
  const state = parseListingFilters(paramBag(params))
  if (params.sort === undefined && params.order === undefined) {
    state.sortField = 'endTime'
    state.sortDirection = 'desc'
  }
  return state
}

/** Single-param sort token shared by the toolbar select and hidden inputs. */
function archiveSortToken(
  field: ListingSortField,
  direction: ListingSortDirection,
): string {
  return direction === 'desc' ? `-${field}` : field
}

async function loadTabArchive(
  repos: CoreRepositories,
  tab: ListingTabId,
  page: number,
  params: RawSearchParams,
): Promise<AuctionListResult> {
  const { allTypes, objectTypes: tabTypes } = listingTabDef(tab)
  if (!allTypes && tabTypes.length === 0) return EMPTY_RESULT
  const search = new URLSearchParams()

  // Tüüp chips intersect with the tab's objectTypes; a selection that
  // reduces to nothing (Põllumaa alone, or a chip outside the tab) has no
  // archived rows.
  const typeTokens = csvValues(params, 'type')
  const chipTypes = typeTokens.filter((value): value is AuctionObjectType =>
    (CHIP_TYPES as readonly string[]).includes(value),
  )
  if (typeTokens.length > 0) {
    const effective = allTypes
      ? chipTypes
      : tabTypes.filter((objectType) => chipTypes.includes(objectType))
    if (effective.length === 0) return EMPTY_RESULT
    search.set('objectType', effective.join(','))
  } else if (tabTypes.length > 0) {
    search.set('objectType', tabTypes.join(','))
  }

  const statuses = csvValues(params, 'olek').flatMap(
    (value) => OLEK_STATUSES[value] ?? [],
  )
  if (statuses.length > 0) search.set('auctionStatus', statuses.join(','))

  search.set('limit', String(ARCHIVE_PAGE_SIZE))
  // Legacy URL filters keep working server-side even though the demo
  // sidebar no longer renders county/parish/species/logging-type/price/
  // area editors.
  for (const key of [
    'county',
    'parish',
    'species',
    'loggingType',
    'sort',
    'order',
    'endYear',
  ]) {
    for (const value of csvValues(params, key)) search.append(key, value)
  }
  for (const key of ['areaMin', 'areaMax', 'priceMin', 'priceMax']) {
    const value = params[key]
    if (typeof value === 'string' && value !== '') search.set(key, value)
  }
  // Demo default sort "Uuemad eespool"; the shared server default is
  // lõpphind desc, so the default is passed explicitly.
  if (params.sort === undefined && params.order === undefined) {
    search.set('sort', '-endTime')
  }
  if (page > 1) search.set('page', String(page))
  return listArchivedAuctions(repos, search)
}

/** Stat buckets behind one tab; Kõik sums every objectType bucket. */
function archiveBucketsForTab(
  tab: ListingTabId,
  stats: Record<AuctionObjectType, ArchivedAuctionTypeStats>,
): ArchivedAuctionTypeStats[] {
  const { allTypes, objectTypes } = listingTabDef(tab)
  return allTypes
    ? Object.values(stats)
    : objectTypes.map((objectType) => stats[objectType])
}

function archivedCountForTab(
  tab: ListingTabId,
  stats: Record<AuctionObjectType, ArchivedAuctionTypeStats>,
): number {
  return archiveBucketsForTab(tab, stats).reduce(
    (sum, bucket) => sum + bucket.count,
    0,
  )
}

function endYearsForTab(
  tab: ListingTabId,
  stats: Record<AuctionObjectType, ArchivedAuctionTypeStats>,
): number[] {
  const years = new Set<number>()
  for (const bucket of archiveBucketsForTab(tab, stats)) {
    for (const year of bucket.endYears) years.add(year)
  }
  return [...years].sort((a, b) => b - a)
}

interface ArchiveTabTotals {
  count: number
  areaHa: number
  volumeM3: number
  finalPriceEur: number
}

function archiveTabTotals(
  tab: ListingTabId,
  stats: Record<AuctionObjectType, ArchivedAuctionTypeStats>,
): ArchiveTabTotals {
  return archiveBucketsForTab(tab, stats).reduce<ArchiveTabTotals>(
    (sum, bucket) => ({
      count: sum.count + bucket.count,
      areaHa: sum.areaHa + bucket.areaHa,
      volumeM3: sum.volumeM3 + bucket.volumeM3,
      finalPriceEur: sum.finalPriceEur + bucket.finalPriceEur,
    }),
    { count: 0, areaHa: 0, volumeM3: 0, finalPriceEur: 0 },
  )
}

/**
 * Demo stat formatting (04-ajalugu): a million or more collapses to the
 * "1,54 mln" pattern with the Estonian decimal comma; smaller totals keep
 * the full space-grouped integer.
 */
function formatArchiveStatValue(value: number): string {
  if (value < 1_000_000) return formatEstonianInteger(value)
  const text = (value / 1_000_000)
    .toFixed(2)
    .replace(/\.?0+$/, '')
    .replace('.', ',')
  return `${text} mln`
}

/**
 * Demo page-head summary: all-time archive totals in one sentence plus the
 * privacy line; zero aggregates collapse their clause instead of faking data.
 */
function archiveHeadSummary(totals: ArchiveTabTotals): string {
  if (totals.count <= 0) return `Arhiivis ei ole lõppenud oksjoneid. ${PRIVACY_NOTE}`
  const details = [
    totals.areaHa > 0
      ? `kokku ${formatEstonianInteger(totals.areaHa)} ha`
      : null,
    totals.volumeM3 > 0
      ? `${formatArchiveStatValue(totals.volumeM3)} m³`
      : null,
    totals.finalPriceEur > 0
      ? `${formatArchiveStatValue(totals.finalPriceEur)} € eest`
      : null,
  ].filter((detail): detail is string => detail !== null)
  const lastDetail = details[details.length - 1] ?? ''
  const detailsText =
    details.length <= 1
      ? details.join('')
      : `${details.slice(0, -1).join(', ')} ja ${lastDetail}`
  const sentence =
    detailsText === ''
      ? `Edukalt lõppenud oksjoneid on ${formatEstonianInteger(totals.count)}.`
      : `Edukalt lõppenud oksjoneid on ${formatEstonianInteger(totals.count)}, ${detailsText}.`
  return `${sentence} ${PRIVACY_NOTE}`
}

/**
 * Demo .page-head band (04-ajalugu): full-width mist strip with the H1, the
 * all-time summary and the statistics band. Negative margins cancel the
 * (portal) layout main padding, mirroring ListingPageHead.
 */
function ArchivePageHead({
  summary,
  totals,
}: {
  summary: string
  totals: ArchiveTabTotals
}) {
  return (
    <section
      aria-labelledby="page-title"
      className="-mx-md -mt-lg bg-bgMist px-md pb-[28px] pt-[32px] md:-mx-lg md:px-lg md:pb-[40px] md:pt-[48px]"
    >
      <h1
        id="page-title"
        className="mb-[10px] font-heading text-h1 font-extrabold text-ink"
      >
        Oksjonite ajalugu
      </h1>
      <p className="max-w-[52em] font-body text-body text-inkMuted md:text-[18px]">
        {summary}
      </p>
      <ArchiveStatsBand totals={totals} />
    </section>
  )
}

// All-time archive trust band (D8): every figure is a sum over the archived
// statistics snapshot, never live data; zero sums collapse their card and
// an empty archive hides the whole band.
function ArchiveStatsBand({ totals }: { totals: ArchiveTabTotals }) {
  if (totals.count <= 0) return null
  const cards = [
    {
      label: 'Edukalt lõppenud oksjonit',
      value: formatEstonianInteger(totals.count),
      unit: null,
    },
    ...(totals.areaHa > 0
      ? [
          {
            label: 'Metsa- ja põllumaad kokku',
            value: formatEstonianInteger(totals.areaHa),
            unit: 'ha',
          },
        ]
      : []),
    ...(totals.volumeM3 > 0
      ? [
          {
            label: 'Raiemaht kokku',
            value: formatArchiveStatValue(totals.volumeM3),
            unit: 'm³',
          },
        ]
      : []),
    ...(totals.finalPriceEur > 0
      ? [
          {
            label: 'Kogumaksumus kokku',
            value: formatArchiveStatValue(totals.finalPriceEur),
            unit: '€',
          },
        ]
      : []),
  ]
  return (
    <dl
      role="group"
      aria-label="Statistikalint"
      className="mt-6 grid grid-cols-2 gap-3 md:mt-8 md:grid-cols-4 md:gap-4"
    >
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex flex-col rounded-card border border-border bg-white px-[22px] py-5 shadow-card"
        >
          <dd className="order-1 font-mono text-2xl font-medium leading-[1.2] text-primaryDark md:text-[30px]">
            {card.value}
            {card.unit !== null && (
              <span className="text-base font-medium text-inkMuted">
                {' '}
                {card.unit}
              </span>
            )}
          </dd>
          <dt className="order-2 mt-1.5 font-body text-[13px] font-semibold uppercase tracking-[0.03em] text-inkMuted">
            {card.label}
          </dt>
        </div>
      ))}
    </dl>
  )
}

interface ArchiveTabsProps {
  activeTab: ListingTabId
  counts: Record<ListingTabId, number>
  params: RawSearchParams
}

function ArchiveTabs({ activeTab, counts, params }: ArchiveTabsProps) {
  return (
    // Demo .tabs-wrap: full-width white strip right under the mist page-head
    // band; negative margins cancel the (portal) layout main padding, same
    // pill language as the listing tab bar (ListingTabs).
    <div className="-mx-md border-b border-border bg-white px-md md:-mx-lg md:px-lg">
      <nav
        aria-label="Arhiivi oksjonite tüübid"
        className="flex gap-2 overflow-x-auto py-4"
      >
        {LISTING_TAB_IDS.map((tab) => {
          const isActive = tab === activeTab
          return (
            <Link
              key={tab}
              href={archiveHref(tab, params)}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex flex-none items-center gap-2 rounded-pill border px-4 py-[9px] text-[15px] font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                isActive
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {listingTabDef(tab).label}
              <span
                className={`rounded-pill px-[9px] py-px font-mono text-xs font-medium ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-bgMist text-inkMuted'
                }`}
              >
                {counts[tab]}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

interface ArchiveChipsProps {
  label: string
  labelId: string
  options: readonly { value: string; label: string }[]
  selected: string[]
  buildHref: (value: string) => string
}

// Demo .chip anatomy: white base, primary border+text on hover, primary
// fill when pressed.
function ArchiveChips({
  label,
  labelId,
  options,
  selected,
  buildHref,
}: ArchiveChipsProps) {
  return (
    <div className="flex flex-col gap-xs">
      <span id={labelId} className="font-body text-bodySm font-semibold text-ink">
        {label}
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="flex flex-wrap gap-xs"
      >
        {options.map((option) => {
          const isActive = selected.includes(option.value)
          return (
            <Link
              key={option.value}
              href={buildHref(option.value)}
              aria-pressed={isActive}
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill border px-4 py-2 font-body text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                isActive
                  ? 'border-primary bg-primary text-inkInverse'
                  : 'border-border bg-white text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {option.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

const SELECT_CLASS =
  'w-full min-h-11 rounded-button border border-border bg-white px-3.5 py-2.5 font-body text-body text-ink transition-colors duration-hover ease-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20'

interface ArchiveFiltersProps {
  tab: ListingTabId
  params: RawSearchParams
  sortState: ListingFilterState
  years: number[]
  selectedYear: string
  selectedTypes: string[]
  selectedOlek: string[]
  activeCount: number
}

// Demo .filters card: Lõppemise aasta select, Tüüp chips, Olek chips with
// the hint, and Tühjenda. One GET form keeps the panel server-rendered;
// the selects need the Rakenda submit to apply without client JS.
function ArchiveFilters({
  tab,
  params,
  sortState,
  years,
  selectedYear,
  selectedTypes,
  selectedOlek,
  activeCount,
}: ArchiveFiltersProps) {
  return (
    <Card
      hover={false}
      className="shadow-card"
      content={
        <form method="get" action="/ajalugu" className="flex flex-col gap-md">
          <input type="hidden" name="tab" value={tab} />
          {selectedTypes.length > 0 && (
            <input type="hidden" name="type" value={selectedTypes.join(',')} />
          )}
          {selectedOlek.length > 0 && (
            <input type="hidden" name="olek" value={selectedOlek.join(',')} />
          )}
          <input
            type="hidden"
            name="sort"
            value={archiveSortToken(sortState.sortField, sortState.sortDirection)}
          />

          <div className="flex items-center justify-between">
            <span className="font-heading text-h4 font-semibold text-ink">
              Filtrid
            </span>
            <span className="rounded-pill bg-primaryLight px-[9px] py-px font-mono text-bodySm font-medium text-primaryHover">
              ({activeCount})
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="archiveEndYear"
              className="font-body text-bodySm font-semibold text-ink"
            >
              Lõppemise aasta
            </label>
            <select
              id="archiveEndYear"
              name="endYear"
              defaultValue={selectedYear}
              className={SELECT_CLASS}
            >
              <option value="">Kõik</option>
              {years.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
          </div>

          <ArchiveChips
            label="Tüüp"
            labelId="archiveTypeLabel"
            options={ARCHIVE_TYPE_OPTIONS}
            selected={selectedTypes}
            buildHref={(value) => {
              const next = toggleToken(selectedTypes, value)
              return archiveHref(tab, params, {
                type: next.length > 0 ? next.join(',') : null,
              })
            }}
          />

          <div className="flex flex-col gap-xs">
            <ArchiveChips
              label="Olek"
              labelId="archiveOlekLabel"
              options={OLEK_OPTIONS}
              selected={selectedOlek}
              buildHref={(value) => {
                const next = toggleToken(selectedOlek, value)
                return archiveHref(tab, params, {
                  olek: next.length > 0 ? next.join(',') : null,
                })
              }}
            />
            <p className="font-body text-bodySm text-inkMuted">
              Müümata jäänud oksjonid on arhiivis avalikud.
            </p>
          </div>

          <div className="mt-2 flex flex-col gap-2.5 border-t border-border pt-[18px]">
            <button
              type="submit"
              className="inline-flex w-full items-center justify-center rounded-button bg-primary px-4 py-2.5 font-body text-bodySm font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryDark"
            >
              Rakenda
            </button>
            <Link
              href={`/ajalugu?tab=${tab}`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-button border border-primary bg-white px-4 py-2.5 font-body text-bodySm font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight hover:text-primaryHover"
            >
              <RotateCcw size={15} aria-hidden="true" /> Tühjenda
            </Link>
          </div>
        </form>
      }
    />
  )
}

interface ArchiveToolbarProps {
  tab: ListingTabId
  sortState: ListingFilterState
  selectedYear: string
  selectedTypes: string[]
  selectedOlek: string[]
  total: number
}

// Demo .toolbar: result count (role="status") on the left, Sorteeri select
// pushed right. Hidden inputs carry the other filters; the submit button
// applies the choice without client JS.
function ArchiveToolbar({
  tab,
  sortState,
  selectedYear,
  selectedTypes,
  selectedOlek,
  total,
}: ArchiveToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3.5">
      <p
        role="status"
        className="m-0 self-center font-body text-[15px] font-semibold text-inkMuted"
      >
        {formatEstonianInteger(total)} {total === 1 ? 'oksjon' : 'oksjonit'}
      </p>
      <form
        method="get"
        action="/ajalugu"
        className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto"
      >
        <input type="hidden" name="tab" value={tab} />
        {selectedTypes.length > 0 && (
          <input type="hidden" name="type" value={selectedTypes.join(',')} />
        )}
        {selectedOlek.length > 0 && (
          <input type="hidden" name="olek" value={selectedOlek.join(',')} />
        )}
        {selectedYear !== '' && (
          <input type="hidden" name="endYear" value={selectedYear} />
        )}
        <label
          htmlFor="archiveSort"
          className="whitespace-nowrap font-body text-bodySm font-semibold text-inkMuted"
        >
          Sorteeri
        </label>
        <select
          id="archiveSort"
          name="sort"
          defaultValue={archiveSortToken(
            sortState.sortField,
            sortState.sortDirection,
          )}
          className="min-h-10 rounded-button border border-border bg-white px-3 py-2 font-body text-bodySm font-medium text-ink transition-colors duration-hover ease-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {ARCHIVE_TOOLBAR_SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          aria-label="Rakenda sortimine"
          className="inline-flex h-10 w-10 flex-none items-center justify-center rounded-button bg-primary text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryDark"
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </form>
    </div>
  )
}

function formatAreaHa(area: number): string {
  const [whole, decimal = '0'] = area.toFixed(1).split('.')
  return `${formatEstonianInteger(Number(whole))},${decimal} ha`
}

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString('et-EE')
}

function ArchiveTypeChip({ objectType }: { objectType: AuctionObjectType }) {
  const chip = TYPE_CHIPS[objectType]
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-pill px-[11px] py-0.5 text-xs font-semibold ${chip.className}`}
    >
      {chip.label}
    </span>
  )
}

// Demo pill-muted Müümata pill (dot + label), shown in the Lõpphind column
// of rows without a published result.
function UnsoldPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-[#EDEFEA] px-3 py-[3px] text-[13px] font-semibold text-inkMuted">
      <span className="h-[7px] w-[7px] rounded-full bg-current" aria-hidden="true" />
      Müümata
    </span>
  )
}

const TD_CLASS = 'border-b border-border px-4 py-[13px] align-middle'

function ArchiveRow({ auction }: { auction: AuctionSummary }) {
  const { finalPrice } = auction
  const start = auction.minBid
  const unsold = finalPrice === null
  const uplift =
    finalPrice !== null && start > 0 && finalPrice > start
      ? `+${String(Math.round(((finalPrice - start) / start) * 100))}%`
      : null
  return (
    <tr
      className={
        unsold
          ? 'bg-bgMist text-inkMuted'
          : 'transition-colors duration-hover ease-hover hover:bg-bgMist'
      }
    >
      <td className={TD_CLASS}>
        <Link
          href={`/oksjon/${auction.id}`}
          className={`font-body text-[15px] font-semibold transition-colors duration-hover ease-hover ${
            unsold ? 'text-inkMuted hover:text-primary' : 'text-ink hover:text-primary'
          }`}
        >
          {auction.title}
        </Link>
        <span className="mt-0.5 block font-mono text-xs text-inkMuted">
          #{auction.id}
        </span>
      </td>
      <td className={`${TD_CLASS} whitespace-nowrap`}>
        <ArchiveTypeChip objectType={auction.objectType} />
      </td>
      <td className={`${TD_CLASS} whitespace-nowrap`}>
        {auction.county?.name ?? auction.address ?? 'Eesti'}
      </td>
      <td className={`${TD_CLASS} font-mono whitespace-nowrap`}>
        {auction.area === null ? '—' : formatAreaHa(auction.area)}
      </td>
      <td className={`${TD_CLASS} font-mono whitespace-nowrap`}>
        {auction.endsAt === null ? '—' : formatEndDate(auction.endsAt)}
      </td>
      <td className={`${TD_CLASS} whitespace-nowrap`}>
        {unsold ? (
          <UnsoldPill />
        ) : (
          <span className="font-mono text-[17px] font-medium text-ctaHover">
            {formatEstonianInteger(finalPrice)} €
          </span>
        )}
      </td>
      <td className={`${TD_CLASS} font-mono whitespace-nowrap`}>
        {formatEstonianInteger(start)} €
      </td>
      <td className={`${TD_CLASS} whitespace-nowrap`}>
        {uplift === null ? (
          '—'
        ) : (
          <span className="inline-block rounded-pill bg-[rgba(46,158,91,0.12)] px-2.5 py-px font-mono text-bodySm font-medium text-[#2E9E5B]">
            {uplift}
          </span>
        )}
      </td>
    </tr>
  )
}

function paginationPages(page: number, totalPages: number): (number | '…')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  const window = [page - 1, page, page + 1].filter(
    (value) => value > 1 && value < totalPages,
  )
  const pages: (number | '…')[] = [1, '…']
  let previous = 1
  for (const value of window) {
    if (value - previous > 1) pages.push('…')
    pages.push(value)
    previous = value
  }
  if (totalPages - previous > 1) pages.push('…')
  pages.push(totalPages)
  return pages
}

const PAGE_BTN_CLASS =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-button border border-border px-2.5 font-body text-[15px] font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'
const PAGE_BTN_DISABLED_CLASS =
  'inline-flex h-10 min-w-10 items-center justify-center rounded-button border border-border px-2.5 font-body text-[15px] font-semibold text-inkMuted'

function ArchivePagination({
  tab,
  page,
  totalPages,
  params,
}: {
  tab: ListingTabId
  page: number
  totalPages: number
  params: RawSearchParams
}) {
  if (totalPages <= 1) return null
  return (
    <nav
      aria-label="Leheküljed"
      className="flex flex-wrap items-center justify-center gap-1.5"
    >
      {page > 1 ? (
        <Link
          href={archiveHref(tab, params, undefined, page - 1)}
          aria-label="Eelmine leht"
          className={PAGE_BTN_CLASS}
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={PAGE_BTN_DISABLED_CLASS}>
          <ChevronLeft size={14} />
        </span>
      )}
      {paginationPages(page, totalPages).map((entry, index) =>
        entry === '…' ? (
          <span
            key={`gap-${String(index)}`}
            className="px-0.5 font-body text-bodySm text-inkMuted"
          >
            …
          </span>
        ) : entry === page ? (
          <span
            key={entry}
            aria-current="page"
            className="inline-flex h-10 min-w-10 items-center justify-center rounded-button border border-primary bg-primary px-2.5 font-body text-[15px] font-semibold text-white"
          >
            {entry}
          </span>
        ) : (
          <Link
            key={entry}
            href={archiveHref(tab, params, undefined, entry)}
            className={PAGE_BTN_CLASS}
          >
            {entry}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link
          href={archiveHref(tab, params, undefined, page + 1)}
          aria-label="Järgmine leht"
          className={PAGE_BTN_CLASS}
        >
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-hidden="true" className={PAGE_BTN_DISABLED_CLASS}>
          <ChevronRight size={14} />
        </span>
      )}
    </nav>
  )
}

interface ArchivePageProps {
  searchParams: Promise<RawSearchParams>
}

export async function generateMetadata({
  searchParams,
}: ArchivePageProps): Promise<Metadata> {
  const tab = resolveListingTab((await searchParams).tab)
  return { title: `Ajalugu: ${listingTabDef(tab).label}` }
}

export default async function AjaluguPage({ searchParams }: ArchivePageProps) {
  const params = await searchParams
  const tab = resolveListingTab(params.tab)
  const page = rawPage(params.page)
  const sortState = archiveFilterState(params)
  const selectedYears = csvValues(params, 'endYear')
  const selectedTypes = csvValues(params, 'type')
  const selectedOlek = csvValues(params, 'olek')
  const selectedYear = selectedYears[0] ?? ''

  const repos = await getRepositories()
  const [typeStats, result] = await Promise.all([
    archivedStatsByObjectType(repos),
    loadTabArchive(repos, tab, page, params),
  ])

  const counts = Object.fromEntries(
    LISTING_TAB_IDS.map((id) => [id, archivedCountForTab(id, typeStats)]),
  ) as Record<ListingTabId, number>

  const activeFilterCount =
    (selectedYear !== '' ? 1 : 0) +
    (selectedTypes.length > 0 ? 1 : 0) +
    (selectedOlek.length > 0 ? 1 : 0)

  const yearOptions = endYearsForTab(tab, typeStats)

  const totals = archiveTabTotals('koik', typeStats)

  return (
    <div>
      <ArchivePageHead summary={archiveHeadSummary(totals)} totals={totals} />

      <ArchiveTabs activeTab={tab} counts={counts} params={params} />

      {/* Demo .listing-grid: 280px filter column beside the results flow. */}
      <div className="flex flex-col gap-5 pt-lg lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-8">
        <aside aria-label="Arhiivi filtrid">
          <ArchiveFilters
            tab={tab}
            params={params}
            sortState={sortState}
            years={yearOptions}
            selectedYear={selectedYear}
            selectedTypes={selectedTypes}
            selectedOlek={selectedOlek}
            activeCount={activeFilterCount}
          />
        </aside>

        <div className="flex min-w-0 flex-col gap-5">
          <ArchiveToolbar
            tab={tab}
            sortState={sortState}
            selectedYear={selectedYear}
            selectedTypes={selectedTypes}
            selectedOlek={selectedOlek}
            total={result.total}
          />

          {result.auctions.length === 0 ? (
            <div className="flex flex-col items-center gap-2.5 rounded-card bg-primaryLight px-7 py-12 text-center">
              <FilterX size={32} aria-hidden="true" className="text-primary" />
              <h2 className="mt-1 font-heading text-[22px] font-bold text-ink">
                Filtritele ei vasta ükski lõppenud oksjon
              </h2>
              <p className="max-w-[34em] font-body text-body text-inkMuted">
                Muuda filtreid laiemaks või tühjenda need — kõik lõppenud
                oksjonid jäävad arhiivi alles.
              </p>
              <Link
                href={`/ajalugu?tab=${tab}`}
                className="mt-2.5 inline-flex items-center justify-center rounded-button border border-primary bg-white px-4 py-2.5 font-body text-bodySm font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight hover:text-primaryHover"
              >
                Tühjenda filtrid
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-card border border-border bg-white shadow-card">
              <table
                aria-label="Lõppenud oksjonite tulemused"
                className="w-full min-w-[880px] border-collapse font-body text-[15px]"
              >
                <thead>
                  <tr className="border-b border-border bg-bgMist">
                    {[
                      'Objekt',
                      'Tüüp',
                      'Maakond',
                      'Pindala',
                      'Lõppkuupäev',
                      'Lõpphind',
                      'Alghind',
                      'Ülepakkumine',
                    ].map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="px-4 py-[13px] text-left text-xs font-semibold uppercase tracking-[0.05em] text-inkMuted whitespace-nowrap"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {result.auctions.map((auction) => (
                    <ArchiveRow key={auction.id} auction={auction} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <ArchivePagination
            tab={tab}
            page={result.page}
            totalPages={result.totalPages}
            params={params}
          />

          <p className="flex items-center justify-center gap-2 text-center font-body text-bodySm text-inkMuted">
            <Info size={15} aria-hidden="true" className="flex-none" />
            {PRIVACY_NOTE}
          </p>
        </div>
      </div>
    </div>
  )
}
