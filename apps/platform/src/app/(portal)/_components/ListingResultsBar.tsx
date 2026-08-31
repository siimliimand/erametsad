'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useId } from 'react'

import {
  LISTING_SORT_FIELDS,
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
  { value: 'endTime:asc', label: 'Lõpeb peatselt' },
  { value: 'endTime:desc', label: 'Lõpeb hiljem' },
  { value: 'startPrice:asc', label: 'Alghind: madalam enne' },
  { value: 'startPrice:desc', label: 'Alghind: kõrgem enne' },
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
}

export function ListingResultsBar({ tab, total }: ListingResultsBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectId = useId()

  const { sortField, sortDirection } = parseListingFilters(searchParams)

  // A select fires once per choice, so the filter panel's 300ms draft
  // debounce has nothing to wait for. serializeListingFilters keeps the
  // other filter params and omits `page`, so a sort change restarts at 1.
  const changeSort = (value: string) => {
    const parsed = parseSortValue(value)
    if (parsed === null) return
    router.replace(
      `${pathname}?${serializeListingFilters(
        { ...parseListingFilters(searchParams), ...parsed },
        tab,
      )}`,
      { scroll: false },
    )
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-sm">
      <p className="font-body text-body text-inkMuted">
        Leitud {formatEstonianInteger(total)} {total === 1 ? 'oksjon' : 'oksjonit'}
      </p>

      <div className="flex items-center gap-xs">
        <label
          htmlFor={selectId}
          className="font-body text-bodySm font-semibold text-primary"
        >
          Sorteeri:
        </label>
        <select
          id={selectId}
          name="sort"
          value={`${sortField}:${sortDirection}`}
          onChange={(event) => { changeSort(event.target.value); }}
          className="h-10 rounded-input border border-border bg-bgPage px-3 font-body text-body text-ink transition-colors duration-hover ease-hover focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 motion-reduce:transition-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
