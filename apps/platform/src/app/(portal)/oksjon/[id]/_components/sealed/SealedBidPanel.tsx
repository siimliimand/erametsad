'use client'

import { Btn, Modal } from '@erametsad/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type SyntheticEvent } from 'react'

import {
  SealedIdentityForm,
  identityAddressErrorMessage,
  identityCodeErrorMessage,
  identityEmailErrorMessage,
  identityNameErrorMessage,
  identityPhoneErrorMessage,
  sealedIdentitySnapshot,
  validateEmail,
  validateIdentityCode,
  type SealedIdentityErrors,
  type SealedIdentityValues,
  type SealedProfileType,
} from './SealedIdentityForm'

import type { AuctionStatus } from '@/lib/data/schema'

// ── Public props contract ───────────────────────────────────────────────
// The dossier page mounts <SealedBidPanel> for every sealed auction and
// feeds it fields from getAuctionDossier plus a server-built viewer
// snapshot (own sealed bids, revision cap, identity prefill). Amounts and
// timestamps of OTHER bidders never reach this component: sealed disclosure
// is the bid count only, until the admin opening ceremony.

export type SealedOutcome = 'won' | 'lost'

/** Server-derived snapshot for the signed-in viewer; `null` = guest. */
export interface SealedViewerSnapshot {
  profileType: SealedProfileType
  displayName: string | null
  /** Decoded own isikukood for prefill; `null` when unknown. */
  isikukood: string | null
  registrikood: string | null
  /** Profile contact fields for prefill; optional until the server snapshot supplies them. */
  address?: string | null
  email?: string | null
  phone?: string | null
  /** Settings.sealedRevisionCap: allowed revisions on top of the original bid. */
  revisionCap: number
  /** Viewer's non-rejected sealed bids on this auction. */
  ownBidCount: number
  /** createdAt of the viewer's latest sealed bid (ISO), `null` when none. */
  latestSubmittedAt: string | null
  /** Opening-ceremony result; `null` until the ceremony resolves. */
  outcome: SealedOutcome | null
}

export interface SealedBidPanelProps {
  auctionId: string
  status: AuctionStatus
  startsAt: string | null
  endsAt: string | null
  /** Start price (alghind) in EUR; the only price level sealed auctions disclose. */
  minBid: number
  /** Disclosed bid count while the auction has not ended; `null` afterwards. */
  bidCount: number | null
  /** Final price in EUR once the opening ceremony has confirmed a winner. */
  finalPrice: number | null
  viewer: SealedViewerSnapshot | null
}

interface SealedSubmitOutcome {
  ok: boolean
  message: string | null
  /** True when the API rejected the revision because the cap is exhausted. */
  capExceeded?: boolean
}

// ── Formatting / parsing (mirrors BidPanel conventions) ─────────────────

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

function fmtDateTime(iso: string): string | null {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  return new Date(time).toLocaleString('et-EE', { dateStyle: 'long', timeStyle: 'short' })
}

// ── API submission (POST /api/v1/bids/create contract) ──────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/** Maps known English engine messages to Estonian; the revision-cap message is already Estonian. */
function sealedApiErrorToEstonian(message: string): string {
  const minimumValue = /^Bid must be at least ([\d.]+) EUR$/.exec(message)?.[1]
  if (minimumValue) {
    return `Pakkumine peab olema vähemalt ${minimumValue} €.`
  }
  if (message === 'Auction has ended') return 'Oksjon on lõppenud.'
  if (message === 'Auction is not active') return 'Oksjon ei ole aktiivne.'
  if (message === 'User is suspended') return 'Sinu kasutaja konto on peatatud.'
  if (message.startsWith('Lukspakkumuste limiit')) return message
  return 'Pakkumise esitamine ebaõnnestus. Proovi uuesti.'
}

