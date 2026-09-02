'use client'

import { Btn, FormInput, FormSelect, Modal } from '@erametsad/ui'
import { useState } from 'react'

import {
  apiJsonBody,
  asFilterRecord,
  csvText,
  csvTokens,
  parseCsvText,
  SPECIES_OPTIONS,
  LOGGING_TYPE_OPTIONS,
  SUBSCRIPTION_CHANNELS,
  SUBSCRIPTION_FREQUENCIES,
  subscriptionChannelLabel,
  subscriptionFrequencyLabel,
  type AuctionSubscriptionItem,
  type SubscriptionChannel,
  type SubscriptionFrequency,
} from './notifications-data'

interface FilterDraft {
  county: string
  parish: string
  species: string[]
  loggingType: string[]
  areaMin: string
  areaMax: string
  volumeMin: string
  volumeMax: string
  priceMin: string
  priceMax: string
}

function draftFromFilter(filter: unknown): FilterDraft {
  const data = asFilterRecord(filter)
  const numberText = (key: string): string => {
    const value = data[key]
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : ''
  }
  return {
    county: csvText(data.county),
    parish: csvText(data.parish),
    species: csvTokens(data.species),
    loggingType: csvTokens(data.loggingType),
    areaMin: numberText('areaMin'),
    areaMax: numberText('areaMax'),
    volumeMin: numberText('volumeMin'),
    volumeMax: numberText('volumeMax'),
    priceMin: numberText('priceMin'),
    priceMax: numberText('priceMax'),
  }
}

function filterFromDraft(draft: FilterDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const setTokens = (key: string, text: string) => {
    const values = parseCsvText(text)
    if (values.length > 0) out[key] = values
  }
  const setNumber = (key: string, text: string) => {
    const trimmed = text.trim()
    if (trimmed === '') return
    const value = Number(trimmed)
    if (Number.isFinite(value) && value >= 0) out[key] = value
  }
  setTokens('county', draft.county)
  setTokens('parish', draft.parish)
  if (draft.species.length > 0) out.species = draft.species
  if (draft.loggingType.length > 0) out.loggingType = draft.loggingType
  setNumber('areaMin', draft.areaMin)
  setNumber('areaMax', draft.areaMax)
  setNumber('volumeMin', draft.volumeMin)
  setNumber('volumeMax', draft.volumeMax)
  setNumber('priceMin', draft.priceMin)
  setNumber('priceMax', draft.priceMax)
  return out
}

