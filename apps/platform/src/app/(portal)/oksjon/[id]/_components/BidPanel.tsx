'use client'

import { Btn } from '@erametsad/ui'
import { ArrowRight, Clock, EyeOff, History, Hourglass, Info } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type KeyboardEvent, type SyntheticEvent } from 'react'

import { AlapakkumineToggle } from './AlapakkumineToggle'
import { AutobidderControl } from './AutobidderControl'
import { BidConfirmModal } from './BidConfirmModal'
import { GuestGateModal } from './GuestGateModal'

import { apiFetch } from '@/lib/api/client'
import type { AuctionObjectType, AuctionStatus } from '@/lib/data/schema'

// ── Public props contract ───────────────────────────────────────────────
// The dossier page mounts <BidPanel> into the sticky side rail and feeds it
// fields straight from getAuctionDossier. Every prop is serializable; no
// callbacks are required.

/** Per-viewer flags the dossier can derive server-side. `null` viewer = guest. */
export interface BidPanelViewerFlags {
  /** Viewer has at least one non-rejected bid on this auction. */
  hasBid: boolean
  /** Viewer's bid currently leads the auction. */
  isLeading: boolean
  /**
   * Bidding right for the auction's object type. `null` = not derivable
   * server-side; the panel then falls back to GET /api/v1/my/auction-rights.
   */
  hasRights: boolean | null
  /**
   * Signed raamleping. `null` = unknown; the API framework-contract gate
   * decides on submit and the panel redirects to the raamleping flow.
   */
  hasRaamleping: boolean | null
  /**
   * Server reports an active autobidder for the caller on this auction
   * (dossier `participation.hasAutobidder`). `null` = not derivable.
   */
  hasAutobidder?: boolean | null
  /**
   * Server snapshot of the caller's own `pending_approval` (alapakkumine)
   * bid on this auction (dossier `participation.hasPendingUnderStart`), so
   * the pending chip survives a reload. Defaults to false when the page
   * cannot derive it; the in-session pending state ORs on top.
   */
  hasPendingUnderStart?: boolean | null
  /**
   * The caller's autobidder row when the page can supply it. Without the
   * row the control falls back to the POST upsert and hides "Eemalda".
   */
  autobidderId?: string | null
  autobidderMaxAmount?: number | null
}

/** Input for the default bid submission (POST /api/v1/bids/create contract). */
export interface BidSubmitInput {
  auctionId: string
  /** Bid amount in EUR. */
  amount: number
  type: 'open' | 'sealed'
}

export type BidSubmitOutcome =
  | { status: 'leading'; amount: number }
  | { status: 'pending_approval'; amount: number }
  | { status: 'framework_contract_required' }
  | { status: 'no_rights' }
  | { status: 'unauthenticated' }
  | { status: 'rejected'; message: string }

export interface BidPanelProps {
  auctionId: string
  objectType: AuctionObjectType
  status: AuctionStatus
  startsAt: string | null
  endsAt: string | null
  /** Start price (alghind) in EUR. */
  minBid: number
  /** Bid step (pakkumise samm) in EUR; `null` when the auction defines no step. */
  bidStep: number | null
  /** Current leading bid in EUR; `null` when there are no bids or the viewer is a guest. */
  leadingBidAmount: number | null
  /** Final price in EUR, rendered on the ended panel. */
  finalPrice: number | null
  /**
   * Settings-level anti_snipe_duration_minutes. A positive value shows the
   * auto-extension notice; 0 or null hides it. The auctions table carries no
   * per-auction anti-snipe field, so the page passes the settings value.
   */
  antiSnipeMinutes: number | null
  /** `null` renders the guest panel. */
  viewer: BidPanelViewerFlags | null
  /**
   * Disclosed bid count for the "Pakkumisi" row; `null`/undefined collapses
   * the count. LiveBidPanel keeps it fresh from the bid:created stream.
   */
  bidCount?: number | null
  /**
   * True while a live anti-snipe extension is being announced (demo snipe
   * banner). LiveBidPanel raises it on auction:extended and clears it.
   */
  extendedNotice?: boolean
  /**
   * Settings-level alapakkumineEnabled flag. `true` renders the under-start
   * toggle; a toggled-on submission below minBid then pends for the seller
   * (API outcome `pending_approval`).
   */
  allowUnderStart?: boolean
  /**
   * Replaces the default POST /api/v1/bids/create call.
   * Must only run after the confirm modal resolves.
   */
  onSubmitBid?: (input: BidSubmitInput) => Promise<BidSubmitOutcome>
}

