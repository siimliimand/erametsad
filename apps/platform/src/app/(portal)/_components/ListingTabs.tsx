import Link from 'next/link'

import type { ListingTabId } from '../_lib/summary'

import type { AuctionObjectType } from '@/lib/data/schema'

export interface ListingTabDef {
  id: ListingTabId
  label: string
  heading: string
  /** Kõik tab only: totals and queries cover every objectType bucket. */
  allTypes?: boolean
  /** objectType filters backing the tab; Põllumaad stays empty until wired. */
  objectTypes: readonly AuctionObjectType[]
}

// The Põllumaad tab keeps empty objectTypes so it renders its empty state:
// the 'pollumaa' schema value exists now, but the tab query itself is wired
// later (task 3.1). Only Kõik is all-types, via its explicit flag.
// Kiiroksjonid maps to objectType 'kiire'; the design doc's isQuickAuction
// union is a later refinement once the parser exposes the flag.
export const DEFAULT_LISTING_TAB_DEF: ListingTabDef = {
  id: 'koik',
  label: 'Kõik objektid',
  heading: 'Aktiivsed oksjonid',
  allTypes: true,
  objectTypes: [],
}

export const LISTING_TABS: readonly ListingTabDef[] = [
  DEFAULT_LISTING_TAB_DEF,
  { id: 'raieoigused', label: 'Raieõigused', heading: 'Raieõiguste oksjonid', objectTypes: ['raieoigus'] },
  { id: 'metskinnistud', label: 'Metskinnistud', heading: 'Metskinnistute oksjonid', objectTypes: ['kinnistu'] },
  { id: 'polumaad', label: 'Põllumaad', heading: 'Põllumaade oksjonid', objectTypes: [] },
  { id: 'paketid', label: 'Paketid', heading: 'Kinnistute paketid', objectTypes: ['pakett'] },
  { id: 'kiiroksjonid', label: 'Kiiroksjonid', heading: 'Kiiroksjonid', objectTypes: ['kiire'] },
]

export const DEFAULT_LISTING_TAB: ListingTabId = DEFAULT_LISTING_TAB_DEF.id

export const LISTING_TAB_IDS = LISTING_TABS.map((tab) => tab.id)

export type RawSearchParams = Record<string, string | string[] | undefined>

export function resolveListingTab(raw: string | string[] | undefined): ListingTabId {
  const value = Array.isArray(raw) ? raw[0] : raw
  const found = LISTING_TABS.find((tab) => tab.id === value)
  return found ? found.id : DEFAULT_LISTING_TAB
}

export function listingTabDef(tab: ListingTabId): ListingTabDef {
  return LISTING_TABS.find((entry) => entry.id === tab) ?? DEFAULT_LISTING_TAB_DEF
}

/** Shareable href: switches tab, keeps filter params, resets pagination. */
export function buildListingHref(
  tab: ListingTabId,
  params: RawSearchParams,
  page?: number,
): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (key === 'tab' || key === 'page' || value === undefined) continue
    for (const entry of Array.isArray(value) ? value : [value]) search.append(key, entry)
  }
  search.set('tab', tab)
  if (page !== undefined && page > 1) search.set('page', String(page))
  const qs = search.toString()
  return qs === '' ? '/' : `/?${qs}`
}

interface ListingTabsProps {
  activeTab: ListingTabId
  counts: Record<ListingTabId, number>
  params: RawSearchParams
}

export function ListingTabs({ activeTab, counts, params }: ListingTabsProps) {
  return (
    // Full-width strip under the page-head band: the negative margins cancel
    // the (portal) layout main padding (px-md md:px-lg), mirroring the demo
    // .tabs-wrap that spans the viewport with .container-aligned content.
    <div className="-mx-md border-b border-border bg-white px-md md:-mx-lg md:px-lg">
      <nav aria-label="Oksjonite tüübid" className="flex gap-2 overflow-x-auto py-4">
        {LISTING_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <Link
              key={tab.id}
              href={buildListingHref(tab.id, params)}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex flex-none items-center gap-2 rounded-pill border px-4 py-[9px] text-[15px] font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                isActive
                  ? 'border-primary bg-primary text-white'
                  : 'border-border bg-white text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {tab.label}
              <span
                className={`rounded-pill px-[9px] py-px font-mono text-xs font-medium ${
                  isActive ? 'bg-white/20 text-white' : 'bg-bgMist text-inkMuted'
                }`}
              >
                {counts[tab.id]}
              </span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
