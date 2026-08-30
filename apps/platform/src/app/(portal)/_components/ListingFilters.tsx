'use client'

import { Btn, Card, FormRange, FormSelect, Toast } from '@eametsad/ui'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import { SubscribeDialog } from './SubscribeDialog'
import {
  AREA_RANGE,
  DEFAULT_LISTING_FILTERS,
  PRICE_RANGE,
  VOLUME_RANGE,
  countActiveFilters,
  listingFiltersEqual,
  parseListingFilters,
  serializeListingFilters,
  type ListingFilterState,
  type ListingSortDirection,
  type ListingSortField,
} from '../_lib/filter-params'
import { SPECIES } from '../_lib/species'

interface CountyParish {
  id: string
  name: string
}

interface CountyOption {
  id: string
  name: string
  parishes: CountyParish[]
}

function isCountyOption(value: unknown): value is CountyOption {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (typeof record.id !== 'string' || typeof record.name !== 'string') return false
  if (!Array.isArray(record.parishes)) return false
  return record.parishes.every(
    (parish): parish is CountyParish =>
      typeof parish === 'object' &&
      parish !== null &&
      typeof (parish as Record<string, unknown>).id === 'string' &&
      typeof (parish as Record<string, unknown>).name === 'string',
  )
}

function parseCounties(value: unknown): CountyOption[] {
  if (!Array.isArray(value)) return []
  return value.filter(isCountyOption)
}

// Chips keep the "Name (CODE)" format; the plain names live in the
// shared species table for reuse by the lot card.
const SPECIES_CHIP_OPTIONS = SPECIES.map((species) => ({
  value: species.value,
  label: `${species.name} (${species.code})`,
}))

// No label taxonomy exists in the repo; seed data stores bare codes.
const LOGGING_TYPE_OPTIONS = [
  { value: 'u', label: 'Uuendusraie (U)' },
  { value: 'h', label: 'Hooldusraie (H)' },
  { value: 't', label: 'Taastusraie (T)' },
  { value: 'l', label: 'Langu- ja kahjustuspuude raie (L)' },
  { value: 'r', label: 'Sanitaarraie (R)' },
] as const

const SORT_OPTIONS = [
  { value: 'endTime:asc', label: 'Lõpeb peatselt' },
  { value: 'endTime:desc', label: 'Lõpeb hiljem' },
  { value: 'startPrice:asc', label: 'Alghind: madalam enne' },
  { value: 'startPrice:desc', label: 'Alghind: kõrgem enne' },
] as const

function toggleToken(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((token) => token !== value) : [...list, value]
}

interface FilterSectionProps {
  label: string
  children: React.ReactNode
}

function FilterSection({ label, children }: FilterSectionProps) {
  return (
    <div className="flex flex-col gap-xs">
      <span className="font-body text-bodySm font-semibold text-primary">{label}</span>
      {children}
    </div>
  )
}