// ── Formatting / parsing ────────────────────────────────────────────────

function eur(value: number): string {
  return value.toLocaleString('et-EE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
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

/** Smallest amount the next bid may carry: leading bid + step, or the start price. */
export function minimumNextAmount(
  minBid: number,
  bidStep: number | null,
  leadingBidAmount: number | null,
): number {
  return leadingBidAmount !== null ? leadingBidAmount + (bidStep ?? 0) : minBid
}

export type BidAmountValidation =
  | { ok: true; amount: number }
  | { ok: false; message: string }

/** Client-side amount gate: parse the input and enforce the current minimum. */
export function validateBidAmount(
  raw: string,
  minBid: number,
  minimumNext: number,
  underbidRequested: boolean,
  allowUnderStart: boolean,
): BidAmountValidation {
  const amount = parseAmount(raw)
  if (amount === null || amount <= 0) {
    return { ok: false, message: 'Sisesta korrektne summa eurodes.' }
  }
  const isUnderStart = amount < minBid
  const underStartAllowed = allowUnderStart && underbidRequested && isUnderStart
  if (amount < minimumNext && !underStartAllowed) {
    return {
      ok: false,
      message: `Pakkumine peab olema vähemalt ${inputAmount(minimumNext)} €.`,
    }
  }
  return { ok: true, amount }
}

function fmtDateTime(iso: string): string | null {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleString('et-EE', { dateStyle: 'long', timeStyle: 'short' })
}

/** Demo D.M.YYYY kell HH:MM end line (02-lot-detail-open.html .ends-at). */
function fmtEndLine(iso: string): string | null {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  const date = new Date(time)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(date.getDate())}.${String(date.getMonth() + 1)}.${String(
    date.getFullYear(),
  )} kell ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// The raamleping flow page (task 6.6) renders ?message= above its form.
const RAAMLEPING_GATE_MESSAGE =
  'Enampakkumise tegemiseks tuleb esmalt allkirjastada raamleping.'

function raamlepingUrl(auctionId: string): string {
  return (
    `/lepingud/raamleping?next=${encodeURIComponent(`/oksjon/${auctionId}`)}` +
    `&message=${encodeURIComponent(RAAMLEPING_GATE_MESSAGE)}`
  )
}

// ── Default API submission ──────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Maps known English engine messages to Estonian; unknown ones get a generic text. */
function apiErrorToEstonian(message: string): string {
  const minimumValue = /^Bid must be at least ([\d.]+) EUR$/.exec(message)?.[1]
  if (minimumValue) {
    return `Pakkumine peab olema vähemalt ${minimumValue} €.`
  }
  if (message === 'Auction has ended') return 'Oksjon on lõppenud.'
  if (message === 'Auction is not active') return 'Oksjon ei ole aktiivne.'
  if (message === 'User is suspended') return 'Sinu kasutaja konto on peatatud.'
  return 'Pakkumise esitamine ebaõnnestus. Proovi uuesti.'
}

async function submitBidViaApi(input: BidSubmitInput): Promise<BidSubmitOutcome> {
  let response: Response
  try {
    response = await apiFetch('/api/v1/bids/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        auctionId: input.auctionId,
        amount: input.amount,
        type: input.type,
        idempotencyKey: crypto.randomUUID(),
      }),
    })
  } catch {
    return { status: 'rejected', message: 'Võrguühendus puudub. Proovi uuesti.' }
  }

  const payload: unknown = await response.json().catch(() => null)

  if (response.status === 201) {
    const status =
      isRecord(payload) && typeof payload.status === 'string' ? payload.status : null
    if (status === 'leading') return { status: 'leading', amount: input.amount }
    if (status === 'pending_approval') {
      return { status: 'pending_approval', amount: input.amount }
    }
    return { status: 'rejected', message: 'Pakkumise esitamine ebaõnnestus.' }
  }

  const message =
    isRecord(payload) && typeof payload.error === 'string' ? payload.error : ''
  const code = isRecord(payload) && typeof payload.code === 'string' ? payload.code : null

  if (response.status === 401) return { status: 'unauthenticated' }
  if (response.status === 403 && code === 'framework_contract_required') {
    return { status: 'framework_contract_required' }
  }
  if (response.status === 403 && message.includes('No bidding right')) {
    return { status: 'no_rights' }
  }
  if (response.status === 409) {
    return { status: 'rejected', message: 'See pakkumine on juba esitatud.' }
  }
  return { status: 'rejected', message: apiErrorToEstonian(message) }
}

