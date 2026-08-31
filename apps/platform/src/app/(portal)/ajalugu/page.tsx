import { Card } from '@eametsad/ui'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ArchiveCard } from '../_components/ArchiveCard'
import {
  LISTING_TAB_IDS,
  listingTabDef,
  resolveListingTab,
  type RawSearchParams,
} from '../_components/ListingTabs'
import { parseListingFilters, type ListingFilterState } from '../_lib/filter-params'
import { formatEstonianInteger, type ListingTabId } from '../_lib/summary'

import {
  ARCHIVE_SORT_OPTIONS,
  archivedStatsByObjectType,
  listArchivedAuctions,
  type ArchivedAuctionTypeStats,
  type AuctionListResult,
} from '@/lib/auction/queries'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { AuctionObjectType } from '@/lib/data/schema'

export const dynamic = 'force-dynamic'

const ARCHIVE_PAGE_SIZE = 24

const EMPTY_RESULT: AuctionListResult = {
  auctions: [],
  total: 0,
  page: 1,
  limit: ARCHIVE_PAGE_SIZE,
  totalPages: 1,
}

// Genitive plural forms for "lõppenud {…} oksjonit"; Kõik uses '' so the
// sentence drops the qualifier entirely ("lõppenud oksjonit").
const ARCHIVE_TAB_GENITIVE: Record<ListingTabId, string> = {
  koik: '',
  raieoigused: 'raieõiguste',
  metskinnistud: 'metskinnistute',
  polumaad: 'põllumaade',
  paketid: 'kinnistute pakettide',
  kiiroksjonid: 'kiiroksjonide',
}

// Mirrors the ListingFilters option tables; this panel is server-rendered
// so the client component's lists cannot be imported.
const SPECIES_OPTIONS = [
  { value: 'ma', label: 'Mänd (MA)' },
  { value: 'ku', label: 'Kuusk (KU)' },
  { value: 'ks', label: 'Kask (KS)' },
  { value: 'ha', label: 'Haab (HA)' },
  { value: 'sa', label: 'Sanglepp (SA)' },
  { value: 'ta', label: 'Tamm (TA)' },
] as const

const LOGGING_TYPE_OPTIONS = [
  { value: 'u', label: 'Uuendusraie (U)' },
  { value: 'h', label: 'Hooldusraie (H)' },
  { value: 't', label: 'Taastusraie (T)' },
  { value: 'l', label: 'Langu- ja kahjustuspuude raie (L)' },
  { value: 'r', label: 'Sanitaarraie (R)' },
] as const

function rawPage(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
}

function paramBag(params: RawSearchParams): URLSearchParams {
  const bag = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) bag.append(key, entry)
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
  return list.includes(value) ? list.filter((token) => token !== value) : [...list, value]
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

function archiveFilterState(params: RawSearchParams): ListingFilterState {
  const state = parseListingFilters(paramBag(params))
  // The shared parser defaults to the live listing's lõpuaeg asc; the
  // archive defaults to lõpphind desc until the URL carries a sort.
  if (params.sort === undefined && params.order === undefined) {
    state.sortField = 'endPrice'
    state.sortDirection = 'desc'
  }
  return state
}