async function submitSealedBidViaApi(input: {
  auctionId: string
  amount: number
  identitySnapshot: string
}): Promise<SealedSubmitOutcome> {
  let response: Response
  try {
    response = await fetch('/api/v1/bids/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        auctionId: input.auctionId,
        amount: input.amount,
        type: 'sealed',
        idempotencyKey: crypto.randomUUID(),
        identitySnapshot: input.identitySnapshot,
      }),
    })
  } catch {
    return { ok: false, message: 'Võrguühendus puudub. Proovi uuesti.' }
  }

  const payload: unknown = await response.json().catch(() => null)
  if (response.status === 201 && isRecord(payload)) {
    return { ok: true, message: null }
  }

  const message =
    isRecord(payload) && typeof payload.error === 'string' ? payload.error : ''
  const code =
    isRecord(payload) && typeof payload.code === 'string' ? payload.code : ''
  if (code === 'revision_cap_exceeded') {
    return {
      ok: false,
      capExceeded: true,
      message:
        'Täienduspakkumiste limiit on täis. Rohkem muudatusi ei ole võimalik teha.',
    }
  }
  if (response.status === 401) {
    return { ok: false, message: 'Sessioon on aegunud. Logi uuesti sisse.' }
  }
  if (response.status === 403 && message.includes('No bidding right')) {
    return {
      ok: false,
      message: 'Sul ei ole õigust selle objektitüübi pakkumiste tegemiseks.',
    }
  }
  if (response.status === 409) {
    return { ok: false, message: 'See pakkumine on juba esitatud.' }
  }
  return { ok: false, message: sealedApiErrorToEstonian(message) }
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

