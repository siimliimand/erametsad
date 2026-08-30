'use client'

import { Btn, ConsentCheck, FormInput, FormSelect, Modal } from '@eametsad/ui'
import { useEffect, useMemo, useState } from 'react'

import { type ListingFilterState } from '../_lib/filter-params'

type SubscriptionChannel = 'email' | 'sms'
type SubscriptionFrequency = 'immediate' | 'daily' | 'weekly'

export type SubscribeDialogMode = 'authed' | 'guest'

// ListingFilters and the notifications page keep these tables module-private,
// so the dialog carries its own copy of the same value/label pairs.
const SPECIES_LABELS: Record<string, string> = {
  ma: 'Mänd (MA)',
  ku: 'Kuusk (KU)',
  ks: 'Kask (KS)',
  ha: 'Haab (HA)',
  sa: 'Sanglepp (SA)',
  ta: 'Tamm (TA)',
}

const LOGGING_TYPE_LABELS: Record<string, string> = {
  u: 'Uuendusraie (U)',
  h: 'Hooldusraie (H)',
  t: 'Taastusraie (T)',
  l: 'Langu- ja kahjustuspuude raie (L)',
  r: 'Sanitaarraie (R)',
}

const CHANNEL_OPTIONS = [
  { value: 'email', label: 'E-post' },
  { value: 'sms', label: 'SMS' },
]

const FREQUENCY_OPTIONS = [
  { value: 'immediate', label: 'Kohe' },
  { value: 'daily', label: 'Kord päevas' },
  { value: 'weekly', label: 'Kord nädalas' },
]

// Same wording as the notifications page subscription consent.
const CONSENT_LABEL = 'Nõustan otsinguteavituste saamisega e-posti teel'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Maps the panel state to the filterJson shape the notifications page
 * stores (arrays for token lists, bare numbers for ranges, sort excluded).
 */
export function filterJsonFromListingState(
  state: ListingFilterState,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (state.county.length > 0) out.county = state.county
  if (state.parish.length > 0) out.parish = state.parish
  if (state.species.length > 0) out.species = state.species
  if (state.loggingTypes.length > 0) out.loggingType = state.loggingTypes
  if (state.areaMin !== undefined) out.areaMin = state.areaMin
  if (state.areaMax !== undefined) out.areaMax = state.areaMax
  if (state.volumeMin !== undefined) out.volumeMin = state.volumeMin
  if (state.volumeMax !== undefined) out.volumeMax = state.volumeMax
  if (state.priceMin !== undefined) out.priceMin = state.priceMin
  if (state.priceMax !== undefined) out.priceMax = state.priceMax
  return out
}

/** Estonian summary of the filters the subscription will watch. */
export function activeFilterChips(state: ListingFilterState): string[] {
  const chips: string[] = []
  if (state.county.length > 0) chips.push(`Maakond: ${state.county.join(', ')}`)
  if (state.parish.length > 0) chips.push(`Vald: ${state.parish.join(', ')}`)
  if (state.species.length > 0) {
    const labels = state.species.map((value) => SPECIES_LABELS[value] ?? value)
    chips.push(`Puuliik: ${labels.join(', ')}`)
  }
  if (state.loggingTypes.length > 0) {
    const labels = state.loggingTypes.map((value) => LOGGING_TYPE_LABELS[value] ?? value)
    chips.push(`Raieliik: ${labels.join(', ')}`)
  }
  const rangeChip = (
    label: string,
    unit: string,
    min: number | undefined,
    max: number | undefined,
  ) => {
    if (min === undefined && max === undefined) return
    if (min !== undefined && max !== undefined) {
      chips.push(`${label}: ${String(min)}–${String(max)} ${unit}`)
    } else if (min !== undefined) {
      chips.push(`${label}: alates ${String(min)} ${unit}`)
    } else {
      chips.push(`${label}: kuni ${String(max)} ${unit}`)
    }
  }
  rangeChip('Pindala', 'ha', state.areaMin, state.areaMax)
  rangeChip('Maht', 'm³', state.volumeMin, state.volumeMax)
  rangeChip('Hind', '€', state.priceMin, state.priceMax)
  return chips
}

/** Blocks guest submit until email is valid and consent is checked. */
export function validateSubscribeForm(
  mode: SubscribeDialogMode,
  channel: SubscriptionChannel,
  email: string,
  consent: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (mode === 'guest') {
    const trimmed = email.trim()
    if (trimmed === '') errors.email = 'E-post on kohustuslik'
    else if (!EMAIL_PATTERN.test(trimmed)) {
      errors.email = 'Palun sisestage kehtiv e-posti aadress.'
    }
  }
  if ((mode === 'guest' || channel === 'email') && !consent) {
    errors.consent = 'Nõusolek on kohustuslik'
  }
  return errors
}

export interface SubscribeDialogContentProps {
  mode: SubscribeDialogMode
  chips: string[]
  channel: SubscriptionChannel
  frequency: SubscriptionFrequency
  email: string
  busy: boolean
  fieldErrors: Record<string, string>
  error: string | null
  onEmailChange: (value: string) => void
  onChannelChange: (value: SubscriptionChannel) => void
  onFrequencyChange: (value: SubscriptionFrequency) => void
  onConsentChange: (checked: boolean) => void
  onSubmit: () => void
  onCancel: () => void
}

