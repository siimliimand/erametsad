'use client'

import { useEffect, useState } from 'react'

import type { IntegrationCheckState, IntegrationKeyDefinition } from './integration-keys'
import {
  getIntegrationCheckAction,
  rotateIntegrationKeyAction,
  revealIntegrationKeyAction,
  testIntegrationConnectionAction,
} from '../../../_actions/settings'

const checkedAtFormat = new Intl.DateTimeFormat('et-EE', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Tallinn',
})

/**
 * One integration key card: masked value by default, an audited reveal
 * (settings.key_reveal via the server action), a configured/unconfigured
 * status dot, a "Testi ühendust" action with the persisted last-check
 * state (timestamp, latency, failure text) and a write-only rotation
 * field. The raw value only ever arrives through the reveal action's
 * return value for authorized admins — the server never passes it in as
 * a prop and a rotated value is never rendered back.
 */
export function IntegrationKeyCard({
  id,
  label,
  envVar,
  description,
  configured,
}: IntegrationKeyDefinition & { configured: boolean }) {
  const [configuredLocal, setConfiguredLocal] = useState(configured)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [check, setCheck] = useState<IntegrationCheckState | null>(null)
  const [checkBusy, setCheckBusy] = useState(false)
  const [rotateValue, setRotateValue] = useState('')
  const [rotateReason, setRotateReason] = useState('')
  const [rotateMessage, setRotateMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    getIntegrationCheckAction(id)
      .then((state) => {
        if (!cancelled && state) {
          setCheck(state)
        }
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [id])

  const toggleReveal = async (): Promise<void> => {
    if (revealed !== null) {
      setRevealed(null)
      return
    }
    setBusy(true)
    setError(null)
    try {
      const result = await revealIntegrationKeyAction(id)
      if (result.ok && typeof result.value === 'string') {
        setRevealed(result.value)
      } else {
        setError(result.error ?? 'Võtme paljastamine ebaõnnestus.')
      }
    } catch {
      setError('Võtme paljastamine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  const testConnection = async (): Promise<void> => {
    setCheckBusy(true)
    setError(null)
    try {
      const result = await testIntegrationConnectionAction(id)
      setCheck(result)
    } catch {
      setError('Ühenduse testimine ebaõnnestus.')
    } finally {
      setCheckBusy(false)
    }
  }

  const rotateKey = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    setRotateMessage(null)
    try {
      const result = await rotateIntegrationKeyAction(id, rotateValue, rotateReason)
      if (result.ok) {
        setRotateValue('')
        setRotateReason('')
        setRotateMessage('Uus võti on salvestatud.')
        setConfiguredLocal(true)
      } else {
        setError(result.error ?? 'Võtme vahetamine ebaõnnestus.')
      }
    } catch {
      setError('Võtme vahetamine ebaõnnestus.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 border-b border-border py-sm last:border-b-0">
      <div className="flex flex-wrap items-center gap-sm">
        <span className="min-w-[200px] flex-1 text-label font-semibold text-ink">{label}</span>
        <code className="rounded-input bg-bgMist px-2 py-1 font-mono text-bodySm text-ink">
          {revealed ?? '••••••••••••'}
        </code>
        <button
          type="button"
          onClick={() => {
            void toggleReveal()
          }}
          disabled={busy || (!configuredLocal && revealed === null)}
          className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {revealed !== null ? 'Peida' : 'Näita'}
        </button>
        <button
          type="button"
          onClick={() => {
            void testConnection()
          }}
          disabled={checkBusy}
          className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Testi ühendust
        </button>
        <span
          role="img"
          aria-label={configuredLocal ? 'Seadistatud' : 'Seadistamata'}
          title={configuredLocal ? 'Seadistatud' : 'Seadistamata'}
          className={`h-2.5 w-2.5 shrink-0 rounded-pill ${configuredLocal ? 'bg-[var(--st-active-dot)]' : 'bg-border'}`}
        />
      </div>
      <p className="text-label text-inkMuted">
        {description} Keskkonnamuutuja: <code className="font-mono">{envVar}</code>.
      </p>
      {check ? (
        <p className={`text-label font-medium ${check.ok ? 'text-inkMuted' : 'text-danger'}`}>
          {check.ok
            ? `Viimane kontroll: ${checkedAtFormat.format(new Date(check.checkedAt))} · OK · ${String(check.latencyMs)} ms`
            : `Viimane kontroll: ${checkedAtFormat.format(new Date(check.checkedAt))} · Ebaõnnestus (${String(check.latencyMs)} ms): ${check.error ?? 'tundmatu viga'}`}
        </p>
      ) : null}
      {rotateMessage ? <p className="text-label font-medium text-inkMuted">{rotateMessage}</p> : null}
      {error ? <p className="text-label font-medium text-danger">{error}</p> : null}
      <div className="mt-1 flex flex-wrap items-center gap-sm">
        <label className="sr-only" htmlFor={`rotate-${id}`}>
          Uus võti
        </label>
        <input
          id={`rotate-${id}`}
          type="password"
          autoComplete="new-password"
          value={rotateValue}
          onChange={(event) => {
            setRotateValue(event.target.value)
          }}
          placeholder="Uus salajane võti"
          className="h-8 w-56 rounded-input border border-border bg-bgPage px-2 font-mono text-bodySm text-ink"
        />
        <label className="sr-only" htmlFor={`rotate-reason-${id}`}>
          Põhjendus
        </label>
        <input
          id={`rotate-reason-${id}`}
          type="text"
          value={rotateReason}
          onChange={(event) => {
            setRotateReason(event.target.value)
          }}
          placeholder="Põhjendus (auditilogisse)"
          className="h-8 w-56 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink"
        />
        <button
          type="button"
          onClick={() => {
            void rotateKey()
          }}
          disabled={busy || !rotateValue.trim() || !rotateReason.trim()}
          className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Vaheta võti
        </button>
      </div>
    </div>
  )
}
