'use client'

import { List, Map, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'

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

  useEffect(() => {
    document.body.classList.toggle('overflow-hidden', filtersOpen)
    return () => {
      document.body.classList.remove('overflow-hidden')
    }
  }, [filtersOpen])

  useEffect(() => {
    if (!filtersOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFiltersOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [filtersOpen])

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
    `inline-flex items-center justify-center gap-1.5 px-3 py-2 font-body text-sm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none sm:gap-[7px] sm:px-4 sm:py-[9px] sm:text-[15px] ${
      pressed ? 'bg-primary text-inkInverse' : 'bg-white text-inkMuted'
    }`

  return (
    <>
      {/* Mobile filter backdrop */}
      {filtersOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[140] bg-[rgba(22,56,42,0.4)] lg:hidden"
          onClick={() => { setFiltersOpen(false); }}
        />
      )}

      <aside
        id="filters"
        aria-label="Oksjonite filtrid"
        className={`col-span-12 lg:col-span-3 ${
          filtersOpen
            ? 'fixed inset-y-0 right-0 z-[150] flex w-[min(360px,92vw)] flex-col overflow-y-auto bg-bgPage p-4 shadow-modal lg:static lg:z-auto lg:flex lg:w-auto lg:p-0 lg:shadow-none'
            : 'hidden'
        } lg:block`}
      >
        <div className="mb-4 flex items-center justify-between border-b border-border pb-3 lg:hidden">
          <span className="font-heading text-lg font-bold text-ink">
            Filtrid {activeFilters > 0 && <span className="font-mono text-sm text-primary">({activeFilters})</span>}
          </span>
          <button
            type="button"
            aria-label="Sulge filtrid"
            onClick={() => { setFiltersOpen(false); }}
            className="p-1 text-ink hover:text-primary"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1">
          {filtersSlot}
        </div>

        <div className="mt-4 border-t border-border pt-4 lg:hidden">
          <button
            type="button"
            onClick={() => { setFiltersOpen(false); }}
            className="w-full rounded-button bg-primary py-2.5 font-body text-[15px] font-semibold text-inkInverse hover:bg-primaryHover"
          >
            Vaata tulemusi ({formatEstonianInteger(total)})
          </button>
        </div>
      </aside>

      <div className="col-span-12 flex flex-col gap-6 lg:col-span-9 lg:gap-lg">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-[14px]">
          <div className="flex items-center justify-between gap-2 sm:justify-start">
            <div
              role="group"
              aria-label="Vaade"
              className="inline-flex overflow-hidden rounded-button border border-border"
            >
              <button
                type="button"
                aria-pressed={mapView}
                aria-label="Kaardivaade"
                title="Kaardivaade"
                onClick={() => { changeView('kaart'); }}
                className={viewButtonClass(mapView)}
              >
                <Map size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Kaardivaade</span>
              </button>
              <button
                type="button"
                aria-pressed={!mapView}
                aria-label="Loendivaade"
                title="Loendivaade"
                onClick={() => { changeView('loend'); }}
                className={viewButtonClass(!mapView)}
              >
                <List size={15} aria-hidden="true" />
                <span className="hidden sm:inline">Loendivaade</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => { setFiltersOpen((open) => !open); }}
              aria-expanded={filtersOpen}
              aria-controls="filters"
              className="inline-flex items-center gap-xs rounded-button border border-border bg-white px-3 py-2 font-body text-sm font-semibold text-ink transition-colors duration-hover ease-hover motion-reduce:transition-none hover:border-primary hover:text-primary sm:px-4 sm:py-[9px] sm:text-[15px] lg:hidden"
            >
              {'Filtrid '}
              <span className="rounded-pill bg-primaryLight px-[9px] py-px font-mono text-[13px] font-medium text-primaryHover">
                ({String(activeFilters)})
              </span>
            </button>
          </div>

          <p className="font-body text-bodySm text-inkMuted sm:text-body">
            Leitud {formatEstonianInteger(total)} {total === 1 ? 'oksjon' : 'oksjonit'}
          </p>

          <label className="flex w-full items-center gap-2 font-body text-bodySm font-semibold text-inkMuted sm:w-auto lg:ml-auto">
            Sorteeri
            <select
              name="sort"
              value={`${sortField}:${sortDirection}`}
              onChange={(event) => { changeSort(event.target.value); }}
              className="min-h-10 w-full flex-1 rounded-button border border-border bg-white px-3 py-2 font-body text-bodySm font-medium text-ink transition-colors duration-hover ease-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none sm:w-auto"
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