export function SealedBidPanel({
  auctionId,
  status,
  startsAt,
  endsAt,
  minBid,
  bidCount,
  finalPrice,
  viewer,
}: SealedBidPanelProps) {
  const router = useRouter()

  const [amountStr, setAmountStr] = useState('')
  const [identity, setIdentity] = useState<SealedIdentityValues>({
    name: viewer?.displayName ?? '',
    code: viewer?.profileType === 'company'
      ? (viewer.registrikood ?? '')
      : (viewer?.isikukood ?? ''),
    address: viewer?.address ?? '',
    email: viewer?.email ?? '',
    phone: viewer?.phone ?? '',
  })
  const [errors, setErrors] = useState<SealedIdentityErrors>({
    name: null,
    code: null,
    address: null,
    email: null,
    phone: null,
  })
  const [amountError, setAmountError] = useState<string | null>(null)
  const [modalAmount, setModalAmount] = useState<number | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // `amount` is known only in-session; after a reload the panel masks the
  // amount as unknown (••••) because sealed amounts never round-trip.
  const [lastSubmission, setLastSubmission] = useState<{
    amount: number | null
    at: string
  } | null>(
    viewer !== null && viewer.ownBidCount > 0
      ? { amount: null, at: viewer.latestSubmittedAt ?? '' }
      : null,
  )
  const [revising, setRevising] = useState(false)
  // Set when the API answers `revision_cap_exceeded`: the form locks for the
  // rest of the session because no further revision can be accepted.
  const [isCapLocked, setIsCapLocked] = useState(false)

  const isUnsold = status === 'unsold'
  const isEnded = ENDED_STATUSES.includes(status)
  const isActive = status === 'active'
  const isScheduled = status === 'scheduled'
  const participant = viewer !== null && viewer.ownBidCount > 0
  const remainingRevisions =
    viewer === null ? 0 : viewer.revisionCap + 1 - viewer.ownBidCount
  const isLocked = isActive && participant && !revising

  function openConfirm(event: SyntheticEvent): void {
    event.preventDefault()
    if (isCapLocked) return
    const nextErrors: SealedIdentityErrors = {
      name: null,
      code: null,
      address: null,
      email: null,
      phone: null,
    }
    if (viewer !== null && identity.name.trim() === '') {
      nextErrors.name = identityNameErrorMessage(viewer.profileType)
    }
    if (viewer !== null && !validateIdentityCode(viewer.profileType, identity.code.trim())) {
      nextErrors.code = identityCodeErrorMessage(viewer.profileType)
    }
    if (viewer !== null && identity.address.trim() === '') {
      nextErrors.address = identityAddressErrorMessage()
    }
    if (viewer !== null && !validateEmail(identity.email.trim())) {
      nextErrors.email = identityEmailErrorMessage()
    }
    if (viewer !== null && identity.phone.trim() === '') {
      nextErrors.phone = identityPhoneErrorMessage()
    }
    setErrors(nextErrors)

    const amount = parseAmount(amountStr)
    if (amount === null || amount <= 0) {
      setAmountError('Sisesta korrektne summa eurodes.')
      return
    }
    if (amount < minBid) {
      setAmountError(`Pakkumine peab olema vähemalt ${inputAmount(minBid)} €.`)
      return
    }
    if (
      nextErrors.name !== null ||
      nextErrors.code !== null ||
      nextErrors.address !== null ||
      nextErrors.email !== null ||
      nextErrors.phone !== null
    ) {
      return
    }
    // No API call here: the fetch happens only when the modal confirms.
    setModalAmount(amount)
  }

  async function confirmBid(): Promise<void> {
    if (modalAmount === null || isSubmitting || viewer === null) return
    setIsSubmitting(true)
    const outcome = await submitSealedBidViaApi({
      auctionId,
      amount: modalAmount,
      identitySnapshot: sealedIdentitySnapshot(viewer.profileType, {
        name: identity.name.trim(),
        code: identity.code.trim(),
        address: identity.address.trim(),
        email: identity.email.trim(),
        phone: identity.phone.trim(),
      }),
    })
    setIsSubmitting(false)
    setModalAmount(null)
    if (!outcome.ok) {
      // Keep `revising` as-is so the locked form stays visible with the cap
      // message; switching to the submitted card would hide it.
      if (outcome.capExceeded === true) setIsCapLocked(true)
      setAmountError(outcome.message)
      return
    }
    setLastSubmission({ amount: modalAmount, at: new Date().toISOString() })
    setRevising(false)
    setAmountError(null)
    router.refresh()
  }

  // ── Guest ─────────────────────────────────────────────────────────────

  if (viewer === null) {
    if (isUnsold || isEnded) {
      return (
        <section className={PANEL_CLASSES}>
          <h2 className="font-heading text-h4 text-ink">
            {isUnsold ? 'Oksjon jäi müümata' : 'Oksjon on lõppenud'}
          </h2>
          {!isUnsold && finalPrice !== null && (
            <p className="text-body text-inkMuted">
              Lõpphind: <span className="font-semibold text-ink">{eur(finalPrice)}</span>
            </p>
          )}
        </section>
      )
    }
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Suletud pakkumine</h2>
        {bidCount !== null && (
          <p className="text-bodySm text-inkMuted">Pakkumisi: {String(bidCount)}</p>
        )}
        {isScheduled ? (
          <p className="text-body text-inkMuted">Oksjon pole veel alanud.</p>
        ) : (
          <p className="text-body text-inkMuted">Logi sisse pakkumise tegemiseks.</p>
        )}
        <Link
          href={`/login?next=${encodeURIComponent(`/oksjon/${auctionId}`)}`}
          className="inline-flex h-10 items-center justify-center rounded-button bg-primary px-4 font-label font-semibold text-inkInverse transition-colors hover:bg-primaryHover md:w-auto"
        >
          Logi sisse
        </Link>
      </section>
    )
  }

  // ── Unsold ────────────────────────────────────────────────────────────

  if (isUnsold) {
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Oksjon jäi müümata</h2>
        <p className="text-bodySm text-inkMuted">
          Müüja ei kinnitanud müüki. Sinu pakkumise andmed arhiveeritakse.
        </p>
      </section>
    )
  }

  // ── Post-opening result states ────────────────────────────────────────

  if (isEnded) {
    if (viewer.outcome === 'won') {
      return (
        <section className={PANEL_CLASSES}>
          <h2 className="font-heading text-h4 text-ink">
            Palju õnne! Sinu pakkumine osutus edukaimaks.
          </h2>
          {finalPrice !== null && (
            <p className="text-body text-inkMuted">
              Lõpphind: <span className="font-semibold text-ink">{eur(finalPrice)}</span>
            </p>
          )}
          <Link
            href={`/lepingud/oksjonileping/${auctionId}`}
            className="text-bodySm font-semibold text-primary hover:text-primaryHover"
          >
            Vaata oksjonilepingut ›
          </Link>
        </section>
      )
    }
    if (viewer.outcome === 'lost') {
      return (
        <section className={PANEL_CLASSES}>
          <h2 className="font-heading text-h4 text-ink">
            Sinu pakkumine ei olnud edukaim
          </h2>
        </section>
      )
    }
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Oksjon on lõppenud</h2>
        {participant && finalPrice === null ? (
          <p className="text-body text-inkMuted">
            Pakkumised avatakse üheaegselt. Teavitame sind tulemusest.
          </p>
        ) : (
          finalPrice !== null && (
            <p className="text-body text-inkMuted">
              Lõpphind: <span className="font-semibold text-ink">{eur(finalPrice)}</span>
            </p>
          )
        )}
      </section>
    )
  }

  // ── Scheduled ─────────────────────────────────────────────────────────

  if (isScheduled) {
    const startsAtLabel = startsAt !== null ? fmtDateTime(startsAt) : null
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Suletud pakkumine</h2>
        {bidCount !== null && (
          <p className="text-bodySm text-inkMuted">Pakkumisi: {String(bidCount)}</p>
        )}
        <p className="text-body text-inkMuted">Oksjon pole veel alanud.</p>
        {startsAtLabel !== null && (
          <p className="text-body text-ink">Oksjon algab: {startsAtLabel}</p>
        )}
      </section>
    )
  }

  // ── Active: locked card after submission ──────────────────────────────

  if (isLocked && lastSubmission !== null) {
    const submittedLabel =
      lastSubmission.at !== '' ? fmtDateTime(lastSubmission.at) : null
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Pakkumine on esitatud</h2>
        <div className="flex items-baseline justify-between gap-sm rounded-input bg-bgMist px-sm py-xs">
          <span className="text-bodySm text-inkMuted">Summa</span>
          {lastSubmission.amount !== null ? (
            <span
              aria-label="Summa on peidetud kuni pakkumiste avamiseni"
              className="font-heading text-h3 text-ink"
            >
              <span aria-hidden="true" className="select-none blur-sm">
                {eur(lastSubmission.amount)}
              </span>
            </span>
          ) : (
            <span className="font-heading text-h3 text-ink">•••• €</span>
          )}
        </div>
        {submittedLabel !== null && (
          <p className="text-bodySm text-inkMuted">Esitatud: {submittedLabel}</p>
        )}
        <p className="text-bodySm text-inkMuted">
          Summa avatakse koos teiste pakkumistega pärast pakkumisaja lõppu.
        </p>
        {remainingRevisions > 0 ? (
          <>
            <p className="text-bodySm text-inkMuted">
              Täienduspakkumisi jäänud: {String(remainingRevisions)}
            </p>
            <Btn
              variant="outline"
              onClick={() => {
                setRevising(true)
                if (lastSubmission.amount !== null) {
                  setAmountStr(inputAmount(lastSubmission.amount))
                }
              }}
            >
              Muuda pakkumist
            </Btn>
          </>
        ) : (
          <p className="text-bodySm text-inkMuted">
            Täienduspakkumiste limiit on täis.
          </p>
        )}
      </section>
    )
  }

  // ── Active: bid form ──────────────────────────────────────────────────

  const endsAtLabel = endsAt !== null ? fmtDateTime(endsAt) : null

  return (
    <section className={PANEL_CLASSES}>
      <h2 className="font-heading text-h4 text-ink">Suletud pakkumine</h2>
      {bidCount !== null && (
        <p className="text-bodySm text-inkMuted">Pakkumisi: {String(bidCount)}</p>
      )}

      <div>
        <p className="text-label text-inkMuted">Alghind</p>
        <p className="font-heading text-h3 text-ink">{eur(minBid)}</p>
      </div>
      {endsAtLabel !== null && (
        <p className="text-bodySm text-inkMuted">Pakkumisaeg lõpeb: {endsAtLabel}</p>
      )}

      <div className="flex flex-col gap-2xs rounded-card bg-bgMist p-xs">
        <p className="text-bodySm text-inkMuted">
          Kõik saabunud pakkumised avatakse üheaegselt pärast pakkumisaja lõppu.
          Pakkumiste summasid ja pakkujate isikuandmeid ei avaldata enne avamist.
          Esitatud pakkumine on siduv ning seda ei saa tagasi võtta. Võrdsete
          pakkumiste korral loetakse võitjaks varasemalt esitanud pakkuja.
        </p>
      </div>

      <form onSubmit={openConfirm} className="flex flex-col gap-xs">
        <label htmlFor="sealed-bid-amount" className="text-label font-semibold text-ink">
          Sinu pakkumine (€)
        </label>
        <input
          id="sealed-bid-amount"
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          value={amountStr}
          disabled={isCapLocked}
          onChange={(event) => {
            setAmountStr(event.target.value)
            setAmountError(null)
          }}
          aria-invalid={amountError !== null}
          className="h-12 w-full rounded-input border border-border bg-bgPage px-4 text-body text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-bgMist disabled:text-inkMuted"
        />
        <p className="text-bodySm text-inkMuted">
          Vähim lubatud pakkumine: {inputAmount(minBid)} €
        </p>

        <SealedIdentityForm
          profileType={viewer.profileType}
          values={identity}
          onChange={setIdentity}
          errors={errors}
          disabled={isCapLocked}
        />

        {amountError !== null && (
          <p role="alert" className="text-bodySm text-danger">
            {amountError}
          </p>
        )}

        <Btn type="submit" isLoading={isSubmitting} disabled={isCapLocked}>
          {participant ? 'Esita täienduspakkumine' : 'Esita pakkumine'}
        </Btn>
        {participant && !isCapLocked && (
          <button
            type="button"
            className="text-bodySm font-semibold text-primary hover:text-primaryHover"
            onClick={() => {
              setRevising(false)
              setErrors({
                name: null,
                code: null,
                address: null,
                email: null,
                phone: null,
              })
              setAmountError(null)
            }}
          >
            Katkesta muutmine
          </button>
        )}
      </form>

      <BidConfirmModal
        isOpen={modalAmount !== null}
        onClose={() => {
          setModalAmount(null)
        }}
        amount={modalAmount ?? 0}
        isRevision={participant}
        isSubmitting={isSubmitting}
        onConfirm={() => {
          void confirmBid()
        }}
      />
    </section>
  )
}