// ── Rights fallback (GET /api/v1/my/auction-rights, task 1.9) ───────────

function readRights(payload: unknown, objectType: string): boolean | null {
  if (!isRecord(payload) || !Array.isArray(payload.rights)) return null
  for (const entry of payload.rights) {
    if (
      isRecord(entry) &&
      entry.objectType === objectType &&
      typeof entry.granted === 'boolean'
    ) {
      return entry.granted
    }
  }
  return null
}

// ── Panel ───────────────────────────────────────────────────────────────

const ENDED_STATUSES: readonly AuctionStatus[] = [
  'ended',
  'appraised',
  'contract',
  'completed',
  'archived',
]

const PANEL_CLASSES =
  'flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card'

// Demo .info-chip (02-lot-detail-open.html .chip-row).
const CHIP_CLASSES =
  'inline-flex items-center gap-1.5 rounded-pill border border-border bg-bgMist px-3 py-1 text-xs font-semibold text-ink'

/** Chip for a bid accepted below the start price while the seller has not confirmed it. */
export function PendingApprovalChip() {
  return (
    <span className="inline-flex items-center self-start rounded-pill bg-statusEndingSoon/10 px-2 py-0.5 text-xs font-medium text-statusEndingSoon">
      Alapakkumine ootab müüja kinnitust
    </span>
  )
}

