'use client'

import { Info, Send, X, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  apiJson,
  apiJsonBody,
  NOTIFICATION_EVENTS,
  type NotificationEventDef,
} from './notifications-data'

import { marketingUrl } from '@/app/(marketing)/_lib/base-url'

interface ChannelPrefs { email: boolean; sms: boolean }
type PreferenceMap = Record<string, ChannelPrefs>

function defaultPreferences(): PreferenceMap {
  const out: PreferenceMap = {}
  for (const event of NOTIFICATION_EVENTS) {
    out[event.value] = { email: event.effectiveEmail, sms: event.effectiveSms }
  }
  return out
}

// Stored shape: { [event]: { email?: boolean, sms?: boolean } }. Entries that
// fail validation fall back to the defaults for that event.
function storedChannel(value: unknown): ChannelPrefs | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const email = typeof record.email === 'boolean' ? record.email : undefined
  const sms = typeof record.sms === 'boolean' ? record.sms : undefined
  if (email === undefined && sms === undefined) return null
  return { email: email ?? true, sms: sms ?? false }
}

function mergeStoredPreferences(stored: unknown): PreferenceMap {
  const prefs = defaultPreferences()
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return prefs
  for (const [event, channels] of Object.entries(stored as Record<string, unknown>)) {
    const parsed = storedChannel(channels)
    if (parsed !== null && event in prefs) {
      prefs[event] = parsed
    }
  }
  return prefs
}

// The demo master switch maps onto the stored per-event channels: on while
// any channel is on; turning it off clears both, turning it on restores
// e-post (the main channel). No schema change behind profiles PATCH.
function eventEnabled(prefs: PreferenceMap, event: NotificationEventDef): boolean {
  const pref = prefs[event.value]
  return (pref?.email ?? event.effectiveEmail) || (pref?.sms ?? event.effectiveSms)
}

