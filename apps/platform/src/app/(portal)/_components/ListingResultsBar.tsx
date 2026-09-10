'use client'

import { List, Map } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import {
  LISTING_SORT_FIELDS,
  countActiveFilters,
  parseListingFilters,
  serializeListingFilters,
  type ListingSortDirection,
  type ListingSortField,
} from '../_lib/filter-params'
import { formatEstonianInteger, type ListingTabId } from '../_lib/summary'

export const SORT_OPTIONS: readonly {
  value: `${ListingSortField}:${ListingSortDirection}`
  label: string
}[] = [
  { value: 'endTime:asc', label: 'Varem lõppevad eespool' },
  { value: 'endTime:desc', label: 'Hiljem lõppevad eespool' },
  { value: 'startPrice:asc', label: 'Alghind kasvavalt' },
  { value: 'startPrice:desc', label: 'Alghind kahanevalt' },
]

function parseSortValue(
  value: string,
): { sortField: ListingSortField; sortDirection: ListingSortDirection } | null {
  const [field, direction] = value.split(':')
  const sortField = LISTING_SORT_FIELDS.find((candidate) => candidate === field)
  if (sortField === undefined || (direction !== 'asc' && direction !== 'desc')) return null
  return { sortField, sortDirection: direction }
}

interface ListingResultsBarProps {
  tab: ListingTabId
  total: number
  mapView: boolean
  /** Server-rendered filter panel; rendered as the disclosure-controlled aside column. */
  filtersSlot: ReactNode
  /** Server-rendered map slot for the Kaardivaade branch (replaces the results list). */
  mapSlot?: ReactNode
  /** List branch: result grid or empty state, followed by pagination. */
  children?: ReactNode
}

export function ListingResultsBar({
  tab,
  total,
  mapView,
  filtersSlot,
  mapSlot,
  children,
}: ListingResultsBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilters = countActiveFilters(parseListingFilters(searchParams))
  const { sortField, sortDirection } = parseListingFilters(searchParams)

  // A select fires once per choice, so the filter panel's 300ms draft
  // debounce has nothing to wait for. serializeListingFilters keeps the
  // other filter params and omits `page`, so a sort change restarts at 1;
  // it round-trips filters only, so the view param is re-attached by hand.
  const changeSort = (value: string) => {
    const parsed = parseSortValue(value)
    if (parsed === null) return
    const query = serializeListingFilters(
      { ...parseListingFilters(searchParams), ...parsed },
      tab,
    )
    router.replace(`${pathname}?${query}${mapView ? '&view=kaart' : ''}`, {
      scroll: false,
    })
  }

  const changeView = (next: 'kaart' | 'loend') => {
    if ((next === 'kaart') === mapView) return
    const search = new URLSearchParams(searchParams.toString())
    if (next === 'kaart') search.set('view', 'kaart')
    else search.delete('view')
    router.replace(`${pathname}?${search.toString()}`, { scroll: false })
  }

  const viewButtonClass = (pressed: boolean): string =>
    `inline-flex items-center gap-[7px] px-4 py-[9px] font-body text-[15px] font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
      pressed ? 'bg-primary text-inkInverse' : 'bg-white text-inkMuted'
    }`

  return (
    <>
      <aside
        id="filters"
        aria-label="Oksjonite filtrid"
        className={`col-span-12 lg:col-span-3 ${filtersOpen ? 'block' : 'hidden'} lg:block`}
      >
        {filtersSlot}
      </aside>

      <div className="col-span-12 flex flex-col gap-lg lg:col-span-9">
        <div className="flex flex-wrap items-center gap-[14px]">
          <div
            role="group"
            aria-label="Vaade"
            className="inline-flex overflow-hidden rounded-button border border-border"
          >
            <button
              type="button"
              aria-pressed={mapView}
              onClick={() => { changeView('kaart'); }}
              className={viewButtonClass(mapView)}
            >
              <Map size={15} aria-hidden="true" /> Kaardivaade
            </button>
            <button
              type="button"
              aria-pressed={!mapView}
              onClick={() => { changeView('loend'); }}
              className={viewButtonClass(!mapView)}
            >
              <List size={15} aria-hidden="true" /> Loendivaade
            </button>
          </div>

          <button
            type="button"
            onClick={() => { setFiltersOpen((open) => !open); }}
            aria-expanded={filtersOpen}
            aria-controls="filters"
            className="inline-flex items-center gap-xs rounded-button border border-border bg-white px-4 py-[9px] font-body text-[15px] font-semibold text-ink transition-colors duration-hover ease-hover motion-reduce:transition-none hover:border-primary hover:text-primary lg:hidden"
          >
            {'Filtrid '}
            <span className="rounded-pill bg-primaryLight px-[9px] py-px font-mono text-[13px] font-medium text-primaryHover">
              ({String(activeFilters)})
            </span>
          </button>

          <p className="font-body text-body text-inkMuted">
            Leitud {formatEstonianInteger(total)} {total === 1 ? 'oksjon' : 'oksjonit'}
          </p>

          <label className="flex w-full items-center gap-2 font-body text-bodySm font-semibold text-inkMuted lg:ml-auto lg:w-auto">
            Sorteeri
            <select
              name="sort"
              value={`${sortField}:${sortDirection}`}
              onChange={(event) => { changeSort(event.target.value); }}
              className="min-h-10 w-full flex-1 rounded-button border border-border bg-white px-3 py-2 font-body text-bodySm font-medium text-ink transition-colors duration-hover ease-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none lg:w-auto"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {mapView ? mapSlot : children}
      </div>
    </>
  )
}
