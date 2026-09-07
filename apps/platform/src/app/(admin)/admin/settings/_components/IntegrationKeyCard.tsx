'use client'

import { useState } from 'react'

import type { IntegrationKeyDefinition } from './integration-keys'
import { revealIntegrationKeyAction } from '../../../_actions/settings'

/**
 * One env-backed key card: masked value by default, an audited reveal
 * (settings.key_reveal via the server action) and a configured/unconfigured
 * status dot. The raw value only ever arrives through the action's return
 * value for authorized admins — the server never passes it in as a prop.
 */
export function IntegrationKeyCard({
  id,
  label,
  envVar,
  description,
  configured,
}: IntegrationKeyDefinition & { configured: boolean }) {
  const [revealed, setRevealed] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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
          disabled={busy || !configured}
          className="inline-flex h-8 items-center rounded-input border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {revealed !== null ? 'Peida' : 'Näita'}
        </button>
        <span
          role="img"
          aria-label={configured ? 'Seadistatud' : 'Seadistamata'}
          title={configured ? 'Seadistatud' : 'Seadistamata'}
          className={`h-2.5 w-2.5 shrink-0 rounded-pill ${configured ? 'bg-[var(--st-active-dot)]' : 'bg-border'}`}
        />
      </div>
      <p className="text-label text-inkMuted">
        {description} Keskkonnamuutuja: <code className="font-mono">{envVar}</code>.
      </p>
      {error ? <p className="text-label font-medium text-danger">{error}</p> : null}
    </div>
  )
}
