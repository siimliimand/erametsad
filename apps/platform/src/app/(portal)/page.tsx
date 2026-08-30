import type { Metadata } from 'next'
import Link from 'next/link'

import { ListingFilters } from './_components/ListingFilters'
import { ListingMap } from './_components/ListingMap'
import {
  LISTING_TAB_IDS,
  ListingTabs,
  buildListingHref,
  listingTabDef,
  resolveListingTab,
  type RawSearchParams,
} from './_components/ListingTabs'
import { LiveListing } from './_components/LiveListing'
import {
  buildActiveSummary,
  sumStats,
  type ActiveListingStats,
  type ListingTabId,
} from './_lib/summary'
import { AuctionStreamProvider } from './_lib/use-auction-stream'

import {
  DEFAULT_AUCTION_LIST_LIMIT,
  activeStatsByObjectType,
  listAuctionMapPoints,
  listAuctions,
  type AuctionListResult,
  type AuctionSummary,
} from '@/lib/auction/queries'
import { getRepositories } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

const EMPTY_RESULT: AuctionListResult = {
  auctions: [],
  total: 0,
  page: 1,
  limit: DEFAULT_AUCTION_LIST_LIMIT,
  totalPages: 1,
}

// ?view=kart shows the map; every other value (and absence) is the list.
type ListingView = 'list' | 'kart'

function resolveListingView(raw: string | string[] | undefined): ListingView {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value === 'kart' ? 'kart' : 'list'
}

function rawPage(raw: string | string[] | undefined): number {
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(value) && value >= 1 ? Math.floor(value) : 1
}

function statsForTab(tab: ListingTabId, stats: Awaited<ReturnType<typeof activeStatsByObjectType>>): ActiveListingStats {
  const tabDef = listingTabDef(tab)
  return sumStats(tabDef.allTypes ? 'all' : tabDef.objectTypes, stats)
}

/** Tab objectTypes + active filters; shared by listAuctions, the map query and LiveListing. */
function buildTabQuery(
  tab: ListingTabId,
  page: number,
  params: RawSearchParams,
): URLSearchParams {
  const { objectTypes } = listingTabDef(tab)
  const search = new URLSearchParams()
  if (objectTypes.length > 0) {
    search.set('objectType', objectTypes.join(','))
  }
  search.set('auctionStatus', 'active')
  for (const key of ['county', 'parish', 'species', 'loggingType', 'sort', 'order']) {
    const value = params[key]
    if (value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) search.append(key, entry)
  }
  for (const key of ['areaMin', 'areaMax', 'volumeMin', 'volumeMax', 'priceMin', 'priceMax']) {
    const value = params[key]
    if (typeof value === 'string' && value !== '') search.set(key, value)
  }
  if (page > 1) search.set('page', String(page))
  return search
}

/** View-toggle href: keeps tab and filters, resets pagination, encodes the view. */
function buildViewHref(
  tab: ListingTabId,
  params: RawSearchParams,
  view: ListingView,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'tab' || key === 'page' || key === 'view' || value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) search.append(key, entry)
  }
  search.set('tab', tab)
  if (view === 'kart') search.set('view', 'kart')
  const qs = search.toString()
  return qs === '' ? '/' : `/?${qs}`
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

interface ListingPaginationProps {
  tab: ListingTabId
  page: number
  totalPages: number
  params: RawSearchParams
}

function ListingPagination({ tab, page, totalPages, params }: ListingPaginationProps) {
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
            href={buildListingHref(tab, params, entry)}
            className="flex h-9 min-w-9 items-center justify-center rounded-button border border-border px-2 font-mono text-bodySm font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
          >
            {entry}
          </Link>
        ),
      )}
    </nav>
  )
}

interface PortalListingPageProps {
  searchParams: Promise<RawSearchParams>
}

export async function generateMetadata({
  searchParams,
}: PortalListingPageProps): Promise<Metadata> {
  const tab = resolveListingTab((await searchParams).tab)
  return { title: listingTabDef(tab).heading }
}

export default async function PortalListingPage({ searchParams }: PortalListingPageProps) {
  const params = await searchParams
  const tab = resolveListingTab(params.tab)
  const view = resolveListingView(params.view)
  const page = rawPage(params.page)

  const repos = await getRepositories()
  const tabDef = listingTabDef(tab)
  const listingQuery = buildTabQuery(tab, page, params)
  const hasTypes = tabDef.allTypes || tabDef.objectTypes.length > 0

  const [typeStats, result, mapPoints] = await Promise.all([
    activeStatsByObjectType(repos),
    view === 'list' && hasTypes
      ? listAuctions(repos, listingQuery)
      : Promise.resolve(EMPTY_RESULT),
    view === 'kart' && hasTypes
      ? listAuctionMapPoints(repos, listingQuery)
      : Promise.resolve([] as AuctionSummary[]),
  ])

  const counts = Object.fromEntries(
    LISTING_TAB_IDS.map((id) => [id, statsForTab(id, typeStats).count]),
  ) as Record<ListingTabId, number>

  const summary = buildActiveSummary(tab, statsForTab(tab, typeStats))

  const viewToggleClass = (active: boolean): string =>
    `flex items-center gap-2xs rounded-button px-sm py-2xs text-label font-semibold transition-colors duration-hover ease-hover ${
      active
        ? 'bg-primary text-white'
        : 'border border-border text-ink hover:border-primary hover:text-primary'
    }`

  return (
    <AuctionStreamProvider>
      <div className="flex flex-col gap-lg">
        <h1 className="font-heading text-h2 text-ink">{tabDef.heading}</h1>

        <ListingTabs activeTab={tab} counts={counts} params={params} />

        <p className="font-body text-body text-inkMuted">{summary}</p>

        <ListingFilters tab={tab} />

        <div role="group" aria-label="Vaate valik" className="flex gap-2xs">
          <Link
            href={buildViewHref(tab, params, 'list')}
            aria-current={view === 'list' ? 'true' : undefined}
            className={viewToggleClass(view === 'list')}
          >
            Loendivaade
          </Link>
          <Link
            href={buildViewHref(tab, params, 'kart')}
            aria-current={view === 'kart' ? 'true' : undefined}
            className={viewToggleClass(view === 'kart')}
          >
            Kaardivaade
          </Link>
        </div>

        {view === 'kart' ? (
          <ListingMap lots={mapPoints} />
        ) : result.auctions.length === 0 ? (
          <div className="rounded-card border border-border bg-white p-lg text-center">
            <p className="font-body text-body text-inkMuted">
              {tabDef.allTypes
                ? 'Hetkel ei ole käimasolevaid oksjoneid. Telli teavitus, et uutest oksjonidest teada saada.'
                : `Hetkel ei ole käimasolevaid ${tabDef.label.toLowerCase()} oksjoneid. Telli teavitus, et uutest oksjonidest teada saada.`}
            </p>
          </div>
        ) : (
          <LiveListing lots={result.auctions} query={listingQuery.toString()} />
        )}

        {view === 'list' && (
          <ListingPagination tab={tab} page={result.page} totalPages={result.totalPages} params={params} />
        )}
      </div>
    </AuctionStreamProvider>
  )
}
