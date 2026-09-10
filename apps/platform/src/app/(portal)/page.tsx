import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { ListingFilters } from './_components/ListingFilters'
import { ListingMap } from './_components/ListingMap'
import { ListingResultsBar, isMapView } from './_components/ListingResultsBar'
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
  for (const key of ['county', 'parish', 'species', 'loggingType', 'sort', 'order', 'q']) {
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

/**
 * Demo .page-head band: full-width mist strip holding the active tab's H1 and
 * summary. Negative margins cancel the (portal) layout main padding
 * (px-md py-lg md:px-lg) so the band runs edge to edge at container widths.
 */
function ListingPageHead({ heading, summary }: { heading: string; summary: string }) {
  return (
    <section
      aria-labelledby="page-title"
      className="-mx-md -mt-lg bg-bgMist px-md pb-[28px] pt-[32px] md:-mx-lg md:px-lg md:pb-[40px] md:pt-[48px]"
    >
      <h1 id="page-title" className="mb-[10px] font-heading text-h1 font-extrabold text-ink">
        {heading}
      </h1>
      <p className="max-w-[52em] font-body text-body text-inkMuted md:text-[18px]">{summary}</p>
    </section>
  )
}

const PAGE_LINK_CLASS =
  'flex h-10 min-w-10 items-center justify-center rounded-button border border-border bg-white px-2.5 font-body text-[15px] font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary motion-reduce:transition-none'

/**
 * Demo .pagination: centered 40px square buttons with 6px gaps, chevron
 * prev/next, current page highlighted. Links stay shareable via buildListingHref.
 */
function ListingPagination({ tab, page, totalPages, params }: ListingPaginationProps) {
  if (totalPages <= 1) return null
  return (
    <nav aria-label="Leheküljed" className="mt-2 flex items-center justify-center gap-[6px]">
      {page > 1 ? (
        <Link href={buildListingHref(tab, params, page - 1)} aria-label="Eelmine leht" className={PAGE_LINK_CLASS}>
          <ChevronLeft size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${PAGE_LINK_CLASS} text-inkMuted`}>
          <ChevronLeft size={14} aria-hidden="true" />
        </span>
      )}
      {paginationPages(page, totalPages).map((entry, index) =>
        entry === '…' ? (
          <span
            key={`gap-${String(index)}`}
            className="px-0.5 font-body text-[15px] text-inkMuted"
          >
            …
          </span>
        ) : entry === page ? (
          <span
            key={entry}
            aria-current="page"
            className="flex h-10 min-w-10 items-center justify-center rounded-button border border-primary bg-primary px-2.5 font-body text-[15px] font-semibold text-inkInverse"
          >
            {entry}
          </span>
        ) : (
          <Link key={entry} href={buildListingHref(tab, params, entry)} className={PAGE_LINK_CLASS}>
            {entry}
          </Link>
        ),
      )}
      {page < totalPages ? (
        <Link href={buildListingHref(tab, params, page + 1)} aria-label="Järgmine leht" className={PAGE_LINK_CLASS}>
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      ) : (
        <span aria-disabled="true" className={`${PAGE_LINK_CLASS} text-inkMuted`}>
          <ChevronRight size={14} aria-hidden="true" />
        </span>
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
  const page = rawPage(params.page)

  const repos = await getRepositories()
  const tabDef = listingTabDef(tab)
  const listingQuery = buildTabQuery(tab, page, params)
  const hasTypes = tabDef.allTypes ?? tabDef.objectTypes.length > 0

  // Legacy ?view=kart links land here too: isMapView accepts them (D3).
  const mapView = isMapView(params.view)
  const [typeStats, result, mapPoints] = await Promise.all([
    activeStatsByObjectType(repos),
    hasTypes ? listAuctions(repos, listingQuery) : Promise.resolve(EMPTY_RESULT),
    hasTypes
      ? listAuctionMapPoints(repos, listingQuery)
      : Promise.resolve([] as AuctionSummary[]),
  ])

  const counts = Object.fromEntries(
    LISTING_TAB_IDS.map((id) => [id, statsForTab(id, typeStats).count]),
  ) as Record<ListingTabId, number>

  const summary = buildActiveSummary(tab, statsForTab(tab, typeStats))

  return (
    <AuctionStreamProvider>
      <ListingPageHead heading={tabDef.heading} summary={summary} />

      <ListingTabs activeTab={tab} counts={counts} params={params} />

      <div className="grid grid-cols-12 gap-lg pt-lg">
        <ListingResultsBar
          tab={tab}
          total={result.total}
          mapView={mapView}
          filtersSlot={<ListingFilters tab={tab} />}
          mapSlot={<ListingMap lots={mapPoints} />}
        >
          {result.auctions.length === 0 ? (
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

          <ListingPagination tab={tab} page={result.page} totalPages={result.totalPages} params={params} />
        </ListingResultsBar>
      </div>
    </AuctionStreamProvider>
  )
}