interface FilterChipsProps {
  options: readonly { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
}

function FilterChips({ options, selected, onToggle }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-xs">
      {options.map((option) => {
        const isActive = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => { onToggle(option.value); }}
            aria-pressed={isActive}
            className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 font-body text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
              isActive
                ? 'bg-primary text-inkInverse'
                : 'border border-border bg-bgMist text-ink hover:bg-primaryLight'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function ListingFilters({ tab }: { tab: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const urlState = useMemo(() => parseListingFilters(searchParams), [searchParams])
  const [draft, setDraft] = useState<ListingFilterState | null>(null)
  const [counties, setCounties] = useState<CountyOption[] | null>(null)
  const [resetEpoch, setResetEpoch] = useState(0)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const state = draft !== null && !listingFiltersEqual(draft, urlState) ? draft : urlState
  const activeCount = countActiveFilters(state)

  useEffect(() => {
    let cancelled = false
    fetch('/api/v1/counties')
      .then((response) => {
        if (!response.ok) throw new Error(String(response.status))
        return response.json()
      })
      .then((data: unknown) => {
        if (!cancelled) setCounties(parseCounties(data))
      })
      .catch(() => {
        // Select stays disabled; a reload or later retry recovers it.
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (draft === null) return
    if (listingFiltersEqual(draft, urlState)) {
      setDraft(null)
      return
    }
    const timer = setTimeout(() => {
      router.replace(`${pathname}?${serializeListingFilters(draft, tab)}`, {
        scroll: false,
      })
    }, 300)
    return () => { clearTimeout(timer); }
  }, [draft, urlState, tab, pathname, router])

  const update = (patch: Partial<ListingFilterState>) => {
    setDraft({ ...state, ...patch })
  }

  const countyValue = state.county[0] ?? ''
  const selectedCounty = counties?.find((county) => county.name === countyValue) ?? null
  const parishValue = state.parish[0] ?? ''

  const clear = () => {
    setDraft({ ...DEFAULT_LISTING_FILTERS })
    setResetEpoch((epoch) => epoch + 1)
  }

  return (
    <Card
      hover={false}
      content={
        <div className="flex flex-col gap-md">
          <div className="flex items-center justify-between">
            <span className="font-heading text-h4 font-semibold text-ink">Filtrid</span>
            {activeCount > 0 && (
              <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary px-1.5 font-mono text-[11px] font-bold text-inkInverse">
                {activeCount}
              </span>
            )}
          </div>

          <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
            <FormSelect
              label="Maakond"
              name="county"
              value={countyValue}
              onChange={(event) => { update({
                  county: event.target.value === '' ? [] : [event.target.value],
                  parish: [],
                }); }
              }
              options={[
                { value: '', label: 'Kõik maakonnad' },
                ...(counties ?? []).map((county) => ({
                  value: county.name,
                  label: county.name,
                })),
              ]}
            />
            <FormSelect
              label="Vald"
              name="parish"
              value={parishValue}
              disabled={selectedCounty === null}
              onChange={(event) => { update({
                  parish: event.target.value === '' ? [] : [event.target.value],
                }); }
              }
              options={[
                { value: '', label: 'Kõik vallad' },
                ...(selectedCounty?.parishes ?? []).map((parish) => ({
                  value: parish.name,
                  label: parish.name,
                })),
              ]}
            />
            <FormSelect
              label="Sorteeri"
              name="sort"
              value={`${state.sortField}:${state.sortDirection}`}
              onChange={(event) => {
                const [field, direction] = event.target.value.split(':')
                update({
                  sortField: field as ListingSortField,
                  sortDirection: direction as ListingSortDirection,
                })
              }}
              options={SORT_OPTIONS.map((option) => ({ ...option }))}
            />
          </div>

          <FilterSection label="Puuliik">
            <FilterChips
              options={SPECIES_CHIP_OPTIONS}
              selected={state.species}
              onToggle={(value) => { update({ species: toggleToken(state.species, value) }); }}
            />
          </FilterSection>

          <FilterSection label="Raieliik">
            <FilterChips
              options={LOGGING_TYPE_OPTIONS}
              selected={state.loggingTypes}
              onToggle={(value) => { update({ loggingTypes: toggleToken(state.loggingTypes, value) }); }
              }
            />
          </FilterSection>

          <div className="grid gap-sm sm:grid-cols-2 lg:grid-cols-3">
            <FormRange
              key={`area-${String(resetEpoch)}`}
              label="Pindala (ha)"
              name="area"
              min={AREA_RANGE.min}
              max={AREA_RANGE.max}
              step={1}
              value={[state.areaMin ?? AREA_RANGE.min, state.areaMax ?? AREA_RANGE.max]}
              onChange={([min, max]) => { update({
                  areaMin: min > AREA_RANGE.min ? min : undefined,
                  areaMax: max < AREA_RANGE.max ? max : undefined,
                }); }
              }
            />
            <FormRange
              key={`volume-${String(resetEpoch)}`}
              label="Maht (m³)"
              name="volume"
              min={VOLUME_RANGE.min}
              max={VOLUME_RANGE.max}
              step={1}
              value={[
                state.volumeMin ?? VOLUME_RANGE.min,
                state.volumeMax ?? VOLUME_RANGE.max,
              ]}
              onChange={([min, max]) => { update({
                  volumeMin: min > VOLUME_RANGE.min ? min : undefined,
                  volumeMax: max < VOLUME_RANGE.max ? max : undefined,
                }); }
              }
            />
            <FormRange
              key={`price-${String(resetEpoch)}`}
              label="Hind (€)"
              name="price"
              min={PRICE_RANGE.min}
              max={PRICE_RANGE.max}
              step={100}
              value={[state.priceMin ?? PRICE_RANGE.min, state.priceMax ?? PRICE_RANGE.max]}
              onChange={([min, max]) => { update({
                  priceMin: min > PRICE_RANGE.min ? min : undefined,
                  priceMax: max < PRICE_RANGE.max ? max : undefined,
                }); }
              }
            />
          </div>

          <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
            <Btn type="button" onClick={() => { setSubscribeOpen(true); }}>
              Telli teavitus
            </Btn>
            {activeCount > 0 && (
              <Btn type="button" variant="outline" onClick={clear} className="sm:self-start">
                Tühjenda
              </Btn>
            )}
          </div>

          <SubscribeDialog
            isOpen={subscribeOpen}
            filter={state}
            onClose={() => { setSubscribeOpen(false); }}
            onSaved={() => {
              setSubscribeOpen(false)
              setToast('Otsingutellimus on salvestatud.')
            }}
          />
          {toast !== null && (
            <Toast message={toast} type="success" isVisible onClose={() => { setToast(null); }} />
          )}
        </div>
      }
    />
  )
}