// ── Siduv confirm modal ─────────────────────────────────────────────────
// The API call fires only from onConfirm, after the bidder has seen the
// binding statement and the hidden-until-opening notice.

interface BidConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  isRevision: boolean
  isSubmitting: boolean
  onConfirm: () => void
}

function BidConfirmModal({
  isOpen,
  onClose,
  amount,
  isRevision,
  isSubmitting,
  onConfirm,
}: BidConfirmModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isSubmitting ? () => undefined : onClose}
      title="Kinnita siduv pakkumine"
      size="sm"
    >
      <div className="flex flex-col gap-sm">
        <div className="flex items-baseline justify-between gap-sm rounded-input bg-bgMist px-sm py-xs">
          <span className="text-bodySm text-inkMuted">Pakkumise summa</span>
          <span className="font-heading text-h3 text-ink">{eur(amount)}</span>
        </div>
        {isRevision && (
          <p className="text-bodySm text-inkMuted">
            Uus pakkumine asendab sinu eelmise pakkumise.
          </p>
        )}
        <p className="text-bodySm text-inkMuted">
          Pakkumine on siduv ja seda ei saa tagasi võtta. Pakkumiste summad
          hoitakse peidetud kuni nende üheaegse avamiseni pärast oksjoni lõppu.
        </p>
        <div className="mt-2xs flex flex-col gap-xs sm:flex-row">
          <Btn variant="outline" onClick={onClose} disabled={isSubmitting}>
            Katkesta
          </Btn>
          <Btn onClick={onConfirm} isLoading={isSubmitting}>
            Esita pakkumine
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