function PrefSwitch({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean
  label: string
  disabled: boolean
  onToggle: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        onToggle(!checked)
      }}
      className={`relative h-6 w-11 flex-none rounded-pill border-0 transition-colors duration-hover ease-hover motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-primary' : 'bg-[#C6CFC9]'
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-pill bg-white shadow-[0_1px_3px_rgba(22,56,42,0.25)] transition-transform duration-hover ease-hover motion-reduce:transition-none ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function PrefCheck({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean
  label: string
  disabled: boolean
  onChange?: (next: boolean) => void
}) {
  return (
    <label className="m-0 inline-flex cursor-pointer items-center justify-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        aria-label={label}
        className="h-[18px] w-[18px] flex-none accent-primary disabled:opacity-30"
        onChange={(changeEvent) => {
          onChange?.(changeEvent.target.checked)
        }}
      />
      <span className="hidden text-bodySm text-inkMuted max-md:inline">{label}</span>
    </label>
  )
}

interface ToastState {
  message: string
  key: number
}

export function PreferenceMatrix() {
  const [prefs, setPrefs] = useState<PreferenceMap>(defaultPreferences)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [testSending, setTestSending] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await apiJson<{
          profiles: { notificationPreferences?: unknown }[]
        }>('/api/v1/profiles')
        if (cancelled) return
        setPrefs(mergeStoredPreferences(data.profiles[0]?.notificationPreferences))
      } catch {
        if (!cancelled) setLoadFailed(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [])

  async function saveChannels(event: NotificationEventDef, channels: ChannelPrefs) {
    if (busy) return
    const previous = prefs
    const updated: PreferenceMap = {
      ...prefs,
      [event.value]: channels,
    }
    setPrefs(updated)
    setBusy(true)
    setSaved(false)
    setError(null)
    try {
      await apiJsonBody('/api/v1/profiles', 'PATCH', {
        notificationPreferences: updated,
      })
      setSaved(true)
    } catch (saveError) {
      setPrefs(previous)
      setError(saveError instanceof Error ? saveError.message : 'Salvestamine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  // Real outcome only: the toast reports what the endpoint answered
  // (success message, send-failure detail, or the 429 rate-limit text).
  async function sendTestNotification() {
    if (testSending) return
    setTestSending(true)
    try {
      await apiJson<{ status: string }>('/api/v1/my/notifications/test', { method: 'POST' })
      setToast({
        message: 'Test-teavitus saadetud — kontrolli oma e-posti postkasti.',
        key: Date.now(),
      })
    } catch (sendError) {
      setToast({
        message:
          sendError instanceof Error
            ? sendError.message
            : 'Test-teavituse saatmine ebaõnnestus.',
        key: Date.now(),
      })
    } finally {
      setTestSending(false)
    }
  }

  const toggleEvent = (event: NotificationEventDef, next: boolean) => {
    const current = prefs[event.value] ?? {
      email: event.effectiveEmail,
      sms: event.effectiveSms,
    }
    if (next) {
      // Restores the main channel; SMS keeps its stored state only where the
      // channel exists for the event.
      void saveChannels(event, {
        email: true,
        sms: event.smsAvailable ? current.sms : false,
      })
    } else {
      void saveChannels(event, { email: false, sms: false })
    }
  }

  return (
    <section
      aria-labelledby="notifications-prefs-title"
      className="rounded-card border border-border bg-white p-6 shadow-card max-md:p-[14px]"
    >
      <h2 id="notifications-prefs-title" className="font-heading text-[22px] font-bold text-ink">
        Teavituste eelistused
      </h2>
      <p className="mt-1.5 text-[15px] text-inkMuted">
        Vali, millistest sündmustest ja millistel kanalitel sind teavitatakse.
      </p>

      {loadFailed && (
        <div className="mt-3 rounded-card border border-border bg-bgMist px-6 py-3">
          <p className="font-body text-bodySm text-ink">
            Teavitussätete laadimine ebaõnnestus; tabelis on vaikeväärtused.
          </p>
        </div>
      )}

      <div className="mt-4 border-t border-border" role="table" aria-label="Teavituste eelistused">
        <div
          aria-hidden="true"
          className="hidden grid-cols-[minmax(0,1fr)_130px_96px_96px] items-center gap-x-4 border-b border-border px-2 py-2.5 text-xs font-semibold uppercase tracking-wide text-inkMuted md:grid"
        >
          <span>Sündmus</span>
          <span className="text-center">Teavitused</span>
          <span className="text-center">E-post</span>
          <span className="text-center">SMS</span>
        </div>

        {NOTIFICATION_EVENTS.map((event) => {
          const pref = prefs[event.value] ?? {
            email: event.effectiveEmail,
            sms: event.effectiveSms,
          }
          const enabled = eventEnabled(prefs, event)
          return (
            <div
              key={event.value}
              className="grid items-center gap-x-4 gap-y-2 border-b border-border px-2 py-3 max-md:grid-cols-[auto_auto_auto] max-md:justify-start md:grid-cols-[minmax(0,1fr)_130px_96px_96px]"
            >
              <span className="font-body text-[15px] font-semibold text-ink max-md:col-span-full">
                {event.settingsLabel}
                <small className="mt-0.5 block font-body text-bodySm font-normal text-inkMuted">
                  {event.settingsDescription}
                </small>
              </span>
              <span className="flex items-center justify-center gap-2 max-md:justify-start">
                <PrefSwitch
                  checked={enabled}
                  label={`${event.settingsLabel} — teavitused sisse ja välja`}
                  disabled={busy}
                  onToggle={(next) => {
                    toggleEvent(event, next)
                  }}
                />
                <span className="hidden text-bodySm text-inkMuted max-md:inline">Teavitused</span>
              </span>
              <span className="flex items-center justify-center max-md:justify-start">
                {event.emailAvailable ? (
                  <PrefCheck
                    checked={pref.email}
                    label={`${event.settingsLabel} — e-post`}
                    disabled={busy || !enabled}
                    onChange={(next) => {
                      void saveChannels(event, { ...pref, email: next })
                    }}
                  />
                ) : (
                  <span className="text-bodySm text-inkMuted max-md:inline">Ainult rakenduses</span>
                )}
              </span>
              <span className="flex items-center justify-center max-md:justify-start">
                {event.smsAvailable ? (
                  // SMS stays display-only until verified phone numbers exist.
                  <PrefCheck
                    checked={pref.sms}
                    label={`${event.settingsLabel} — SMS`}
                    disabled
                  />
                ) : (
                  <span aria-label="SMS ei ole selle sündmuse puhul saadaval" className="text-bodySm text-inkMuted">
                    —
                  </span>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-card bg-infoLight px-[18px] py-[14px]">
        <Info size={18} className="mt-0.5 flex-none text-info" aria-hidden="true" />
        <p className="m-0 text-bodySm leading-relaxed text-ink">
          <b>E-post on peamine teavituskanal.</b> SMS-i saadame ainult ajakriitiliste sündmuste
          puhul — kui sinu pakkumine ületatakse või oksjon lõpeb või pikeneb vähem kui tunni
          jooksul. Tellitud otsingute kokkuvõtted liiguvad e-postiga (igapäevane kokkuvõte
          saadetakse iga hommikul).
        </p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="m-0 inline-flex items-center gap-2 text-bodySm text-inkMuted">
          <Zap size={13} className="text-statusActive" aria-hidden="true" />
          Muudatused rakenduvad kohe.
        </p>
        {busy && <span className="text-bodySm text-inkMuted">Salvestamine…</span>}
        {saved && !busy && (
          <span role="status" className="text-bodySm text-primary">
            Salvestatud
          </span>
        )}
        {error !== null && (
          <span role="alert" className="text-bodySm text-danger">
            {error}
          </span>
        )}
        <span className="flex-1" />
        <a
          href={marketingUrl('/lepingud/dokumendid')}
          className="text-bodySm text-primary underline-offset-2 transition-colors duration-hover ease-hover hover:text-primaryHover hover:underline"
        >
          Privaatsuspoliitika ja nõusolekute logi
        </a>
        <button
          type="button"
          disabled={testSending}
          onClick={() => {
            void sendTestNotification()
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-button border border-primary bg-transparent px-4 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Send size={14} aria-hidden="true" />
          {testSending ? 'Saadame…' : 'Saada test-teavitus'}
        </button>
      </div>

      {toast !== null && (
        <div
          key={toast.key}
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-button bg-primaryDark px-4 py-3 text-inkInverse shadow-modal"
        >
          <p className="text-bodySm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => {
              setToast(null)
            }}
            aria-label="Sulge teavitus"
            className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-pill transition-opacity duration-hover hover:opacity-80"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
