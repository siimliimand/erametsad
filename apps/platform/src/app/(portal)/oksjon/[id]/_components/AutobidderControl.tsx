'use client'

import { Btn } from '@erametsad/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export interface AutobidderExisting {
  id: string
  /** Current maximum in EUR. */
  maxAmount: number
}

export interface AutobidderControlProps {
  auctionId: string
  /** Start price (alghind) in EUR. */
  minBid: number
  /** Bid step in EUR; `null` when the auction defines no step. */
  bidStep: number | null
  /** Current leading bid in EUR; `null` when nobody leads yet. */
  currentLeading: number | null
  /**
   * The caller's active autobidder row. `null` when absent or when the page
   * cannot supply the row; POST /api/v1/auto-bidders then acts as an upsert.
   */
  existing: AutobidderExisting | null
  /** True when the server reports an active autobidder without its row. */
  hasAutobidder: boolean
}

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

function inputAmount(value: number): string {
  return value.toLocaleString('et-EE', { maximumFractionDigits: 2 })
}

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/\s/g, '').replace(',', '.')
  if (normalized === '') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function AutobidderControl({
  auctionId,
  minBid,
  bidStep,
  currentLeading,
  existing,
  hasAutobidder,
}: AutobidderControlProps) {
  const router = useRouter()

  const [current, setCurrent] = useState<AutobidderExisting | null>(existing)
  const [maxStr, setMaxStr] = useState(() => {
    const step = bidStep ?? 0
    const initial =
      existing !== null
        ? existing.maxAmount
        : currentLeading !== null
          ? currentLeading + step
          : minBid
    return inputAmount(initial)
  })
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const step = bidStep ?? 0
  const minimumNext = currentLeading !== null ? currentLeading + step : minBid

  useEffect(() => {
    setCurrent(existing)
    setMaxStr(
      inputAmount(
        existing !== null
          ? existing.maxAmount
          : currentLeading !== null
            ? currentLeading + step
            : minBid,
      ),
    )
    // Parent refreshes (leading bid moved) re-derive the prefill.
  }, [existing, currentLeading, minBid, step])

  // Same floor the PATCH endpoint enforces: leading + step, or the start
  // price when nobody leads, and upward-only past the current max.
  const floor =
    current !== null ? Math.max(minimumNext, current.maxAmount + 0.01) : minimumNext

  async function handleSave(): Promise<void> {
    if (isBusy) return
    const value = parseAmount(maxStr)
    if (value === null || value <= 0) {
      setError('Sisesta korrektne summa eurodes.')
      return
    }
    if (value < floor) {
      setError(`Maksimaalne summa peab olema vähemalt ${inputAmount(floor)} €.`)
      return
    }
    setIsBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response =
        current !== null
          ? await fetch(`/api/v1/auto-bidders/${encodeURIComponent(current.id)}`, {
              method: 'PATCH',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ maxAmount: value }),
            })
          : await fetch('/api/v1/auto-bidders', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ auctionId, maxAmount: value }),
            })
      const payload: unknown = await response.json().catch(() => null)
      if (response.ok && isRecord(payload) && typeof payload.id === 'string') {
        setCurrent({ id: payload.id, maxAmount: value })
        setSuccess(`Automaatpakkuja maksimaalne summa on ${eur(value)}.`)
        router.refresh()
      } else if (response.status === 422) {
        const minAllowed =
          isRecord(payload) && typeof payload.minAllowed === 'number'
            ? payload.minAllowed
            : null
        setError(
          minAllowed !== null
            ? `Uus maksimaalne summa peab olema vähemalt ${eur(minAllowed)} €.`
            : 'Uus maksimaalne summa on liiga väike.',
        )
      } else if (response.status === 409) {
        setError('Oksjon ei ole enam aktiivne.')
      } else if (response.status === 401) {
        setError('Sessioon on aegunud. Logi uuesti sisse.')
      } else {
        setError('Automaatpakkuja salvestamine ebaõnnestus. Proovi uuesti.')
      }
    } catch {
      setError('Võrguühendus puudub. Proovi uuesti.')
    }
    setIsBusy(false)
  }

  async function handleRemove(): Promise<void> {
    if (isBusy || current === null) return
    setIsBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(
        `/api/v1/auto-bidders/${encodeURIComponent(current.id)}`,
        { method: 'DELETE' },
      )
      if (response.ok) {
        setCurrent(null)
        setSuccess('Automaatpakkuja on eemaldatud. Viimane tehtud pakkumine jääb jõusse.')
        router.refresh()
      } else if (response.status === 409) {
        setError('Oksjon ei ole enam aktiivne.')
      } else if (response.status === 401) {
        setError('Sessioon on aegunud. Logi uuesti sisse.')
      } else {
        setError('Automaatpakkuja eemaldamine ebaõnnestus. Proovi uuesti.')
      }
    } catch {
      setError('Võrguühendus puudub. Proovi uuesti.')
    }
    setIsBusy(false)
  }

  return (
    <section className="flex flex-col gap-2xs rounded-card border border-border p-xs">
      <p className="text-label font-semibold text-ink">Automaatpakkuja</p>
      <p className="text-bodySm text-inkMuted">
        {current !== null
          ? `Süsteem pakub sinu eest automaatselt kuni ${eur(current.maxAmount)} summani, kui keegi pakub üle.`
          : 'Süsteem teeb sinu eest automaatselt pakkumisi kuni määratud maksimaalse summani, kui keegi pakub üle.'}
      </p>
      <label htmlFor="autobidder-max" className="text-label font-semibold text-ink">
        Maksimaalne summa (€)
      </label>
      <div className="flex flex-wrap items-center gap-xs">
        <input
          id="autobidder-max"
          inputMode="decimal"
          autoComplete="off"
          value={maxStr}
          onChange={(event) => {
            setMaxStr(event.target.value)
            setError(null)
          }}
          aria-invalid={error !== null}
          className="h-10 w-32 min-w-0 rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Btn
          size="sm"
          isLoading={isBusy}
          onClick={() => {
            void handleSave()
          }}
        >
          {current !== null || hasAutobidder ? 'Uuenda' : 'Määra'}
        </Btn>
        {current !== null && (
          <Btn
            size="sm"
            variant="outline"
            disabled={isBusy}
            onClick={() => {
              void handleRemove()
            }}
          >
            Eemalda
          </Btn>
        )}
      </div>
      <p className="text-bodySm text-inkMuted">
        Vähim lubatud: {inputAmount(floor)} €
      </p>
      {error !== null && (
        <p role="alert" className="text-bodySm text-danger">
          {error}
        </p>
      )}
      {success !== null && (
        <p role="status" className="text-bodySm text-inkMuted">
          {success}
        </p>
      )}
    </section>
  )
}