async function loadTabArchive(
  repos: CoreRepositories,
  tab: ListingTabId,
  page: number,
  params: RawSearchParams,
): Promise<AuctionListResult> {
  const { allTypes, objectTypes } = listingTabDef(tab)
  if (!allTypes && objectTypes.length === 0) return EMPTY_RESULT
  const search = new URLSearchParams()
  if (objectTypes.length > 0) search.set('objectType', objectTypes.join(','))
  search.set('limit', String(ARCHIVE_PAGE_SIZE))
  for (const key of ['county', 'parish', 'species', 'loggingType', 'sort', 'order', 'endYear']) {
    for (const value of csvValues(params, key)) search.append(key, value)
  }
  for (const key of ['areaMin', 'areaMax', 'priceMin', 'priceMax']) {
    const value = params[key]
    if (typeof value === 'string' && value !== '') search.set(key, value)
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
  return allTypes ? Object.values(stats) : objectTypes.map((objectType) => stats[objectType])
}

function archivedCountForTab(
  tab: ListingTabId,
  stats: Record<AuctionObjectType, ArchivedAuctionTypeStats>,
): number {
  return archiveBucketsForTab(tab, stats).reduce((sum, bucket) => sum + bucket.count, 0)
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

function archiveSummarySentence(tab: ListingTabId, total: number): string {
  const genitive = ARCHIVE_TAB_GENITIVE[tab]
  const qualifier = genitive === '' ? '' : `${genitive} `
  if (total <= 0) {
    return `Arhiivis ei ole lõppenud ${qualifier}oksjoneid.`
  }
  return `Arhiivis on ${formatEstonianInteger(total)} lõppenud ${qualifier}oksjonit.`
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

// All-time per-tab totals (trust signal, filter-independent). The band
// hides entirely for an empty tab and zero sums collapse away.
function ArchiveStatsBand({
  tab,
  stats,
}: {
  tab: ListingTabId
  stats: Record<AuctionObjectType, ArchivedAuctionTypeStats>
}) {
  const totals = archiveTabTotals(tab, stats)
  if (totals.count <= 0) return null
  const metrics = [
    { label: 'Lõppenud oksjonit', value: formatEstonianInteger(totals.count) },
    { label: 'Pindala kokku (ha)', value: formatEstonianInteger(totals.areaHa) },
    ...(tab === 'raieoigused' && totals.volumeM3 > 0
      ? [{ label: 'Raiemahu kokku (m³)', value: formatEstonianInteger(totals.volumeM3) }]
      : []),
    ...(totals.finalPriceEur > 0
      ? [{ label: 'Kogumaksumus (€)', value: formatEstonianInteger(totals.finalPriceEur) }]
      : []),
  ]
  return (
    <dl className="grid gap-sm rounded-card border border-border bg-white p-md sm:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="flex flex-col gap-xs">
          <dt className="font-body text-bodySm text-inkMuted">{metric.label}</dt>
          <dd className="font-mono text-h4 font-bold text-primaryDark">{metric.value}</dd>
        </div>
      ))}
    </dl>
  )
}

// Mirrors countActiveFilters in _lib/filter-params, but relative to the
// archive's lõpphind desc default and counting the endYear chips too.
function countArchiveFilters(
  tab: ListingTabId,
  state: ListingFilterState,
  selectedYears: string[],
): number {
  let count = 0
  if (state.county.length > 0) count += 1
  if (state.parish.length > 0) count += 1
  if (state.areaMin !== undefined || state.areaMax !== undefined) count += 1
  if (state.priceMin !== undefined || state.priceMax !== undefined) count += 1
  if (selectedYears.length > 0) count += 1
  if (tab === 'raieoigused') {
    if (state.species.length > 0) count += 1
    if (state.loggingTypes.length > 0) count += 1
  }
  if (state.sortField !== 'endPrice' || state.sortDirection !== 'desc') count += 1
  return count
}

interface ArchiveTabsProps {
  activeTab: ListingTabId
  counts: Record<ListingTabId, number>
  params: RawSearchParams
}