export function BidPanel({
  auctionId,
  objectType,
  status,
  startsAt,
  endsAt,
  minBid,
  bidStep,
  leadingBidAmount,
  finalPrice,
  antiSnipeMinutes,
  viewer,
  bidCount = null,
  extendedNotice = false,
  allowUnderStart = false,
  onSubmitBid,
}: BidPanelProps) {
  const router = useRouter()

  const [localLeading, setLocalLeading] = useState<number | null>(leadingBidAmount)
  const [localParticipation, setLocalParticipation] = useState<{
    hasBid: boolean
    isLeading: boolean
  } | null>(null)
  const [amountStr, setAmountStr] = useState('')
  const [modalAmount, setModalAmount] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successAmount, setSuccessAmount] = useState<number | null>(null)
  const [pendingAmount, setPendingAmount] = useState<number | null>(null)
  const [gateNotice, setGateNotice] = useState(false)
  const [fetchedRights, setFetchedRights] = useState<boolean | null>(null)
  const [underbidRequested, setUnderbidRequested] = useState(false)
  const [gateOpen, setGateOpen] = useState(false)

  const step = bidStep ?? 0
  const minimumNext = minimumNextAmount(minBid, bidStep, localLeading)

  useEffect(() => {
    setLocalLeading(leadingBidAmount)
  }, [leadingBidAmount])

  useEffect(() => {
    setAmountStr(inputAmount(minimumNext))
  }, [minimumNext])

  const rightsUnknown = viewer !== null && viewer.hasRights === null
  useEffect(() => {
    if (!rightsUnknown) return
    const controller = new AbortController()
    void (async () => {
      try {
        const response = await apiFetch('/api/v1/my/auction-rights', {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('auction-rights fetch failed')
        setFetchedRights(readRights(await response.json(), objectType))
      } catch {
        // Aborted or failed lookups leave hasRights unknown; the API gate
        // still decides on submit.
      }
    })()
    return () => {
      controller.abort()
    }
  }, [rightsUnknown, objectType])

  // ── Shared demo fragments ─────────────────────────────────────────────

  // Demo .ends-at line; guests see the rail exactly like bidders.
  const endLine =
    endsAt !== null && status === 'active' ? fmtEndLine(endsAt) : null
  const displayPrice = localLeading ?? minBid

  const priceBlock = (
    <>
      {endLine !== null && (
        <p className="flex items-center gap-2 text-xs text-inkMuted">
          <Clock className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
          <span>
            Oksjon lõppeb{' '}
            <span className="font-mono">{endLine}</span>
          </span>
        </p>
      )}
      <div className="flex flex-wrap items-end justify-between gap-xs">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-[0.03em] text-inkMuted">
            Hetke hind
          </span>
          <span className="block font-mono text-[2rem] font-semibold leading-[1.15] text-primaryDark">
            {eur(displayPrice)}
          </span>
        </div>
        {bidCount !== null && (
          <span className="text-bodySm text-inkMuted">
            Pakkumisi: <span className="font-mono">{String(bidCount)}</span>
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {bidStep !== null && (
          <span className={CHIP_CLASSES}>
            {'Samm: '}
            <span className="font-mono">{eur(bidStep)}</span>
          </span>
        )}
        <span className={CHIP_CLASSES}>
          <EyeOff className="h-3 w-3 text-primary" aria-hidden="true" />
          Anonüümsed pakkujad
        </span>
      </div>
      <p className="m-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-button bg-primaryLight px-4 py-3 text-bodySm font-semibold text-primaryHover">
        <span>Järgmine lubatud pakkumine</span>
        <span className="font-mono text-lg">{inputAmount(minimumNext)} €</span>
      </p>
    </>
  )

  // ── Panel states: unsold / ended ──────────────────────────────────────

  if (status === 'unsold') {
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Oksjon jäi müümata</h2>
      </section>
    )
  }

  if (ENDED_STATUSES.includes(status)) {
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Oksjon on lõppenud</h2>
        {finalPrice !== null && (
          <p className="text-body text-inkMuted">
            Lõpphind: <span className="font-semibold text-ink">{eur(finalPrice)}</span>
          </p>
        )}
      </section>
    )
  }

  // ── Panel states: not started ─────────────────────────────────────────

  if (status === 'scheduled' || status === 'draft') {
    const startsAtLabel = startsAt !== null ? fmtDateTime(startsAt) : null
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Pakkumine</h2>
        <p className="text-body text-inkMuted">Oksjon pole veel alanud.</p>
        {startsAtLabel !== null && (
          <p className="text-body text-ink">Oksjon algab: {startsAtLabel}</p>
        )}
      </section>
    )
  }

  // ── Panel states: guest (demo gate modal on submit) ───────────────────

  if (viewer === null) {
    function openGuestGate(event: SyntheticEvent): void {
      event.preventDefault()
      setError(null)
      const validation = validateBidAmount(amountStr, minBid, minimumNext, false, false)
      if (!validation.ok) {
        setError(validation.message)
        return
      }
      setGateOpen(true)
    }

    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Pakkumine</h2>
        <p className="text-body text-inkMuted">
          Logi sisse pakkumise tegemiseks.{' '}
          <Link
            href={`/login?next=${encodeURIComponent(`/oksjon/${auctionId}`)}`}
            className="font-semibold text-primary hover:text-primaryHover"
          >
            Logi sisse
          </Link>
        </p>
        {priceBlock}
        <form onSubmit={openGuestGate} className="flex flex-col gap-xs">
          <label htmlFor="bid-amount" className="text-label font-semibold text-ink">
            Sinu pakkumine (€)
          </label>
          <div className="flex items-stretch gap-xs">
            <button
              type="button"
              aria-label="Vähenda pakkumist sammu võrra"
              disabled={step <= 0}
              onClick={() => {
                const current = parseAmount(amountStr)
                setAmountStr(inputAmount(current === null ? minimumNext : current - step))
              }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input border border-border bg-bgMist text-body text-ink transition-colors hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <input
              id="bid-amount"
              name="amount"
              inputMode="decimal"
              autoComplete="off"
              value={amountStr}
              onChange={(event) => {
                setAmountStr(event.target.value)
                setError(null)
              }}
              aria-invalid={error !== null}
              className="h-12 w-full min-w-0 rounded-input border border-border bg-bgPage px-4 font-mono text-lg text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              aria-label="Suurenda pakkumist sammu võrra"
              disabled={step <= 0}
              onClick={() => {
                const current = parseAmount(amountStr)
                setAmountStr(inputAmount(current === null ? minimumNext : current + step))
              }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input border border-border bg-bgMist text-body text-ink transition-colors hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-40"
            >
              +
            </button>
          </div>
          {error !== null && (
            <p role="alert" className="text-bodySm text-danger">
              {error}
            </p>
          )}
          <div className="[&>button]:w-full">
            <Btn type="submit" variant="cta">
              Esita pakkumine
            </Btn>
          </div>
        </form>
        <GuestGateModal
          isOpen={gateOpen}
          onClose={() => {
            setGateOpen(false)
          }}
          auctionId={auctionId}
        />
      </section>
    )
  }

  // ── Panel states: logged in without bidding rights ────────────────────

  const hasRights = viewer.hasRights ?? fetchedRights
  if (hasRights === false) {
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Pakkumine</h2>
        <p className="text-body text-inkMuted">
          Sul puuduvad õigused teha selle tüübi oksjonil pakkumisi.
        </p>
        <p className="text-bodySm text-inkMuted">
          Kirjuta info@erametsad.ee õiguste saamiseks.
        </p>
      </section>
    )
  }

  // ── Active auction: bid form ──────────────────────────────────────────

  const isLeadingBidder = localParticipation?.isLeading ?? viewer.isLeading
  const hasOwnBid = localParticipation?.hasBid ?? viewer.hasBid
  const existingAutobidder =
    typeof viewer.autobidderId === 'string' &&
    typeof viewer.autobidderMaxAmount === 'number'
      ? { id: viewer.autobidderId, maxAmount: viewer.autobidderMaxAmount }
      : null
  const hasAutobidder = existingAutobidder !== null || viewer.hasAutobidder === true
  // Pending alapakkumine chip: server snapshot OR a bid pended in-session.
  const hasPendingBid = pendingAmount !== null || viewer.hasPendingUnderStart === true

  function openConfirm(event: SyntheticEvent): void {
    event.preventDefault()
    setError(null)
    setSuccessAmount(null)
    setPendingAmount(null)
    setGateNotice(false)
    const validation = validateBidAmount(
      amountStr,
      minBid,
      minimumNext,
      underbidRequested,
      allowUnderStart,
    )
    if (!validation.ok) {
      setError(validation.message)
      return
    }
    // No API call here: the fetch happens only when the modal confirms.
    setModalAmount(validation.amount)
  }

  async function confirmBid(): Promise<void> {
    if (modalAmount === null || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    let outcome: BidSubmitOutcome
    try {
      const submit = onSubmitBid ?? submitBidViaApi
      outcome = await submit({ auctionId, amount: modalAmount, type: 'open' })
    } catch {
      outcome = { status: 'rejected', message: 'Pakkumise esitamine ebaõnnestus. Proovi uuesti.' }
    }
    setIsSubmitting(false)
    setModalAmount(null)
    switch (outcome.status) {
      case 'leading':
        setLocalLeading(outcome.amount)
        setLocalParticipation({ hasBid: true, isLeading: true })
        setSuccessAmount(outcome.amount)
        router.refresh()
        break
      case 'pending_approval':
        setLocalParticipation({ hasBid: true, isLeading: false })
        setPendingAmount(outcome.amount)
        router.refresh()
        break
      case 'framework_contract_required':
        setGateNotice(true)
        router.push(raamlepingUrl(auctionId))
        break
      case 'no_rights':
        setFetchedRights(false)
        break
      case 'unauthenticated':
        setError('Sessioon on aegunud. Logi uuesti sisse.')
        break
      case 'rejected':
        setError(outcome.message)
        break
    }
  }

  function applyStep(direction: 1 | -1): void {
    const current = parseAmount(amountStr)
    if (current === null) {
      setAmountStr(inputAmount(minimumNext))
      return
    }
    const next = current + direction * step
    if (next <= 0) return
    setAmountStr(inputAmount(next))
  }

  function handleAmountKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (step <= 0 || isSubmitting) return
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    applyStep(event.key === 'ArrowUp' ? 1 : -1)
  }

  return (
    <section className={PANEL_CLASSES}>
      {extendedNotice && (
        <p
          role="status"
          className="m-0 flex items-start gap-2 rounded-button bg-infoLight px-3.5 py-2.5 text-bodySm font-medium text-info"
        >
          <History className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
          Oksjoni lõppu pikendati {String(antiSnipeMinutes ?? 5)} minuti võrra.
        </p>
      )}

      {priceBlock}

      {localLeading === null && (
        <p className="text-bodySm text-inkMuted">
          Pakkumisi veel pole. Esita esimene pakkumine.
        </p>
      )}

      {isLeadingBidder ? (
        <span className="inline-flex items-center self-start rounded-pill bg-primaryLight px-2 py-0.5 text-xs font-medium text-primaryDark">
          Sinu pakkumine on juhtiv
        </span>
      ) : hasOwnBid ? (
        <span className="inline-flex items-center self-start rounded-pill bg-bgMist px-2 py-0.5 text-xs font-medium text-inkMuted">
          Oled pakkumise esitanud
        </span>
      ) : null}

      {hasPendingBid && <PendingApprovalChip />}

      <form onSubmit={openConfirm} className="flex flex-col gap-xs">
        <label htmlFor="bid-amount" className="text-label font-semibold text-ink">
          Sinu pakkumine (€)
        </label>
        <div className="flex items-stretch gap-xs">
          <button
            type="button"
            aria-label="Vähenda pakkumist sammu võrra"
            disabled={step <= 0 || isSubmitting}
            onClick={() => {
              applyStep(-1)
            }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input border border-border bg-bgMist text-body text-ink transition-colors hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <input
            id="bid-amount"
            name="amount"
            inputMode="decimal"
            autoComplete="off"
            value={amountStr}
            onChange={(event) => {
              setAmountStr(event.target.value)
              setError(null)
            }}
            onKeyDown={handleAmountKeyDown}
            aria-invalid={error !== null}
            className="h-12 w-full min-w-0 rounded-input border border-border bg-bgPage px-4 font-mono text-lg text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="button"
            aria-label="Suurenda pakkumist sammu võrra"
            disabled={step <= 0 || isSubmitting}
            onClick={() => {
              applyStep(1)
            }}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-input border border-border bg-bgMist text-body text-ink transition-colors hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
        {allowUnderStart && (
          <AlapakkumineToggle
            checked={underbidRequested}
            onChange={(checked) => {
              setUnderbidRequested(checked)
              setError(null)
            }}
            disabled={isSubmitting}
          />
        )}
        {error !== null && (
          <p role="alert" className="text-bodySm text-danger">
            {error}
          </p>
        )}
        {successAmount !== null && (
          <p
            role="status"
            className="rounded-input bg-bgMist px-xs py-2xs text-bodySm text-ink"
          >
            Pakkumine {eur(successAmount)} esitatud.
          </p>
        )}
        {pendingAmount !== null && (
          <p
            role="status"
            className="rounded-input bg-bgMist px-xs py-2xs text-bodySm text-ink"
          >
            Alapakkumine {eur(pendingAmount)} ootab müüja kinnitust.
          </p>
        )}
        {gateNotice && (
          <p role="alert" className="text-bodySm text-danger">
            {RAAMLEPING_GATE_MESSAGE}{' '}
            <Link
              href={raamlepingUrl(auctionId)}
              className="font-semibold text-primary hover:text-primaryHover"
            >
              Ava raamleping
            </Link>
          </p>
        )}
        <div className="[&>button]:w-full">
          <Btn type="submit" variant="cta" isLoading={isSubmitting}>
            Esita pakkumine
          </Btn>
        </div>
      </form>

      <AutobidderControl
        auctionId={auctionId}
        minBid={minBid}
        bidStep={bidStep}
        currentLeading={localLeading}
        existing={existingAutobidder}
        hasAutobidder={hasAutobidder}
      />

      {antiSnipeMinutes !== null && antiSnipeMinutes > 0 && (
        <p className="m-0 flex items-start gap-2 text-xs text-inkMuted">
          <Hourglass className="mt-0.5 h-3 w-3 flex-none text-info" aria-hidden="true" />
          Uus pakkumine pikendab oksjoni lõpuaega {String(antiSnipeMinutes)} minuti
          võrra.
        </p>
      )}

      {viewer.hasRaamleping === false && (
        <p className="text-bodySm text-statusEndingSoon">{RAAMLEPING_GATE_MESSAGE}</p>
      )}

      {/* Fee display follows the active-auction rule: no amounts until won. */}
      <p className="m-0 flex items-start gap-2 border-t border-dashed border-border pt-3 text-xs text-inkMuted">
        <Info className="mt-0.5 h-3 w-3 flex-none" aria-hidden="true" />
        Teenustasu rakendub vaid oksjoni võitmise korral
      </p>

      <Link
        href="/tingimused"
        className="group inline-flex items-center gap-1.5 text-bodySm font-semibold text-primary transition-colors hover:text-primaryHover"
      >
        Oksjoni reeglid ja tingimused
        <ArrowRight
          className="h-3 w-3 transition-transform duration-hover group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>

      <BidConfirmModal
        isOpen={modalAmount !== null}
        onClose={() => {
          setModalAmount(null)
        }}
        amount={modalAmount ?? 0}
        nextStepAmount={step > 0 ? modalAmount !== null ? modalAmount + step : null : null}
        requiresSellerApproval={
          modalAmount !== null && underbidRequested && modalAmount < minBid
        }
        isSubmitting={isSubmitting}
        onConfirm={() => {
          void confirmBid()
        }}
      />
    </section>
  )
}