export function SubscribeDialogContent({
  mode,
  chips,
  channel,
  frequency,
  email,
  busy,
  fieldErrors,
  error,
  onEmailChange,
  onChannelChange,
  onFrequencyChange,
  onConsentChange,
  onSubmit,
  onCancel,
}: SubscribeDialogContentProps) {
  const consentRequired = mode === 'guest' || channel === 'email'
  return (
    <div className="flex flex-col gap-md">
      <p className="font-body text-bodySm text-inkMuted">
        Salvestame teie aktiivsed filtrid. Saatme teate, kui müüki tuleb neile vastav uus oksjon.
      </p>

      {chips.length > 0 ? (
        <ul className="flex flex-wrap gap-xs" aria-label="Aktiivsed filtrid">
          {chips.map((chip) => (
            <li
              key={chip}
              className="inline-flex items-center rounded-pill bg-bgMist px-4 py-2 font-body text-bodySm text-ink"
            >
              {chip}
            </li>
          ))}
        </ul>
      ) : (
        <p className="font-body text-bodySm text-inkMuted">
          Filtreid pole valitud. Teavitus kehtib kõigi uute oksjonide kohta.
        </p>
      )}

      {mode === 'authed' && (
        <div className="grid gap-sm sm:grid-cols-2">
          <FormSelect
            label="Kanal"
            name="subscribe-channel"
            value={channel}
            onChange={(event) => {
              onChannelChange(event.target.value as SubscriptionChannel)
            }}
            options={CHANNEL_OPTIONS}
          />
          <FormSelect
            label="Sagedus"
            name="subscribe-frequency"
            value={frequency}
            onChange={(event) => {
              onFrequencyChange(event.target.value as SubscriptionFrequency)
            }}
            options={FREQUENCY_OPTIONS}
          />
        </div>
      )}

      {mode === 'guest' && (
        <FormInput
          label="E-post"
          name="subscribe-email"
          type="email"
          required
          value={email}
          disabled={busy}
          {...(fieldErrors.email ? { error: fieldErrors.email } : {})}
          onChange={(event) => {
            onEmailChange(event.target.value)
          }}
        />
      )}

      {consentRequired && (
        <ConsentCheck
          name="subscribe-consent"
          label={CONSENT_LABEL}
          {...(fieldErrors.consent ? { error: fieldErrors.consent } : {})}
          onChange={onConsentChange}
        />
      )}

      {error !== null && (
        <p role="alert" className="font-body text-bodySm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-sm">
        <Btn type="button" onClick={onSubmit} isLoading={busy}>
          Looge tellimus
        </Btn>
        <Btn type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Loobu
        </Btn>
      </div>
    </div>
  )
}

interface SubscribeDialogProps {
  isOpen: boolean
  filter: ListingFilterState
  onClose: () => void
  onSaved: () => void
}

export function SubscribeDialog({ isOpen, filter, onClose, onSaved }: SubscribeDialogProps) {
  const [mode, setMode] = useState<SubscribeDialogMode | null>(null)
  const [probeNonce, setProbeNonce] = useState(0)
  const [probeFailed, setProbeFailed] = useState(false)
  const [channel, setChannel] = useState<SubscriptionChannel>('email')
  const [frequency, setFrequency] = useState<SubscriptionFrequency>('immediate')
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const chips = useMemo(() => activeFilterChips(filter), [filter])

  useEffect(() => {
    if (!isOpen) return
    setMode(null)
    setProbeFailed(false)
    setEmail('')
    setConsent(false)
    setChannel('email')
    setFrequency('immediate')
    setBusy(false)
    setFieldErrors({})
    setError(null)
    let cancelled = false
    // Same cookie auth the POST uses: a 401 here means the save would run
    // as a guest, so this probe decides the form variant.
    fetch('/api/v1/auction-subscriptions')
      .then((response) => {
        if (response.status === 401) return 'guest' as const
        if (response.ok) return 'authed' as const
        throw new Error(String(response.status))
      })
      .then((nextMode) => {
        if (!cancelled) setMode(nextMode)
      })
      .catch(() => {
        if (!cancelled) setProbeFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, probeNonce])

  const save = async () => {
    if (mode === null) return
    const errors = validateSubscribeForm(mode, channel, email, consent)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    setBusy(true)
    setError(null)
    const filterJson = filterJsonFromListingState(filter)
    // The route has no top-level guest email field, so the address travels
    // inside filterJson (TEXT-JSON) — the only place the contract keeps it.
    const payload =
      mode === 'guest'
        ? {
            filterJson: { ...filterJson, guestEmail: email.trim() },
            channel: 'email' as const,
            frequency: 'immediate' as const,
            consent: true,
          }
        : { filterJson, channel, frequency, ...(consent ? { consent: true } : {}) }
    try {
      const response = await fetch('/api/v1/auction-subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error ?? `Salvestamine ebaõnnestus (${String(response.status)})`)
      }
      onSaved()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Salvestamine ebaõnnestus')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Telli teavitus" size="md">
      {mode === null ? (
        probeFailed ? (
          <div className="flex flex-col gap-md">
            <p role="alert" className="font-body text-bodySm text-danger">
              Teavituse olekut ei õnnestunud laadida. Palun proovige uuesti.
            </p>
            <div>
              <Btn
                type="button"
                onClick={() => {
                  setProbeNonce((nonce) => nonce + 1)
                }}
              >
                Proovi uuesti
              </Btn>
            </div>
          </div>
        ) : (
          <p className="font-body text-bodySm text-inkMuted">Laadin…</p>
        )
      ) : (
        <SubscribeDialogContent
          mode={mode}
          chips={chips}
          channel={channel}
          frequency={frequency}
          email={email}
          busy={busy}
          fieldErrors={fieldErrors}
          error={error}
          onEmailChange={setEmail}
          onChannelChange={setChannel}
          onFrequencyChange={setFrequency}
          onConsentChange={setConsent}
          onSubmit={() => {
            void save()
          }}
          onCancel={onClose}
        />
      )}
    </Modal>
  )
}
