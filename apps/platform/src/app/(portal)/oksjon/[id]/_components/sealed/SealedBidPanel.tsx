'use client'

import { Btn, Modal } from '@erametsad/ui'
import {
  CircleSlash,
  CheckCircle2,
  Hourglass,
  Info,
  Lock,
  LockOpen,
  ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type SyntheticEvent } from 'react'

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

import { apiFetch } from '@/lib/api/client'
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

/** Demo D.M.YYYY kl HH:MM absolute deadline line (03-lot-detail-sealed.html). */
function fmtDeadline(iso: string): string | null {
  const time = Date.parse(iso)
  if (Number.isNaN(time)) return null
  const date = new Date(time)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${String(date.getDate())}.${String(date.getMonth() + 1)}.${String(
    date.getFullYear(),
  )} kl ${pad(date.getHours())}:${pad(date.getMinutes())}`
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
    response = await apiFetch('/api/v1/bids/create', {
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

// ── Demo building blocks ────────────────────────────────────────────────

const ENDED_STATUSES: readonly AuctionStatus[] = [
  'ended',
  'appraised',
  'contract',
  'completed',
  'archived',
]

// Demo .sealed-panel: the dark "Pimepakkumine" head with the circular lock.
const PANEL_CLASSES =
  'overflow-hidden rounded-card border border-border bg-bgPage shadow-card'

function SealedHead() {
  return (
    <div className="flex items-center gap-3.5 bg-primaryDark px-6 py-5">
      <span
        aria-hidden="true"
        className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-white/10 text-cta"
      >
        <Lock className="h-5 w-5" />
      </span>
      <div>
        <h2 className="m-0 font-heading text-xl font-bold leading-tight text-white">
          Pimepakkumine
        </h2>
        <p className="mb-0 mt-0.5 text-xs text-white/70">
          Üks konfidentsiaalne pakkumine — parim võidab
        </p>
      </div>
    </div>
  )
}

function SealedBody({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4 p-6">{children}</div>
}

function ExplanationBox() {
  return (
    <p className="m-0 flex items-start gap-2.5 rounded-button bg-primaryLight p-4 text-bodySm leading-relaxed text-ink">
      <ShieldCheck
        className="mt-0.5 h-4 w-4 flex-none text-primary"
        aria-hidden="true"
      />
      <span>
        <b>Suletud pimepakkumine</b> — kõik saabunud pakkumised avatakse
        üheaegselt pärast pakkumisaja lõppu. Pakkumiste summasid ja pakkujate
        isikuandmeid ei avaldata enne avamist. Esitatud pakkumine on siduv ning
        seda ei saa tagasi võtta. Võrdsete pakkumiste korral loetakse võitjaks
        varasemalt esitanud pakkuja.
      </span>
    </p>
  )
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function formatRemaining(remaining: number): string {
  const days = Math.floor(remaining / DAY)
  const hours = Math.floor((remaining % DAY) / HOUR)
  const minutes = Math.floor((remaining % HOUR) / MINUTE)
  const seconds = Math.floor((remaining % MINUTE) / SECOND)
  return `${String(days)}p ${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
}

/** Demo .deadline-box: ticking countdown plus the absolute deadline line. */
function DeadlineBox({ endsAt }: { endsAt: string | null }) {
  const endMs = endsAt !== null ? new Date(endsAt).getTime() : Number.NaN
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const tick = () => {
      setNow(Date.now())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const remaining = endMs - now
  const hasDeadline = Number.isFinite(endMs)
  const isEnded = hasDeadline && remaining <= 0
  const timeColor = isEnded
    ? 'text-inkMuted'
    : remaining < 5 * MINUTE
      ? 'text-statusCritical'
      : remaining < HOUR
        ? 'text-ctaHover'
        : 'text-ink'
  const absolute = endsAt !== null ? fmtDeadline(endsAt) : null

  return (
    <div className="rounded-button border border-border bg-bgMist p-4">
      <p
        role="timer"
        aria-label="Aega pakkumise esitamiseks"
        className="m-0 flex items-baseline gap-2"
      >
        <span className="text-xs text-inkMuted">
          {hasDeadline && !isEnded ? 'Aega jäänud' : 'Oksjon lõppenud'}
        </span>
        <span className={`font-mono text-lg font-medium ${timeColor}`}>
          {hasDeadline && !isEnded ? formatRemaining(remaining) : '00:00:00'}
        </span>
      </p>
      {absolute !== null && (
        <p className="mb-0 mt-0.5 text-xs text-inkMuted">
          Pakkumiste tähtaeg: <span className="font-mono">{absolute}</span>
        </p>
      )}
    </div>
  )
}

function BidCountLine({ count }: { count: number | null }) {
  if (count === null) return null
  return (
    <p className="m-0 text-bodySm text-inkMuted">
      Pakkumuste arv:{' '}
      <b className="font-mono font-semibold text-ink">{String(count)}</b>
    </p>
  )
}

function NoteLine({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 flex items-start gap-2 text-xs text-inkMuted">
      <Info className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}

/** Demo .fee-line: fee-on-win line; sealed panels may state the rate because it binds only on a win. */
function FeeOnWinLine() {
  return (
    <p className="m-0 border-t border-border pt-3.5 text-xs text-inkMuted">
      <b className="text-ink">Teenustasu 3% + km</b> — rakendub vaid oksjoni
      võitmise korral.
    </p>
  )
}

function ConfidentialFootnote() {
  return (
    <p className="m-0 text-xs leading-relaxed text-inkMuted">
      Konfidentsiaalne: kuni avamiseni näeb süsteem ainult pakkumiste arvu —
      summasid ei näe müüja, teised pakkujad ega ka administraatorid.{' '}
      <Link
        href="/tingimused"
        className="font-semibold text-primary hover:text-primaryHover"
      >
        Loe tingimustest
      </Link>
    </p>
  )
}

/** Demo .phase-card for post-opening states. */
function PhaseCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children?: React.ReactNode
}) {
  return (
    <section className="flex flex-col items-center gap-2 rounded-card border border-border bg-bgPage p-8 text-center shadow-card">
      <span className="text-primary [&>svg]:h-8 [&>svg]:w-8" aria-hidden="true">
        {icon}
      </span>
      <h2 className="m-0 mt-1 font-heading text-xl font-bold text-ink">{title}</h2>
      {children}
    </section>
  )
}

function ResultPrice({ finalPrice }: { finalPrice: number | null }) {
  if (finalPrice === null) return null
  return (
    <>
      <p className="mb-0 mt-3 text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
        Lõpphind
      </p>
      <p className="m-0 font-heading text-[2.75rem] font-extrabold leading-tight text-primaryDark">
        {eur(finalPrice)}
      </p>
      <p className="m-0 text-bodySm text-inkMuted">
        Võitjale lisandub teenustasu 3% + km.
      </p>
    </>
  )
}

// ── Panel ───────────────────────────────────────────────────────────────

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

  // ── Post-opening result states (demo phase cards) ─────────────────────

  if (isUnsold) {
    return (
      <PhaseCard icon={<CircleSlash />} title="Oksjon jäi müümata">
        <p className="m-0 text-bodySm text-inkMuted">
          Müüja ei kinnitanud müüki. Sinu pakkumise andmed arhiveeritakse.
        </p>
      </PhaseCard>
    )
  }

  if (isEnded) {
    if (viewer?.outcome === 'won') {
      return (
        <PhaseCard icon={<LockOpen />} title="Palju õnne! Sinu pakkumine osutus edukaimaks.">
          <p className="m-0 text-bodySm text-inkMuted">
            Pakkumised avati korraga. Võitjaga võetakse ühendust e-posti teel.
          </p>
          <ResultPrice finalPrice={finalPrice} />
          <Link
            href={`/lepingud/oksjonileping/${auctionId}`}
            className="mt-2 text-bodySm font-semibold text-primary hover:text-primaryHover"
          >
            Vaata oksjonilepingut ›
          </Link>
        </PhaseCard>
      )
    }
    if (viewer?.outcome === 'lost') {
      return (
        <PhaseCard icon={<CircleSlash />} title="Sinu pakkumine ei olnud edukaim">
          <p className="m-0 text-bodySm text-inkMuted">
            Tänan osalemast. Tulemused on nähtavad oksjoni ajaloo lehel.
          </p>
        </PhaseCard>
      )
    }
    return (
      <PhaseCard icon={<Hourglass />} title="Oksjon on lõppenud">
        {participant && finalPrice === null ? (
          <p className="m-0 text-bodySm text-inkMuted">
            Pakkumised avatakse üheaegselt. Teavitame sind tulemusest.
          </p>
        ) : (
          <ResultPrice finalPrice={finalPrice} />
        )}
      </PhaseCard>
    )
  }

  // ── Guest ─────────────────────────────────────────────────────────────

  if (viewer === null) {
    return (
      <section className={PANEL_CLASSES}>
        <SealedHead />
        <SealedBody>
          <ExplanationBox />
          <DeadlineBox endsAt={endsAt} />
          <BidCountLine count={bidCount} />
          {isScheduled ? (
            <p className="m-0 text-body text-inkMuted">Oksjon pole veel alanud.</p>
          ) : (
            <p className="m-0 text-body text-inkMuted">
              Logi sisse pakkumise tegemiseks.
            </p>
          )}
          <Link
            href={`/login?next=${encodeURIComponent(`/oksjon/${auctionId}`)}`}
            className="inline-flex h-10 items-center justify-center rounded-button bg-primary px-4 font-label font-semibold text-inkInverse transition-colors hover:bg-primaryHover md:w-auto"
          >
            Logi sisse
          </Link>
        </SealedBody>
      </section>
    )
  }

  // ── Scheduled ─────────────────────────────────────────────────────────

  if (isScheduled) {
    const startsAtLabel = startsAt !== null ? fmtDateTime(startsAt) : null
    return (
      <section className={PANEL_CLASSES}>
        <SealedHead />
        <SealedBody>
          <ExplanationBox />
          <DeadlineBox endsAt={endsAt} />
          <BidCountLine count={bidCount} />
          <p className="m-0 text-body text-inkMuted">Oksjon pole veel alanud.</p>
          {startsAtLabel !== null && (
            <p className="m-0 text-body text-ink">Oksjon algab: {startsAtLabel}</p>
          )}
        </SealedBody>
      </section>
    )
  }

  // ── Active: locked card after submission ──────────────────────────────

  if (isLocked && lastSubmission !== null) {
    const submittedLabel =
      lastSubmission.at !== '' ? fmtDateTime(lastSubmission.at) : null
    return (
      <section className={PANEL_CLASSES}>
        <SealedHead />
        <SealedBody>
          <DeadlineBox endsAt={endsAt} />
          <BidCountLine count={bidCount} />
          <div className="m-0 flex flex-col items-start gap-2 rounded-button bg-bgMist p-4">
            <p className="m-0 flex items-center gap-2 text-body font-semibold text-ink">
              <CheckCircle2 className="h-4 w-4 flex-none text-accent" aria-hidden="true" />
              Pimepakkumine on esitatud.
            </p>
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
            {submittedLabel !== null && (
              <p className="m-0 font-mono text-xs text-inkMuted">
                Esitatud: {submittedLabel}
              </p>
            )}
            <p className="m-0 text-bodySm text-inkMuted">
              Summa avatakse koos teiste pakkumistega pärast pakkumisaja lõppu.
            </p>
            {remainingRevisions > 0 ? (
              <>
                <p className="m-0 text-bodySm text-inkMuted">
                  Täienduspakkumisi jäänud: {String(remainingRevisions)}
                </p>
                <Btn
                  variant="outline"
                  size="sm"
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
              <p className="m-0 text-bodySm text-inkMuted">
                Täienduspakkumiste limiit on täis.
              </p>
            )}
          </div>
          <NoteLine>
            Saad pakkumist kuni tähtajani muuta — kehtib viimane.
          </NoteLine>
          <FeeOnWinLine />
          <ConfidentialFootnote />
        </SealedBody>
      </section>
    )
  }

  // ── Active: bid form (identity snapshot above the amount, deviation D5) ─

  return (
    <section className={PANEL_CLASSES}>
      <SealedHead />
      <SealedBody>
        <ExplanationBox />
        <DeadlineBox endsAt={endsAt} />
        <BidCountLine count={bidCount} />

        <form onSubmit={openConfirm} className="flex flex-col gap-xs">
          <SealedIdentityForm
            profileType={viewer.profileType}
            values={identity}
            onChange={setIdentity}
            errors={errors}
            disabled={isCapLocked}
          />

          <div>
            <label htmlFor="sealed-bid-amount" className="text-label font-semibold text-ink">
              Pakkumise summa (€)
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
              className="mt-1.5 h-12 w-full rounded-input border border-border bg-bgPage px-4 font-mono text-lg text-ink outline-none transition-colors aria-[invalid=true]:border-danger focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:bg-bgMist disabled:text-inkMuted"
            />
            <p className="mb-0 mt-1.5 text-bodySm text-inkMuted">
              Vähim lubatud pakkumine: {inputAmount(minBid)} €
            </p>
            <p className="mb-0 mt-1 text-bodySm text-inkMuted">
              Soovitame alghinnast madalamat pakkumist vältida — reservhind ei
              ole avalik.
            </p>
          </div>

          {amountError !== null && (
            <p role="alert" className="text-bodySm text-danger">
              {amountError}
            </p>
          )}

          <div className="[&>button]:w-full">
            <Btn type="submit" variant="cta" isLoading={isSubmitting} disabled={isCapLocked}>
              {participant ? 'Esita täienduspakkumine' : 'Esita pimepakkumine'}
            </Btn>
          </div>
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

        <NoteLine>
          Saad pakkumist kuni tähtajani muuta — kehtib viimane.
        </NoteLine>
        <FeeOnWinLine />
        <ConfidentialFootnote />

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
      </SealedBody>
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
      title="Kinnita pakkumine"
      size="sm"
    >
      <div className="flex flex-col gap-sm">
        <p className="font-heading text-3xl font-extrabold text-primaryDark">
          {eur(amount)}
        </p>
        {isRevision && (
          <p className="text-bodySm text-inkMuted">
            Uus pakkumine asendab sinu eelmise pakkumise.
          </p>
        )}
        <p className="text-bodySm text-inkMuted">
          Pakkumine on konfidentsiaalne, siduv ja seda ei saa tagasi võtta.
          Summad hoitakse peidetud kuni nende üheaegse avamiseni pärast oksjoni
          lõppu. Saad pakkumist kuni tähtajani muuta — kehtib viimane.
        </p>
        <div className="mt-2xs flex flex-col gap-xs sm:flex-row">
          <Btn variant="outline" onClick={onClose} disabled={isSubmitting}>
            Katkesta
          </Btn>
          <Btn variant="cta" onClick={onConfirm} isLoading={isSubmitting}>
            Kinnita
          </Btn>
        </div>
      </div>
    </Modal>
  )
}
