'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { formatEur, formatEurInput, parseEurInput } from './format'

import { apiFetch } from '@/lib/api/client'

export interface AutobidderInlineProps {
  auctionId: string
  /** Start price (alghind) in EUR. */
  minBidEur: number
  /** Bid step in EUR; `null` when the auction defines no step. */
  bidStepEur: number | null
  /** Current leading bid in EUR; `null` when nobody leads yet. */
  currentLeadingEur: number | null
  /** The caller's own bid; names it in the pause toast when present. */
  myBidAmountEur?: number | null
  /** Card-level toast (demo .toast) for switch flips. */
  onToast?: (message: string) => void
}

interface SavedAutobidder {
  id: string
  maxAmountEur: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Demo .autobid row on the bid card: "max X €" + switch + Muuda. The switch
// and the editor keep the existing endpoint wiring: GET
// /api/v1/auto-bidders?auction= prefills the stored max, POST acts as an
// upsert that (re)activates, DELETE pauses (the last placed bid stands) and
// PATCH changes the max of the active row. The server 422 (minAllowed)
// remains the authority for the editor floor.
export function AutobidderInline({
  auctionId,
  minBidEur,
  bidStepEur,
  currentLeadingEur,
  myBidAmountEur = null,
  onToast,
}: AutobidderInlineProps) {
  const router = useRouter()
  const [saved, setSaved] = useState<SavedAutobidder | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [maxStr, setMaxStr] = useState(() => formatEurInput(minimumNext()))
  // The last known max survives a pause (DELETE hides the row from GET), so
  // flipping the switch back on restores the same limit.
  const lastMaxRef = useRef<number | null>(null)

  function minimumNext(): number {
    const step = bidStepEur ?? 0
    return currentLeadingEur !== null ? currentLeadingEur + step : minBidEur
  }

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
        lastMaxRef.current = payload.max
        setMaxStr(formatEurInput(payload.max))
      } catch {
        // Aborted or failed lookups leave the control blind; POST still
        // upserts and the endpoints stay the authority.
      }
    })()
    return () => {
      controller.abort()
    }
  }, [auctionId])

  // Same floor the endpoints enforce: leading + step (or the start price),
  // and upward-only past the current max.
  const floor =
    saved !== null
      ? Math.max(minimumNext(), saved.maxAmountEur + 0.01)
      : minimumNext()

  function toast(message: string): void {
    onToast?.(message)
  }

  // Switch on: POST upserts (and re-activates) with the remembered max, or
  // the suggested minimum when no limit is known yet.
  async function handleActivate(): Promise<void> {
    const value = lastMaxRef.current ?? minimumNext()
    setIsBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await apiFetch('/api/v1/auto-bidders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ auctionId, maxAmount: value }),
      })
      const payload: unknown = await response.json().catch(() => null)
      if (response.ok && isRecord(payload) && typeof payload.id === 'string') {
        setSaved({ id: payload.id, maxAmountEur: value })
        lastMaxRef.current = value
        setMaxStr(formatEurInput(value))
        toast(
          `Automaatpakkuja aktiveeritud — pakub sinu eest kuni ${formatEur(value)}.`,
        )
        router.refresh()
      } else if (response.status === 409) {
        setError('Oksjon ei ole enam aktiivne.')
      } else if (response.status === 401) {
        setError('Sessioon on aegunud. Logi uuesti sisse.')
      } else {
        setError('Automaatpakkuja aktiveerimine ebaõnnestus. Proovi uuesti.')
      }
    } catch {
      setError('Võrguühendus puudub. Proovi uuesti.')
    }
    setIsBusy(false)
  }

  // Switch off: DELETE pauses the row; the last placed bid stands.
  async function handlePause(): Promise<void> {
    if (saved === null) return
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
        toast(
          myBidAmountEur !== null
            ? `Automaatpakkuja peatatud. Sinu pakkumine ${formatEur(myBidAmountEur)} jääb kehtima.`
            : 'Automaatpakkuja peatatud. Sinu pakkumine jääb kehtima.',
        )
        router.refresh()
      } else if (response.status === 409) {
        setError('Oksjon ei ole enam aktiivne.')
      } else if (response.status === 401) {
        setError('Sessioon on aegunud. Logi uuesti sisse.')
      } else {
        setError('Automaatpakkuja peatamine ebaõnnestus. Proovi uuesti.')
      }
    } catch {
      setError('Võrguühendus puudub. Proovi uuesti.')
    }
    setIsBusy(false)
  }

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
          : await apiFetch('/api/v1/auto-bidders', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ auctionId, maxAmount: value }),
            })
      const payload: unknown = await response.json().catch(() => null)
      if (response.ok && isRecord(payload) && typeof payload.id === 'string') {
        setSaved({ id: payload.id, maxAmountEur: value })
        lastMaxRef.current = value
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
    <div className="flex flex-col gap-2xs">
      <div className="flex items-center gap-2.5">
        <span className="whitespace-nowrap text-[13px] font-semibold text-inkMuted">
          max{' '}
          <span className="font-mono font-medium text-ink">
            {saved !== null ? formatEur(saved.maxAmountEur) : '—'}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={saved !== null}
          aria-label="Automaatpakkuja sisse ja välja"
          disabled={isBusy}
          onClick={() => {
            if (saved !== null) void handlePause()
            else void handleActivate()
          }}
          className={`relative h-6 w-11 flex-none rounded-pill border-0 px-0.5 transition-colors duration-hover ease-hover motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40 ${
            saved !== null ? 'bg-primary' : 'bg-[#C6CFC9]'
          }`}
        >
          <span
            aria-hidden="true"
            className={`absolute top-1/2 block h-[18px] w-[18px] -translate-y-1/2 rounded-pill bg-bgPage shadow-sm transition-all duration-hover ease-hover motion-reduce:transition-none ${
              saved !== null ? 'left-[22px]' : 'left-[3px]'
            }`}
          />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditorOpen((open) => !open)
          }}
          className="inline-flex h-8 items-center rounded-button px-3.5 text-sm font-semibold text-inkMuted transition-colors duration-hover ease-hover hover:text-ink motion-reduce:transition-none"
        >
          Muuda
        </button>
      </div>
      <div hidden={!editorOpen} className="flex flex-col gap-2xs">
        <div className="flex flex-wrap items-center gap-2xs">
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
            className="h-8 w-24 min-w-0 rounded-input border border-border bg-bgPage px-2 font-mono text-bodySm text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              void handleSave()
            }}
            className="inline-flex h-8 items-center rounded-button bg-primary px-3.5 text-sm font-semibold text-inkInverse transition-colors duration-hover ease-hover hover:bg-primaryHover disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            {saved !== null ? 'Uuenda' : 'Määra'}
          </button>
          {saved !== null && (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => {
                void handleRemove()
              }}
              className="inline-flex h-8 items-center rounded-button border border-primary bg-transparent px-3.5 text-sm font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
            >
              Eemalda
            </button>
          )}
        </div>
        <p className="text-bodySm text-inkMuted">
          Vähim lubatud: {formatEurInput(floor)} €
        </p>
      </div>
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