function OptionChip({
  label,
  active,
  onToggle,
}: {
  label: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 font-body text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
        active
          ? 'bg-primary text-inkInverse'
          : 'border border-border bg-bgMist text-ink hover:bg-primaryLight'
      }`}
    >
      {label}
    </button>
  )
}

interface SubscriptionEditModalProps {
  mode: 'create' | 'edit'
  initialFilter: unknown
  onClose: () => void
  onSaved: (subscription: AuctionSubscriptionItem) => void
}

export function SubscriptionEditModal({
  mode,
  initialFilter,
  onClose,
  onSaved,
}: SubscriptionEditModalProps) {
  const [draft, setDraft] = useState<FilterDraft>(() => draftFromFilter(initialFilter))
  const [channel, setChannel] = useState<SubscriptionChannel>('email')
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('immediate')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (patch: Partial<FilterDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }))
  }

  const toggleToken = (key: 'species' | 'loggingType', value: string) => {
    setDraft((prev) => {
      const values = prev[key]
      return {
        ...prev,
        [key]: values.includes(value)
          ? values.filter((token) => token !== value)
          : [...values, value],
      }
    })
  }

  const consentMissing = mode === 'create' && channel === 'email' && !consent

  const save = async () => {
    setBusy(true)
    setError(null)
    const filterJson = filterFromDraft(draft)
    try {
      const saved =
        mode === 'create'
          ? await apiJsonBody<AuctionSubscriptionItem>('/api/v1/auction-subscriptions', 'POST', {
              filterJson,
              channel,
              frequency,
              ...(consent ? { consent: true } : {}),
            })
          : await apiJsonBody<AuctionSubscriptionItem>('/api/v1/auction-subscriptions', 'PATCH', {
              filterJson,
            })
      onSaved(saved)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salvestamine ebaõnnestus')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={mode === 'create' ? 'Uus otsingutellimus' : 'Muuda filtreid'}
    >
      <div className="flex flex-col gap-md">
        <div className="grid gap-sm sm:grid-cols-2">
          <FormInput
            label="Maakond"
            name="filter-county"
            hint="Eraldage komadega"
            value={draft.county}
            onChange={(event) => { update({ county: event.target.value }); }}
          />
          <FormInput
            label="Vald"
            name="filter-parish"
            hint="Eraldage komadega"
            value={draft.parish}
            onChange={(event) => { update({ parish: event.target.value }); }}
          />
        </div>

        <div className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">Puuliik</span>
          <div className="flex flex-wrap gap-xs">
            {SPECIES_OPTIONS.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                active={draft.species.includes(option.value)}
                onToggle={() => { toggleToken('species', option.value); }}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-xs">
          <span className="font-body text-bodySm font-semibold text-primary">Raieliik</span>
          <div className="flex flex-wrap gap-xs">
            {LOGGING_TYPE_OPTIONS.map((option) => (
              <OptionChip
                key={option.value}
                label={option.label}
                active={draft.loggingType.includes(option.value)}
                onToggle={() => { toggleToken('loggingType', option.value); }}
              />
            ))}
          </div>
        </div>

        <div className="grid gap-sm sm:grid-cols-3">
          <FormInput
            label="Pindala alates (ha)"
            name="filter-area-min"
            type="number"
            min={0}
            value={draft.areaMin}
            onChange={(event) => { update({ areaMin: event.target.value }); }}
          />
          <FormInput
            label="Maht alates (m³)"
            name="filter-volume-min"
            type="number"
            min={0}
            value={draft.volumeMin}
            onChange={(event) => { update({ volumeMin: event.target.value }); }}
          />
          <FormInput
            label="Hind alates (€)"
            name="filter-price-min"
            type="number"
            min={0}
            value={draft.priceMin}
            onChange={(event) => { update({ priceMin: event.target.value }); }}
          />
          <FormInput
            label="Pindala kuni (ha)"
            name="filter-area-max"
            type="number"
            min={0}
            value={draft.areaMax}
            onChange={(event) => { update({ areaMax: event.target.value }); }}
          />
          <FormInput
            label="Maht kuni (m³)"
            name="filter-volume-max"
            type="number"
            min={0}
            value={draft.volumeMax}
            onChange={(event) => { update({ volumeMax: event.target.value }); }}
          />
          <FormInput
            label="Hind kuni (€)"
            name="filter-price-max"
            type="number"
            min={0}
            value={draft.priceMax}
            onChange={(event) => { update({ priceMax: event.target.value }); }}
          />
        </div>

        {mode === 'create' && (
          <div className="grid gap-sm sm:grid-cols-2">
            <FormSelect
              label="Kanal"
              name="new-subscription-channel"
              value={channel}
              onChange={(event) => { setChannel(event.target.value as SubscriptionChannel); }}
              options={SUBSCRIPTION_CHANNELS.map((value) => ({
                value,
                label: subscriptionChannelLabel(value),
              }))}
            />
            <FormSelect
              label="Sagedus"
              name="new-subscription-frequency"
              value={frequency}
              onChange={(event) => { setFrequency(event.target.value as SubscriptionFrequency); }}
              options={SUBSCRIPTION_FREQUENCIES.map((value) => ({
                value,
                label: subscriptionFrequencyLabel(value),
              }))}
            />
          </div>
        )}

        {mode === 'create' && channel === 'email' && (
          <label className="inline-flex items-start gap-2">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => { setConsent(event.target.checked); }}
              className="mt-1 h-4 w-4 accent-primary"
            />
            <span className="font-body text-bodySm text-ink">
              Nõustan otsinguteavituste saamisega e-posti teel
            </span>
          </label>
        )}

        {error !== null && (
          <p role="alert" className="font-body text-bodySm text-danger">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-sm">
          <Btn onClick={() => void save()} isLoading={busy} disabled={consentMissing}>
            {mode === 'create' ? 'Looge tellimus' : 'Salvesta filtrid'}
          </Btn>
          <Btn variant="ghost" onClick={onClose} disabled={busy}>
            Loobu
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
