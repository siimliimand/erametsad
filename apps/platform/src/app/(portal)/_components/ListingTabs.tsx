import Link from 'next/link'

import type { ListingTabId } from '../_lib/summary'

import type { AuctionObjectType } from '@/lib/data/schema'

export interface ListingTabDef {
  id: ListingTabId
  label: string
  heading: string
  /** objectType filters backing the tab; empty until the schema supports it. */
  objectTypes: readonly AuctionObjectType[]
}

// The schema's objectType enum has no põllumaa value yet, so that tab is
// backed by no filter and always renders its empty state. Kiiroksjonid maps
// to objectType 'kiire'; the design doc's isQuickAuction union is a later
// refinement once the parser exposes the flag.
export const DEFAULT_LISTING_TAB_DEF: ListingTabDef = {
  id: 'raieoigused',
  label: 'Raieõigused',
  heading: 'Raieõiguste oksjonid',
  objectTypes: ['raieoigus'],
}

export const LISTING_TABS: readonly ListingTabDef[] = [
  DEFAULT_LISTING_TAB_DEF,
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
    <nav aria-label="Oksjonite tüübid" className="overflow-x-auto border-b border-border">
      <ul className="flex min-w-max">
        {LISTING_TABS.map((tab) => {
          const isActive = tab.id === activeTab
          return (
            <li key={tab.id}>
              <Link
                href={buildListingHref(tab.id, params)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-4 py-3 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                  isActive
                    ? 'border-b-2 border-primary text-primary'
                    : 'border-b-2 border-transparent text-inkMuted hover:border-primary hover:text-primary'
                }`}
              >
                {tab.label}
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primaryLight px-1.5 text-[11px] font-semibold text-primaryDark">
                  {counts[tab.id]}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
