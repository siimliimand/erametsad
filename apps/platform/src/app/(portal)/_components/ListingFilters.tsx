'use client'

import { Btn, Card, ConsentCheck, FormInput, FormRange, FormSelect, Toast } from '@erametsad/ui'
import { Bell, RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'

import {
  filterJsonFromListingState,
  validateSubscribeForm,
  SubscribeDialog,
} from './SubscribeDialog'
import {
  AREA_RANGE,
  DEFAULT_LISTING_FILTERS,
  PRICE_RANGE,
  countActiveFilters,
  listingFiltersEqual,
  parseListingFilters,
  serializeListingFilters,
  type ListingFilterState,
} from '../_lib/filter-params'
import { SPECIES } from '../_lib/species'

import { apiFetch } from '@/lib/api/client'

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

// Demo chip anatomy: the visible label is the bare code, the tooltip
// carries the Estonian name, and the accessible name reads "CODE Name"
// per the listing spec ("the chips read MA Mänd, …"). Chip values stay
// data-layer tokens so `species=` links keep working; `ha` keeps its
// stored value while displaying the demo code HB.
const SPECIES_CHIP_OPTIONS = SPECIES.map((species) => ({
  value: species.value,
  label: species.code,
  title: species.name,
  // "the chips read MA Mänd, KU Kuusk, …"
  ariaLabel: `${species.code} ${species.name}`,
}))

// Demo cut-type codes (design Decision 6). The seed data still stores
// the older U/H/T/L/R codes, so these chips match nothing until the
// data layer adopts the demo taxonomy.
const LOGGING_TYPE_OPTIONS = [
  { value: 'vr', label: 'VR', title: 'Raieliik VR' },
  { value: 'hr', label: 'HR', title: 'Harvendusraie' },
  { value: 'sr', label: 'SR', title: 'Sanitaarraie' },
  { value: 'lr', label: 'LR', title: 'Lageraie' },
  { value: 'rd', label: 'RD', title: 'Rekonstruktsiooniraie' },
] as const

// The data layer stores no cut-deadline year, so the select renders the
// demo window (current year plus two) instead of stored values.
const CUT_DEADLINE_YEARS = [0, 1, 2].map((offset) => new Date().getFullYear() + offset)

// Demo consent wording for the guest inline sub-form.
const SUBSCRIBE_CONSENT_LABEL =
  'Nõustun, et Erametsad töötleb mu isikuandmeid sobivate oksjonite teavitamiseks.'

function toggleToken(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((token) => token !== value) : [...list, value]
}

interface FilterSectionProps {
  label: string
  labelId: string
  children: React.ReactNode
}

function FilterSection({ label, labelId, children }: FilterSectionProps) {
  return (
    <div className="flex flex-col gap-xs">
      <span id={labelId} className="font-body text-bodySm font-semibold text-primary">
        {label}
      </span>
      {children}
    </div>
  )
}

interface FilterChipsProps {
  options: readonly {
    value: string
    label: string
    title: string
    ariaLabel?: string
  }[]
  selected: string[]
  labelledby: string
  onToggle: (value: string) => void
}

function FilterChips({ options, selected, labelledby, onToggle }: FilterChipsProps) {
  return (
    <div role="group" aria-labelledby={labelledby} className="flex flex-wrap gap-xs">
      {options.map((option) => {
        const isActive = selected.includes(option.value)
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => { onToggle(option.value); }}
            aria-pressed={isActive}
            aria-label={option.ariaLabel ?? option.title}
            title={option.title}
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
  const [toast, setToast] = useState<string | null>(null)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [subFormOpen, setSubFormOpen] = useState(false)
  const [subscribeMode, setSubscribeMode] = useState<'authed' | 'guest' | null>(null)
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [subscribeError, setSubscribeError] = useState<string | null>(null)

  const state = draft !== null && !listingFiltersEqual(draft, urlState) ? draft : urlState
  const activeCount = countActiveFilters(state)

  useEffect(() => {
    let cancelled = false
    apiFetch('/api/v1/counties')
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

  // Same auth probe the dialog runs: a 401 means the save would run as a
  // guest, so guests get the demo inline sub-form and authed users the
  // subscription modal. Probe errors fall back to the guest form, which
  // stays safe for authed users too (the POST simply succeeds).
  useEffect(() => {
    let cancelled = false
    apiFetch('/api/v1/auction-subscriptions')
      .then((response) => {
        if (response.status === 401) return 'guest' as const
        if (response.ok) return 'authed' as const
        throw new Error(String(response.status))
      })
      .then((mode) => {
        if (!cancelled) setSubscribeMode(mode)
      })
      .catch(() => {
        if (!cancelled) setSubscribeMode('guest')
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

  const toggleSubscribe = () => {
    if (subscribeMode === 'authed') {
      setSubscribeOpen(true)
      return
    }
    setSubFormOpen((open) => !open)
  }

  const submitGuestSubscription = async () => {
    const errors = validateSubscribeForm('guest', 'email', email, consent)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setSubscribeError(null)
    // Same guest contract as SubscribeDialog: the route has no top-level
    // guest email field, so the address travels inside filterJson.
    const payload = {
      filterJson: { ...filterJsonFromListingState(state), guestEmail: email.trim() },
      channel: 'email' as const,
      frequency: 'immediate' as const,
      consent: true,
    }
    try {
      const response = await apiFetch('/api/v1/auction-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Salvestamine ebaõnnestus (${String(response.status)})`)
      }
      setSubFormOpen(false)
      setEmail('')
      setConsent(false)
      setToast('Otsingutellimus on salvestatud.')
    } catch (cause) {
      setSubscribeError(cause instanceof Error ? cause.message : 'Salvestamine ebaõnnestus')
    } finally {
      setBusy(false)
    }
  }

  const activeBadge =
    activeCount > 0 ? (
      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primary px-1.5 font-mono text-[11px] font-bold text-inkInverse">
        {activeCount}
      </span>
    ) : null

  return (
    <Card
      hover={false}
      content={
        <div className="flex flex-col gap-md">
          {/* The listing toolbar owns the mobile disclosure; the card
              itself renders fully expanded in both states. */}
          <div className="flex w-full items-center justify-between gap-sm">
            <span className="font-heading text-h4 font-semibold text-ink">Filtrid</span>
            {activeBadge}
          </div>

          <div className="grid gap-sm">
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
              hint="Vali kõigepealt maakond."
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
          </div>

          <FilterSection label="Puuliigid" labelId="speciesLabel">
            <FilterChips
              options={SPECIES_CHIP_OPTIONS}
              selected={state.species}
              labelledby="speciesLabel"
              onToggle={(value) => { update({ species: toggleToken(state.species, value) }); }}
            />
          </FilterSection>

          <FilterSection label="Raieliigid" labelId="cutLabel">
            <FilterChips
              options={LOGGING_TYPE_OPTIONS}
              selected={state.loggingTypes}
              labelledby="cutLabel"
              onToggle={(value) => { update({ loggingTypes: toggleToken(state.loggingTypes, value) }); }
              }
            />
          </FilterSection>

          <div className="grid gap-sm">
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
            <FormSelect
              label="Raietähtaeg (aasta)"
              name="cutDeadlineYear"
              value={state.cutDeadlineYear === undefined ? '' : String(state.cutDeadlineYear)}
              onChange={(event) => { update({
                  cutDeadlineYear:
                    event.target.value === '' ? undefined : Number(event.target.value),
                }); }
              }
              options={[
                { value: '', label: 'Kõik' },
                ...CUT_DEADLINE_YEARS.map((year) => ({
                  value: String(year),
                  label: String(year),
                })),
              ]}
            />
          </div>

          <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
            <Btn type="button" variant="outline" onClick={clear} className="sm:self-start">
              <RotateCcw size={15} aria-hidden="true" /> Tühjenda
            </Btn>
            <Btn
              type="button"
              onClick={toggleSubscribe}
              aria-expanded={subFormOpen}
              aria-controls="subForm"
            >
              <Bell size={15} aria-hidden="true" /> Telli teavitus
            </Btn>
          </div>

          <div
            id="subForm"
            {...(subFormOpen ? {} : { hidden: true })}
            className="flex flex-col gap-sm rounded-input border border-border bg-bgMist p-sm"
          >
            <FormInput
              label="E-post"
              name="subEmail"
              type="email"
              autoComplete="email"
              placeholder="sinu@email.ee"
              required
              value={email}
              disabled={busy}
              {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
              onChange={(event) => { setEmail(event.target.value); }}
            />
            <ConsentCheck
              name="subConsent"
              label={SUBSCRIBE_CONSENT_LABEL}
              {...(fieldErrors.consent ? { error: fieldErrors.consent } : {})}
              onChange={setConsent}
            />
            {subscribeError !== null && (
              <p role="alert" className="font-body text-bodySm text-danger">
                {subscribeError}
              </p>
            )}
            <Btn type="button" variant="cta" isLoading={busy} onClick={() => { void submitGuestSubscription(); }}>
              Telli teavitus
            </Btn>
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