function ArchiveTabs({ activeTab, counts, params }: ArchiveTabsProps) {
  return (
    <nav aria-label="Arhiivi oksjonite tüübid" className="overflow-x-auto border-b border-border">
      <ul className="flex min-w-max">
        {LISTING_TAB_IDS.map((tab) => {
          const isActive = tab === activeTab
          return (
            <li key={tab}>
              <Link
                href={archiveHref(tab, params)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-4 py-3 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                  isActive
                    ? 'border-b-2 border-primary text-primary'
                    : 'border-b-2 border-transparent text-inkMuted hover:border-primary hover:text-primary'
                }`}
              >
                {listingTabDef(tab).label}
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primaryLight px-1.5 text-[11px] font-semibold text-primaryDark">
                  {counts[tab]}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

interface CountyOption {
  id: string
  name: string
}

interface ParishOption {
  id: string
  name: string
  countyId: string
}

interface ArchiveRangeFormProps {
  tab: ListingTabId
  params: RawSearchParams
  state: ListingFilterState
  counties: CountyOption[]
  parishes: ParishOption[]
}

// GET form keeps the panel server-rendered; the submit round-trips the
// whole query string through the URL, same as the chip links around it.
function ArchiveRangeForm({ tab, params, state, counties, parishes }: ArchiveRangeFormProps) {
  const selectedYears = csvValues(params, 'endYear')
  const selectedCounty = counties.find((county) => county.name === state.county[0]) ?? null
  const scopedParishes =
    selectedCounty === null
      ? parishes
      : parishes.filter((parish) => parish.countyId === selectedCounty.id)
  return (
    <form method="get" action="/ajalugu" className="flex flex-col gap-md">
      <input type="hidden" name="tab" value={tab} />
      {selectedYears.length > 0 && (
        <input type="hidden" name="endYear" value={selectedYears.join(',')} />
      )}
      {state.species.length > 0 && (
        <input type="hidden" name="species" value={state.species.join(',')} />
      )}
      {state.loggingTypes.length > 0 && (
        <input type="hidden" name="loggingType" value={state.loggingTypes.join(',')} />
      )}
      <input type="hidden" name="sort" value={state.sortField} />
      <input type="hidden" name="order" value={state.sortDirection} />

      <div className="grid gap-sm sm:grid-cols-2">
        <label className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">Maakond</span>
          <select
            name="county"
            defaultValue={state.county[0] ?? ''}
            className="rounded-button border border-border bg-white px-3 py-2 font-body text-body text-ink"
          >
            <option value="">Kõik maakonnad</option>
            {counties.map((county) => (
              <option key={county.id} value={county.name}>
                {county.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">Vald</span>
          <select
            name="parish"
            defaultValue={state.parish[0] ?? ''}
            className="rounded-button border border-border bg-white px-3 py-2 font-body text-body text-ink"
          >
            <option value="">Kõik vallad</option>
            {scopedParishes.map((parish) => (
              <option key={parish.id} value={parish.name}>
                {parish.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">
            Lõpphind alates (€)
          </span>
          <input
            type="number"
            name="priceMin"
            min={0}
            step={1}
            defaultValue={state.priceMin}
            className="rounded-button border border-border bg-white px-3 py-2 font-mono text-body text-ink"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">
            Lõpphind kuni (€)
          </span>
          <input
            type="number"
            name="priceMax"
            min={0}
            step={1}
            defaultValue={state.priceMax}
            className="rounded-button border border-border bg-white px-3 py-2 font-mono text-body text-ink"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">
            Pindala alates (ha)
          </span>
          <input
            type="number"
            name="areaMin"
            min={0}
            step={1}
            defaultValue={state.areaMin}
            className="rounded-button border border-border bg-white px-3 py-2 font-mono text-body text-ink"
          />
        </label>
        <label className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">
            Pindala kuni (ha)
          </span>
          <input
            type="number"
            name="areaMax"
            min={0}
            step={1}
            defaultValue={state.areaMax}
            className="rounded-button border border-border bg-white px-3 py-2 font-mono text-body text-ink"
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-xs">
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-button bg-primary px-4 py-2 font-body text-bodySm font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryDark"
        >
          Rakenda filtrid
        </button>
      </div>
    </form>
  )
}

interface ArchiveChipsProps {
  label: string
  options: readonly { value: string; label: string }[]
  selected: string[]
  buildHref: (value: string) => string
}

function ArchiveChips({ label, options, selected, buildHref }: ArchiveChipsProps) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-body text-bodySm font-semibold text-primary">{label}</span>
      <div className="flex flex-wrap gap-xs">
        {options.map((option) => {
          const isActive = selected.includes(option.value)
          return (
            <Link
              key={option.value}
              href={buildHref(option.value)}
              className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 font-body text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                isActive
                  ? 'bg-primary text-inkInverse'
                  : 'border border-border bg-bgMist text-ink hover:bg-primaryLight'
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

function ArchiveSort({ tab, params, state }: {
  tab: ListingTabId
  params: RawSearchParams
  state: ListingFilterState
}) {
  return (
    <ArchiveChips
      label="Sorteeri"
      options={ARCHIVE_SORT_OPTIONS.map((option) => ({
        value: `${option.field}:${option.direction}`,
        label: option.label,
      }))}
      selected={[`${state.sortField}:${state.sortDirection}`]}
      buildHref={(value) => {
        const [field, direction] = value.split(':')
        return archiveHref(tab, params, { sort: field ?? 'endPrice', order: direction ?? 'desc' })
      }}
    />
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

function ArchivePagination({ tab, page, totalPages, params }: {
  tab: ListingTabId
  page: number
  totalPages: number
  params: RawSearchParams
}) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Lehitsemine" className="flex flex-wrap items-center justify-center gap-xs">
      {paginationPages(page, totalPages).map((entry, index) =>
        entry === '…' ? (
          <span key={`gap-${String(index)}`} className="px-2 font-body text-bodySm text-inkMuted">
            …
          </span>
        ) : entry === page ? (
          <span
            key={entry}
            aria-current="page"
            className="flex h-9 min-w-9 items-center justify-center rounded-button bg-primary px-2 font-mono text-bodySm font-semibold text-white"
          >
            {entry}
          </span>
        ) : (
          <Link
            key={entry}
            href={archiveHref(tab, params, undefined, entry)}
            className="flex h-9 min-w-9 items-center justify-center rounded-button border border-border px-2 font-mono text-bodySm font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
          >
            {entry}
          </Link>
        ),
      )}
    </nav>
  )
}

interface ArchivePageProps {
  searchParams: Promise<RawSearchParams>
}

export async function generateMetadata({ searchParams }: ArchivePageProps): Promise<Metadata> {
  const tab = resolveListingTab((await searchParams).tab)
  return { title: `Ajalugu: ${listingTabDef(tab).label}` }
}

export default async function AjaluguPage({ searchParams }: ArchivePageProps) {
  const params = await searchParams
  const tab = resolveListingTab(params.tab)
  const page = rawPage(params.page)
  const state = archiveFilterState(params)
  const selectedYears = csvValues(params, 'endYear')
  const isForestTab = tab === 'raieoigused'

  const repos = await getRepositories()
  const [typeStats, countiesResult, parishesResult, result] = await Promise.all([
    archivedStatsByObjectType(repos),
    repos.find({ collection: 'counties', pagination: false }),
    repos.find({ collection: 'parishes', pagination: false }),
    loadTabArchive(repos, tab, page, params),
  ])
  const counties: CountyOption[] = countiesResult.docs.map((county) => ({
    id: county.id,
    name: county.name,
  }))
  const parishes: ParishOption[] = parishesResult.docs.map((parish) => ({
    id: parish.id,
    name: parish.name,
    countyId: parish.countyId,
  }))

  const counts = Object.fromEntries(
    LISTING_TAB_IDS.map((id) => [id, archivedCountForTab(id, typeStats)]),
  ) as Record<ListingTabId, number>

  const activeFilterCount = countArchiveFilters(tab, state, selectedYears)

  const yearOptions = endYearsForTab(tab, typeStats).map((year) => ({
    value: String(year),
    label: String(year),
  }))

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-heading text-h2 text-ink">Oksjonite ajalugu</h1>

      <ArchiveTabs activeTab={tab} counts={counts} params={params} />

      <ArchiveStatsBand tab={tab} stats={typeStats} />

      <p className="font-body text-body text-inkMuted">{archiveSummarySentence(tab, result.total)}</p>

      <Card
        hover={false}
        content={
          <div className="flex flex-col gap-md">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-xs font-heading text-h4 font-semibold text-ink">
                Filtrid
                {activeFilterCount > 0 && (
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary px-1.5 font-mono text-[11px] font-bold text-inkInverse">
                    {activeFilterCount}
                  </span>
                )}
              </span>
              {activeFilterCount > 0 && (
                <Link
                  href={`/ajalugu?tab=${tab}`}
                  className="font-body text-bodySm font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryDark"
                >
                  Tühjenda
                </Link>
              )}
            </div>
            <ArchiveRangeForm
              tab={tab}
              params={params}
              state={state}
              counties={counties}
              parishes={parishes}
            />
            {yearOptions.length > 0 && (
              <ArchiveChips
                label="Lõpuaasta"
                options={yearOptions}
                selected={selectedYears}
                buildHref={(value) => {
                  const next = toggleToken(selectedYears, value)
                  return archiveHref(tab, params, {
                    endYear: next.length > 0 ? next.join(',') : null,
                  })
                }}
              />
            )}
            {isForestTab && (
              <>
                <ArchiveChips
                  label="Puuliik"
                  options={SPECIES_OPTIONS}
                  selected={state.species}
                  buildHref={(value) => {
                    const next = toggleToken(state.species, value)
                    return archiveHref(tab, params, {
                      species: next.length > 0 ? next.join(',') : null,
                    })
                  }}
                />
                <ArchiveChips
                  label="Raieliik"
                  options={LOGGING_TYPE_OPTIONS}
                  selected={state.loggingTypes}
                  buildHref={(value) => {
                    const next = toggleToken(state.loggingTypes, value)
                    return archiveHref(tab, params, {
                      loggingType: next.length > 0 ? next.join(',') : null,
                    })
                  }}
                />
              </>
            )}
            <ArchiveSort tab={tab} params={params} state={state} />
          </div>
        }
      />

      {result.auctions.length === 0 ? (
        <div className="rounded-card border border-border bg-white p-lg text-center">
          <p className="font-body text-body text-inkMuted">
            Arhiivis ei ole valitud filtritele vastavaid lõppenud oksjoneid.
          </p>
        </div>
      ) : (
        <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.auctions.map((auction) => (
            <ArchiveCard
              key={auction.id}
              title={auction.title}
              href={`/oksjon/${auction.id}`}
              image={auction.image === null ? undefined : { src: auction.image, alt: auction.title }}
              finalPrice={auction.finalPrice}
              endYear={auction.endYear}
              endedAt={auction.endsAt}
              county={auction.county?.name ?? auction.address ?? 'Eesti'}
              area={auction.area}
            />
          ))}
        </div>
      )}

      <ArchivePagination tab={tab} page={result.page} totalPages={result.totalPages} params={params} />

      <p className="text-center font-body text-bodySm text-inkMuted">
        Avalikustatakse ainult lõpphinnad; pakkujate andmeid ei avaldata.
      </p>
    </div>
  )
}
