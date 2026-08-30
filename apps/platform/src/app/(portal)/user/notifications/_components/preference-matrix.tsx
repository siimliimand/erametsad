'use client'

import { useEffect, useState } from 'react'

import {
  apiJson,
  apiJsonBody,
  NOTIFICATION_EVENTS,
} from './notifications-data'

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

function Toggle({
  checked,
  label,
  disabled,
  onToggle,
}: {
  checked: boolean
  label: string
  disabled: boolean
  onToggle?: (next: boolean) => void
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        className="h-4 w-4 accent-primary"
        aria-label={label}
        onChange={(changeEvent) => {
          onToggle?.(changeEvent.target.checked)
        }}
      />
      <span className="font-body text-bodySm text-inkMuted">
        {checked ? 'Saadetakse' : 'Ei saadeta'}
      </span>
    </label>
  )
}

export function PreferenceMatrix() {
  const [prefs, setPrefs] = useState<PreferenceMap>(defaultPreferences)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function saveEmail(eventValue: string, fallback: ChannelPrefs, next: boolean) {
    if (busy) return
    const previous = prefs
    const current = prefs[eventValue] ?? fallback
    const updated: PreferenceMap = {
      ...prefs,
      [eventValue]: { ...current, email: next },
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

  return (
    <div className="flex flex-col gap-md">
      {loadFailed && (
        <div className="rounded-card border border-border bg-bgMist px-md py-sm">
          <p className="font-body text-bodySm text-ink">
            Teavitussätete laadimine ebaõnnestus; tabelis on vaikeväärtused.
          </p>
        </div>
      )}

      <div className="overflow-x-auto rounded-card border border-border">
        <table className="w-full min-w-[480px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bgMist">
              <th scope="col" className="px-md py-sm font-body text-bodySm font-semibold text-primary">
                Sündmus
              </th>
              <th scope="col" className="px-md py-sm font-body text-bodySm font-semibold text-primary">
                E-post
              </th>
              <th scope="col" className="px-md py-sm font-body text-bodySm font-semibold text-primary">
                SMS
              </th>
            </tr>
          </thead>
          <tbody>
            {NOTIFICATION_EVENTS.map((event) => (
              <tr key={event.value} className="border-b border-border last:border-b-0">
                <td className="px-md py-sm font-body text-body text-ink">{event.settingsLabel}</td>
                <td className="px-md py-sm">
                  {event.emailAvailable ? (
                    <Toggle
                      checked={prefs[event.value]?.email ?? event.effectiveEmail}
                      label={`E-post: ${event.settingsLabel}`}
                      disabled={busy}
                      onToggle={(next) => {
                        void saveEmail(
                          event.value,
                          { email: event.effectiveEmail, sms: event.effectiveSms },
                          next,
                        )
                      }}
                    />
                  ) : (
                    <span className="font-body text-bodySm text-inkMuted">Ainult rakenduses</span>
                  )}
                </td>
                <td className="px-md py-sm">
                  {event.smsAvailable ? (
                    // SMS stays display-only until verified phone numbers exist.
                    <Toggle
                      checked={prefs[event.value]?.sms ?? event.effectiveSms}
                      label={`SMS: ${event.settingsLabel}`}
                      disabled
                    />
                  ) : (
                    <span className="font-body text-bodySm text-inkMuted">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-sm">
        {busy && <span className="font-body text-bodySm text-inkMuted">Salvestamine…</span>}
        {saved && !busy && (
          <span role="status" className="font-body text-bodySm text-primary">
            Salvestatud
          </span>
        )}
        {error && (
          <span role="alert" className="font-body text-bodySm text-danger">
            {error}
          </span>
        )}
      </div>

      <p className="font-body text-bodySm text-inkMuted">
        SMS-teavitus on võimalik ainult võidu ja lepingu sündmuste puhul. SMS-i saamiseks peab
        telefoninumber olema profiilis kinnitatud.
      </p>
    </div>
  )
}
