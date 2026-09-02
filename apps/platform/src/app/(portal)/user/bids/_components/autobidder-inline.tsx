'use client'

import { Btn } from '@erametsad/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { formatEur, formatEurInput, parseEurInput } from './format'

export interface AutobidderInlineProps {
  auctionId: string
  /** Start price (alghind) in EUR. */
  minBidEur: number
  /** Bid step in EUR; `null` when the auction defines no step. */
  bidStepEur: number | null
  /** Current leading bid in EUR; `null` when nobody leads yet. */
  currentLeadingEur: number | null
}

interface SavedAutobidder {
  id: string
  maxAmountEur: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// GET /api/v1/auto-bidders?auction= supplies the caller's own active row on
// mount, so the editor prefills the stored max and enables PATCH/DELETE.
// Without a row (204 or failed lookup) the editor starts blind and POST
// /api/v1/auto-bidders acts as an upsert; the server 422 (minAllowed)
// remains the authority.
export function AutobidderInline({
  auctionId,
  minBidEur,
  bidStepEur,
  currentLeadingEur,
}: AutobidderInlineProps) {
  const router = useRouter()
  const [saved, setSaved] = useState<SavedAutobidder | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const step = bidStepEur ?? 0
  const minimumNext =
    currentLeadingEur !== null ? currentLeadingEur + step : minBidEur
  const [maxStr, setMaxStr] = useState(() => formatEurInput(minimumNext))

  useEffect(() => {
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await fetch(
          `/api/v1/auto-bidders?auction=${encodeURIComponent(auctionId)}`,
          { signal: controller.signal },
        )
        if (response.status === 204) return
        if (!response.ok) return
        const payload: unknown = await response.json()
        if (!isRecord(payload) || typeof payload.id !== 'string') return
        if (typeof payload.max !== 'number') return
        setSaved({ id: payload.id, maxAmountEur: payload.max })
        setMaxStr(formatEurInput(payload.max))
      } catch {
        // Aborted or failed lookups leave the editor blind; POST still
        // upserts and the endpoints stay the authority.
      }
    })()
    return () => {
      controller.abort()
    }
  }, [auctionId])

  useEffect(() => {
    if (saved === null) {
      setMaxStr(formatEurInput(minimumNext))
    }
    // Leading-bid updates re-derive the suggestion; a saved max is kept.
  }, [minimumNext, saved])

  // Same floor the endpoints enforce: leading + step (or the start price),
  // and upward-only past the current max.
  const floor =
    saved !== null
      ? Math.max(minimumNext, saved.maxAmountEur + 0.01)
      : minimumNext

  async function handleSave(): Promise<void> {
    if (isBusy) return
    const value = parseEurInput(maxStr)
    if (value === null || value <= 0) {
      setError('Sisesta korrektne summa eurodes.')
      return
    }
    if (value < floor) {
      setError(
        `Maksimaalne summa peab olema vähemalt ${formatEurInput(floor)} €.`,
      )
      return
    }
    setIsBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response =
        saved !== null
          ? await fetch(
              `/api/v1/auto-bidders/${encodeURIComponent(saved.id)}`,
              {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ maxAmount: value }),
              },
            )
          : await fetch('/api/v1/auto-bidders', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ auctionId, maxAmount: value }),
            })
      const payload: unknown = await response.json().catch(() => null)
      if (response.ok && isRecord(payload) && typeof payload.id === 'string') {
        setSaved({ id: payload.id, maxAmountEur: value })
        setSuccess(`Automaatpakkuja maksimaalne summa on ${formatEur(value)}.`)
        router.refresh()
      } else if (response.status === 422) {
        const minAllowed =
          isRecord(payload) && typeof payload.minAllowed === 'number'
            ? payload.minAllowed
            : null
        setError(
          minAllowed !== null
            ? `Uus maksimaalne summa peab olema vähemalt ${formatEur(minAllowed)} €.`
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
    if (isBusy || saved === null) return
    setIsBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch(
        `/api/v1/auto-bidders/${encodeURIComponent(saved.id)}`,
        { method: 'DELETE' },
      )
      if (response.ok) {
        setSaved(null)
        setSuccess(
          'Automaatpakkuja on eemaldatud. Viimane tehtud pakkumine jääb jõusse.',
        )
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
    <div className="flex w-64 min-w-max flex-col gap-2xs">
      <div className="flex items-center gap-2xs">
        <input
          aria-label="Automaatpakkuja maksimaalne summa (€)"
          inputMode="decimal"
          autoComplete="off"
          value={maxStr}
          onChange={(event) => {
            setMaxStr(event.target.value)
            setError(null)
          }}
          aria-invalid={error !== null}
          className="h-8 w-24 min-w-0 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <Btn
          size="sm"
          isLoading={isBusy}
          onClick={() => {
            void handleSave()
          }}
        >
          {saved !== null ? 'Uuenda' : 'Määra/Uuenda'}
        </Btn>
        {saved !== null && (
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
        Vähim lubatud: {formatEurInput(floor)} €
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
    </div>
  )
}
