'use client'

import {
  ArrowLeftRight,
  ChevronDown,
  Eye,
  SearchCheck,
  Swords,
  TimerReset,
  TriangleAlert,
  UserPlus,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type UIEvent } from 'react'

import { flagInternalReviewAction } from './_actions'
import {
  detectAnomalies,
  NEW_ACCOUNT_BURST_WINDOW_MINUTES,
  NEW_ACCOUNT_MAX_AGE_DAYS,
  RAPID_OVERTAKE_WINDOW_MINUTES,
  type DetectedAnomaly,
} from './_lib/anomalies'
import { endAuctionManuallyAction, revealBidderIdentityAction, type BidderIdentityView } from '../../../../_actions/auctions'
import {
  bidSourceLabels,
  bidStatusLabels,
  formatDateTime,
  formatEurAmount,
  formatRelativeTime,
} from '../../../../_lib/labels'

import type { BidSource, BidStatus } from '@/lib/data/schema'

export interface MonitorBidRow {
  key: string
  bidId: string | null
  amountEur: number
  placedAt: string
  source: BidSource
  status: BidStatus
  backfilled: boolean
  bidderId: string | null
  bidderAlias: number | null
  bidderAccountCreatedAt: string | null
}

export interface MonitorExtensionEntry {
  key: string
  at: string
  previousEndsAt: string
  endsAt: string
  windowMinutes: number | null
  bidId: string | null
  live: boolean
}

type ConnectionState = 'connecting' | 'live' | 'offline'
type SourceFilter = 'all' | BidSource
type StatusFilter = 'all' | 'leading' | 'outbid' | 'pending_approval'

const liveDotClass: Record<ConnectionState, string> = {
  connecting: 'bg-info',
  live: 'bg-primary animate-pulse motion-reduce:animate-none',
  offline: 'bg-danger',
}

const liveLabel: Record<ConnectionState, string> = {
  connecting: 'Ühendub…',
  live: 'Otseülekanne',
  offline: 'Ühendus katkes (taasühendab)',
}

const sourceChipClass: Record<BidSource, string> = {
  manual: 'bg-bg-mist text-ink',
  autobidder: 'bg-info-light text-info',
}

const statusChipClass: Record<BidStatus, string> = {
  leading: 'bg-primary-light text-primaryDark',
  outbid: 'bg-bg-mist text-ink-muted',
  won: 'bg-primary-light text-primaryDark',
  lost: 'bg-bg-mist text-ink-muted',
  pending_approval: 'bg-info-light text-info',
  rejected: 'bg-danger-light text-danger',
}

const filterChipBase =
  'h-7 rounded-pill border px-3 text-label font-semibold transition-colors duration-hover ease-hover'
const filterChipActive = 'border-primary bg-primary-light text-primaryDark'
const filterChipIdle = 'border-border bg-bgPage text-ink-muted hover:border-primary hover:text-primary'

const sourceFilterOptions: readonly { value: SourceFilter; label: string }[] = [
  { value: 'all', label: 'Kõik allikad' },
  { value: 'manual', label: 'Käsitsi' },
  { value: 'autobidder', label: 'Automaat' },
]

const statusFilterOptions: readonly { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Kõik olekud' },
  { value: 'leading', label: 'Juhtiv' },
  { value: 'outbid', label: 'Üle pakutud' },
  { value: 'pending_approval', label: 'Kinnitamisel' },
]

// Autobidder duel collapse (demo 04-bids-monitoring): consecutive autobidder
// rows whose placement gaps stay within one burst window collapse into a
// single expandable row once the group reaches the minimum step count.
const AUTOBID_BURST_GAP_MS = 30_000
const AUTOBID_BURST_MIN_ROWS = 3

type FeedEntry =
  | { kind: 'row'; row: MonitorBidRow }
  | { kind: 'burst'; key: string; rows: MonitorBidRow[] }

/** Pure: folds rapid autobidder bursts into collapsible feed entries. */
export function groupAutobidderBursts(rows: readonly MonitorBidRow[]): FeedEntry[] {
  const entries: FeedEntry[] = []
  let burst: MonitorBidRow[] = []

  const flushBurst = (): void => {
    const newest = burst[0]
    if (burst.length >= AUTOBID_BURST_MIN_ROWS && newest !== undefined) {
      entries.push({ kind: 'burst', key: `burst-${newest.key}`, rows: burst })
    } else {
      for (const row of burst) entries.push({ kind: 'row', row })
    }
    burst = []
  }

  for (const row of rows) {
    const previous = burst[burst.length - 1]
    const continuesBurst =
      row.source === 'autobidder' &&
      previous !== undefined &&
      Date.parse(previous.placedAt) - Date.parse(row.placedAt) <= AUTOBID_BURST_GAP_MS
    if (row.source === 'autobidder' && (previous === undefined || continuesBurst)) {
      burst.push(row)
    } else {
      flushBurst()
      // A too-large gap ends the run, but the row that revealed the gap
      // still seeds the next candidate burst (its own gaps decide).
      if (row.source === 'autobidder') {
        burst.push(row)
      } else {
        entries.push({ kind: 'row', row })
      }
    }
  }
  flushBurst()
  return entries
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function fieldAsString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]
  return typeof value === 'string' ? value : null
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

function formatClock(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString('et-EE')
}

/**
 * Demo monitor-head strip (docs/design/demo/admin/04-bids-monitoring.html):
 * timer-xl with the anti-snipe chip, the leading-bid line, and the action
 * buttons. Purely presentational — every value comes from the live feed or
 * the page props; anonymity rules allow amounts and times only.
 */
function MonitorHeadStrip({
  isSealed,
  sealedCount,
  ended,
  endsAt,
  remainingMs,
  countdownUrgent,
  antiSnipeMinutes,
  leadingPlacedAt,
  serverNowMs,
  currentPriceEur,
  bidStepEur,
  canEndManually,
  onEndManually,
}: {
  isSealed: boolean
  sealedCount: number | null
  ended: boolean
  endsAt: string | null
  remainingMs: number | null
  countdownUrgent: boolean
  antiSnipeMinutes: number
  leadingPlacedAt: string | null
  serverNowMs: number
  currentPriceEur: number
  bidStepEur: number | null
  canEndManually: boolean
  onEndManually: () => void
}) {
  return (
    <section
      aria-label="Oksjoni olekuriba"
      className="mb-md flex flex-wrap items-center gap-x-6 gap-y-2 rounded-card border border-border bg-bgPage px-md py-sm shadow-card"
    >
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-label font-medium text-ink-muted">Lõpp:</span>
        {ended ? (
          <span className="font-mono text-count font-bold text-ink">Lõppenud</span>
        ) : (
          <span
            role="timer"
            title={endsAt === null ? undefined : formatDateTime(endsAt)}
            className={`font-mono text-count font-bold tabular-nums tracking-[-0.01em] text-ink${countdownUrgent ? ' cd-crit' : ''}`}
          >
            {remainingMs === null ? '—' : formatCountdown(remainingMs)}
          </span>
        )}
        <span
          title={`Lõpp pikeneb +${String(antiSnipeMinutes)} min, kui viimase ${String(antiSnipeMinutes)} minuti jooksul esitatakse pakkumine`}
          className="inline-flex items-center gap-1 rounded-pill bg-info-light px-2 py-0.5 text-label font-medium text-info"
        >
          <TimerReset className="h-3 w-3" aria-hidden="true" />
          anti-snipe: {String(antiSnipeMinutes)} min
        </span>
      </div>

      <p className="w-full text-bodySm text-ink-muted">
        {isSealed ? (
          <>
            Suletud pakkumisi:{' '}
            <strong className="font-mono font-medium text-ink">
              {sealedCount === null ? '—' : String(sealedCount)}
            </strong>{' '}
            · summad krüptitud kuni avamiseni
          </>
        ) : leadingPlacedAt === null ? (
          'Juhtivat pakkumist veel ei ole.'
        ) : (
          <>
            Juhtiv pakkumine:{' '}
            <strong className="font-mono font-medium text-ink">
              {formatEurAmount(currentPriceEur)}
            </strong>{' '}
            · {formatRelativeTime(leadingPlacedAt, serverNowMs)}
            {bidStepEur !== null ? (
              <>
                {' '}
                · Samm:{' '}
                <strong className="font-mono font-medium text-ink">
                  +{formatEurAmount(bidStepEur)}
                </strong>
              </>
            ) : null}
          </>
        )}
      </p>

      {canEndManually && !ended ? (
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={onEndManually}
            className="inline-flex h-7 items-center rounded-button border border-danger bg-transparent px-3 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light"
          >
            Lõpeta käsitsi
          </button>
        </div>
      ) : null}
    </section>
  )
}

function anomalyCardView(anomaly: DetectedAnomaly): {
  icon: typeof TriangleAlert
  title: string
  description: string
} {
  if (anomaly.kind === 'new-account-burst') {
    return {
      icon: UserPlus,
      title:
        anomaly.bidderAlias === null
          ? 'Uue konto pakkumiste jada'
          : `Uue konto pakkumiste jada — Pakkuja #${String(anomaly.bidderAlias)}`,
      description: `Konto alla ${String(NEW_ACCOUNT_MAX_AGE_DAYS)} päeva; ${String(anomaly.bidCount)} pakkumist ${String(NEW_ACCOUNT_BURST_WINDOW_MINUTES)} minuti jooksul`,
    }
  }
  const pair =
    anomaly.bidderAliasA === null || anomaly.bidderAliasB === null
      ? 'Kaks pakkujat'
      : `Pakkuja #${String(anomaly.bidderAliasA)} ↔ Pakkuja #${String(anomaly.bidderAliasB)}`
  return {
    icon: ArrowLeftRight,
    title: 'Kiire ülevõtmine (shill kahtlus)',
    description: `${pair} — juhtivus vahetus ${String(anomaly.flips)} korda ${String(RAPID_OVERTAKE_WINDOW_MINUTES)} minuti jooksul`,
  }
}

/**
 * Anomalies & shill warnings panel (demo 04-bids-monitoring). Advisory
 * heuristics only — nothing here blocks bids. The footer flags the current
 * findings for internal review through one audited `anomaly.flag` entry.
 */
function AnomaliesPanel({
  auctionId,
  anomalies,
  canFlag,
}: {
  auctionId: string
  anomalies: readonly DetectedAnomaly[]
  canFlag: boolean
}) {
  const [flagged, setFlagged] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <section
      aria-label="Anomaaliad ja shill-hoiatused"
      className="mb-md rounded-card border border-border bg-bgPage px-md py-sm shadow-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <h2 className="text-label font-semibold text-ink-muted">Anomaaliad &amp; shill-hoiatused</h2>
        <span className="inline-flex items-center gap-1 text-label font-semibold text-danger">
          <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
          {String(anomalies.length)} anomaaliat tuvastatud
        </span>
      </div>
      <ul className="mt-sm flex flex-col gap-xs">
        {anomalies.map((anomaly) => {
          const view = anomalyCardView(anomaly)
          const Icon = view.icon
          return (
            <li
              key={`${anomaly.kind}-${anomaly.kind === 'new-account-burst' ? anomaly.bidderId : `${anomaly.bidderIdA}-${anomaly.bidderIdB}`}`}
              className="flex gap-2.5 rounded-input border border-l-4 border-border border-l-danger bg-danger-light px-sm py-xs"
            >
              <Icon className="mt-0.5 h-4 w-4 flex-none text-danger" aria-hidden="true" />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-bodySm font-semibold text-ink">{view.title}</span>
                <span className="text-label text-ink-muted">{view.description}</span>
              </span>
            </li>
          )
        })}
      </ul>
      {canFlag ? (
        <div className="mt-sm border-t border-border pt-sm">
          {flagged ? (
            <span
              role="status"
              className="inline-flex items-center gap-1 rounded-pill bg-primary-light px-3 py-1 text-label font-semibold text-primaryDark"
            >
              <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
              Märgitud sisejuurdluseks — kirje auditilogis
            </span>
          ) : (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  startTransition(async () => {
                    const result = await flagInternalReviewAction(auctionId, anomalies)
                    if (result.ok) {
                      setFlagged(true)
                    } else {
                      setError(result.error)
                    }
                  })
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-button border border-danger bg-transparent px-3 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light disabled:cursor-not-allowed disabled:opacity-50"
              >
                <SearchCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {pending ? 'Märgin…' : 'Märgi sisejuurdluseks'}
              </button>
              {error !== null ? (
                <span className="ml-2 text-label font-semibold text-danger">{error}</span>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}

/**
 * Audited bidder reveal chip (demo 04-bids-monitoring "Pakkuja #N"). The
 * masked chip is the only client path to an identity: clicking calls the
 * shared `revealBidderIdentityAction`, which writes the `user.identity_view`
 * audit entry BEFORE the identity value reaches the client. On success the
 * chip unmounts to the revealed name with an explicit audit marker; the
 * server action's error text renders on failure.
 */
function BidderRevealChip({ bidId, alias }: { bidId: string | null; alias: number }) {
  const [identity, setIdentity] = useState<BidderIdentityView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (identity !== null) {
    return (
      <span className="inline-flex flex-wrap items-center gap-x-1">
        <span className="text-label font-semibold text-ink">
          {identity.name ?? identity.email}
          {identity.name !== null ? (
            <span className="ml-1 font-normal text-ink-muted">({identity.email})</span>
          ) : null}
        </span>
        <span className="rounded-pill bg-primary-light px-2 py-0.5 text-label font-semibold text-primaryDark">
          paljastatud — logitud auditisse
        </span>
      </span>
    )
  }

  if (error !== null) {
    return <span className="text-label font-semibold text-danger">{error}</span>
  }

  if (bidId === null) {
    return <span className="text-label font-medium text-ink-muted">Pakkuja #{String(alias)}</span>
  }

  return (
    <button
      type="button"
      disabled={pending}
      title="Paljasta pakkuja nimi (logitakse auditisse)"
      onClick={() => {
        startTransition(async () => {
          const reveal = await revealBidderIdentityAction(bidId)
          if (reveal.ok) {
            setIdentity(reveal.identity)
          } else {
            setError(reveal.error)
          }
        })
      }}
      className="inline-flex h-6 items-center gap-1 rounded-pill border border-border px-2 text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Eye className="h-3 w-3" aria-hidden="true" />
      {pending ? 'Avan…' : `Pakkuja #${String(alias)}`}
    </button>
  )
}

/**
 * One feed table row: amounts and relative times, plus the audited reveal
 * chip in the Pakkuja column (identity only ever arrives through the
 * `user.identity_view` server action).
 */
function FeedBidRow({
  row,
  nowMs,
  indented = false,
}: {
  row: MonitorBidRow
  nowMs: number
  indented?: boolean
}) {
  return (
    <tr
      className={`border-b border-border last:border-b-0 transition-colors duration-hover ease-hover hover:bg-bg-mist${indented ? ' bg-bg-mist' : ''}`}
    >
      <td className={`h-10 px-3 text-bodySm text-ink${indented ? ' pl-10' : ''}`}>
        <time dateTime={row.placedAt} title={formatDateTime(row.placedAt)}>
          {formatRelativeTime(row.placedAt, nowMs)}
        </time>
        {row.backfilled ? (
          <span className="ml-2 rounded-pill bg-info-light px-2 py-0.5 text-label font-semibold text-info">
            laaditud hiljem
          </span>
        ) : null}
      </td>
      <td className="h-10 px-3">
        {row.bidderAlias === null ? (
          <span className="text-bodySm text-ink-muted">—</span>
        ) : (
          <BidderRevealChip bidId={row.bidId} alias={row.bidderAlias} />
        )}
      </td>
      <td className="h-10 px-3 text-bodySm font-semibold text-ink">{formatEurAmount(row.amountEur)}</td>
      <td className="h-10 px-3">
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${sourceChipClass[row.source]}`}
        >
          {bidSourceLabels[row.source]}
        </span>
      </td>
      <td className="h-10 px-3">
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${statusChipClass[row.status]}`}
        >
          {bidStatusLabels[row.status]}
        </span>
      </td>
    </tr>
  )
}

/**
 * Collapsed autobidder duel row (demo 04-bids-monitoring): one muted toggle
 * line that expands the burst steps in place.
 */
function FeedBurstRow({
  entry,
  nowMs,
  open,
  onToggle,
}: {
  entry: Extract<FeedEntry, { kind: 'burst' }>
  nowMs: number
  open: boolean
  onToggle: () => void
}) {
  const steps = entry.rows.length
  return (
    <>
      <tr className="border-b border-border bg-bg-mist last:border-b-0">
        <td colSpan={5} className="p-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-label font-medium text-ink-muted transition-colors duration-hover ease-hover hover:text-primary"
          >
            <Swords className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
            <span>
              Automaatpakkujate duell: {String(steps)} sammu ({open ? 'Ahenda' : 'Laienda'})
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 flex-none transition-transform duration-hover ease-hover${open ? ' rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        </td>
      </tr>
      {open
        ? entry.rows.map((row) => <FeedBidRow key={row.key} row={row} nowMs={nowMs} indented />)
        : null}
    </>
  )
}

/**
 * Live bid monitor. Subscribes to the same AuctionDO stream as the portal
 * (`/api/v1/auctions/stream?auction=<id>`); the admin session cookie rides
 * along with the same-origin EventSource request. Public stream frames
 * carry no amounts, so each incoming bid reconciles against the
 * repository through a router refresh, and a reconnected stream backfills
 * everything since the disconnect and marks those rows "laaditud hiljem".
 * Rows show amounts and relative times only — never bidder identities.
 */
export function BidMonitor({
  auctionId,
  title,
  isSealed,
  sealedBidCount,
  initialRows,
  initialPriceEur,
  marginToSecondEur,
  minNextBidEur,
  bidStepEur,
  endsAt,
  initialEnded,
  serverTimeIso,
  antiSnipeMinutes,
  initialExtensions,
  canEndManually,
  canFlagAnomalies,
}: {
  auctionId: string
  title: string
  isSealed: boolean
  sealedBidCount: number | null
  initialRows: MonitorBidRow[]
  initialPriceEur: number
  marginToSecondEur: number | null
  minNextBidEur: number | null
  bidStepEur: number | null
  endsAt: string | null
  initialEnded: boolean
  serverTimeIso: string
  antiSnipeMinutes: number
  initialExtensions: MonitorExtensionEntry[]
  canEndManually: boolean
  canFlagAnomalies: boolean
}) {
  const router = useRouter()
  const [rows, setRows] = useState<MonitorBidRow[]>(initialRows)
  const [sealedCount, setSealedCount] = useState(sealedBidCount)
  const [currentPriceEur, setCurrentPriceEur] = useState(initialPriceEur)
  const [streamEndsAt, setStreamEndsAt] = useState(endsAt)
  const [ended, setEnded] = useState(initialEnded)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [notices, setNotices] = useState<{ id: number; message: string }[]>([])
  const [tick, setTick] = useState(0)
  const [extensions, setExtensions] = useState<MonitorExtensionEntry[]>(initialExtensions)
  const [extendedFlash, setExtendedFlash] = useState(false)
  const [manualPause, setManualPause] = useState(false)
  const [scrollPause, setScrollPause] = useState(false)
  const [pendingWhilePaused, setPendingWhilePaused] = useState(0)
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [expandedBursts, setExpandedBursts] = useState<ReadonlySet<string>>(new Set())
  const [endModalOpen, setEndModalOpen] = useState(false)
  const [endReason, setEndReason] = useState('')

  // Server-synced clock: the skew is fixed once against the server render
  // time, then the countdown ticks locally against it.
  const skewRef = useRef(Date.now() - Date.parse(serverTimeIso))
  const backfillSinceRef = useRef<string | null>(null)
  const disconnectedAtRef = useRef<string | null>(null)
  const pendingRef = useRef(0)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pausedRef = useRef(false)
  const noticeCounter = useRef(0)
  const extensionCounter = useRef(0)

  const paused = manualPause || scrollPause
  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  const pushNotice = useCallback((message: string): void => {
    noticeCounter.current += 1
    const id = noticeCounter.current
    setNotices((current) => [...current, { id, message }])
    setTimeout(() => {
      setNotices((current) => current.filter((notice) => notice.id !== id))
    }, 10000)
  }, [])

  const requestReconcile = useCallback(
    (immediate: boolean): void => {
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
      const run = (): void => {
        refreshTimerRef.current = null
        router.refresh()
      }
      if (immediate) {
        run()
      } else {
        refreshTimerRef.current = setTimeout(run, 400)
      }
    },
    [router],
  )

  // Reconcile from the repository whenever the server re-renders this page.
  // Rows newer than the disconnect time arrive as backfill ("laaditud
  // hiljem"); the rest just refresh source/status of known rows.
  useEffect(() => {
    const since = backfillSinceRef.current
    backfillSinceRef.current = null
    if (since !== null) setStreamEndsAt(endsAt)
    setRows((current) => {
      const byKey = new Map(current.map((row) => [row.key, row]))
      for (const row of initialRows) {
        const existing = byKey.get(row.key)
        byKey.set(
          row.key,
          existing === undefined ? { ...row, backfilled: since !== null && row.placedAt > since } : { ...row, backfilled: existing.backfilled },
        )
      }
      const merged = [...byKey.values()].sort((a, b) =>
        a.placedAt === b.placedAt
          ? a.key < b.key
            ? 1
            : -1
          : a.placedAt < b.placedAt
            ? 1
            : -1,
      )
      return merged
    })
  }, [initialRows, endsAt])

  useEffect(() => {
    setCurrentPriceEur(initialPriceEur)
  }, [initialPriceEur])

  // Resuming the feed flushes everything that piled up while paused.
  useEffect(() => {
    if (paused || pendingRef.current === 0) return
    pendingRef.current = 0
    setPendingWhilePaused(0)
    requestReconcile(true)
  }, [paused, requestReconcile])

  useEffect(() => {
    if (ended) return
    const interval = setInterval(() => {
      setTick((value) => value + 1)
    }, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [ended])

  useEffect(() => {
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let disposed = false

    const connect = (): void => {
      if (disposed) return
      setConnection('connecting')
      const next = new EventSource(
        `/api/v1/auctions/stream?auction=${encodeURIComponent(auctionId)}`,
      )
      source = next

      next.onopen = () => {
        const reconnected = attempt > 0
        attempt = 0
        setConnection('live')
        if (reconnected && disconnectedAtRef.current !== null) {
          backfillSinceRef.current = disconnectedAtRef.current
          disconnectedAtRef.current = null
          pushNotice('Ühendus taastatud; vahepealsed sündmused laaditakse järgi.')
          requestReconcile(true)
        }
      }
      next.onerror = () => {
        next.close()
        source = null
        setConnection('offline')
        if (disposed) return
        disconnectedAtRef.current ??= new Date().toISOString()
        attempt += 1
        const delay = Math.min(30000, 1000 * 2 ** (attempt - 1))
        reconnectTimer = setTimeout(connect, delay)
      }

      const frameOf = (raw: string): Record<string, unknown> | null => {
        const data = parseData(raw)
        if (!isRecord(data) || data.auctionId !== auctionId) return null
        return data
      }

      next.addEventListener('bid:created', (event) => {
        if (frameOf((event as MessageEvent<string>).data) === null) return
        if (pausedRef.current) {
          pendingRef.current += 1
          setPendingWhilePaused(pendingRef.current)
          return
        }
        if (isSealed) {
          // Sealed frames carry no amounts; the count-only view bumps live.
          setSealedCount((count) => (count === null ? 1 : count + 1))
        } else {
          requestReconcile(false)
        }
      })

      next.addEventListener('auction:extended', (event) => {
        const data = frameOf((event as MessageEvent<string>).data)
        if (data === null) return
        const previousEndsAt = fieldAsString(data, 'previousEndsAt')
        const nextEndsAt = fieldAsString(data, 'endsAt')
        if (nextEndsAt !== null) {
          setStreamEndsAt(nextEndsAt)
          const extendedMinutes =
            previousEndsAt !== null
              ? Math.round((Date.parse(nextEndsAt) - Date.parse(previousEndsAt)) / 60000)
              : null
          extensionCounter.current += 1
          setExtensions((current) => [
            {
              key: `live-${String(extensionCounter.current)}`,
              at: new Date().toISOString(),
              previousEndsAt: previousEndsAt ?? nextEndsAt,
              endsAt: nextEndsAt,
              windowMinutes:
                extendedMinutes !== null && extendedMinutes > 0 ? extendedMinutes : null,
              bidId: null,
              live: true,
            },
            ...current,
          ])
          setExtendedFlash(true)
          setTimeout(() => {
            setExtendedFlash(false)
          }, 8000)
        }
        pushNotice('Lõppaega pikendati (snipe-kaitse).')
      })

      next.addEventListener('auction:ended', (event) => {
        const data = frameOf((event as MessageEvent<string>).data)
        if (data === null) return
        setEnded(true)
        pushNotice(
          data.sealedOpeningPending === true
            ? 'Oksjon lõppes; pitsereeritud pakkumused ootavad avamist.'
            : 'Oksjon lõppes.',
        )
      })

      next.addEventListener('auction:published', (event) => {
        const data = frameOf((event as MessageEvent<string>).data)
        if (data === null) return
        const nextEndsAt = fieldAsString(data, 'endsAt')
        if (nextEndsAt !== null) setStreamEndsAt(nextEndsAt)
        pushNotice('Oksjon avalikustati.')
      })
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
      source?.close()
    }
  }, [auctionId, isSealed, pushNotice, requestReconcile])

  const onFeedScroll = useCallback((event: UIEvent<HTMLDivElement>): void => {
    const atTop = event.currentTarget.scrollTop <= 8
    setScrollPause((current) => (current === !atTop ? current : !atTop))
  }, [])

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (row) =>
          (sourceFilter === 'all' || row.source === sourceFilter) &&
          (statusFilter === 'all' || row.status === statusFilter),
      ),
    [rows, sourceFilter, statusFilter],
  )
  const feedEntries = useMemo(() => groupAutobidderBursts(filteredRows), [filteredRows])

  const endsAtTime = streamEndsAt === null ? null : Date.parse(streamEndsAt)
  const remainingMs = useMemo(() => {
    void tick
    if (endsAtTime === null || Number.isNaN(endsAtTime)) return null
    return endsAtTime - (Date.now() - skewRef.current)
  }, [endsAtTime, tick])
  const countdownUrgent =
    remainingMs !== null && !ended && remainingMs <= antiSnipeMinutes * 60000
  const leadingPlacedAt = useMemo(
    () => rows.find((row) => row.status === 'leading')?.placedAt ?? null,
    [rows],
  )
  const anomalies = useMemo(
    () => detectAnomalies(rows, Date.now() - skewRef.current),
    [rows],
  )

  return (
    <div>
      <MonitorHeadStrip
        isSealed={isSealed}
        sealedCount={sealedCount}
        ended={ended}
        endsAt={streamEndsAt}
        remainingMs={remainingMs}
        countdownUrgent={countdownUrgent}
        antiSnipeMinutes={antiSnipeMinutes}
        leadingPlacedAt={leadingPlacedAt}
        serverNowMs={Date.now() - skewRef.current}
        currentPriceEur={currentPriceEur}
        bidStepEur={bidStepEur}
        canEndManually={canEndManually}
        onEndManually={() => {
          setEndModalOpen(true)
        }}
      />

      <div className="mb-md grid grid-cols-1 gap-xs sm:grid-cols-3">
        {isSealed ? (
          <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
            <span className="text-label font-semibold text-ink-muted">Suletud pakkumised</span>
            <span className="font-heading text-h3 font-bold text-ink">
              {sealedCount === null ? '—' : String(sealedCount)}
            </span>
            <span className="text-bodySm text-ink-muted">Summad krüptitud kuni avamiseni</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
            <span className="text-label font-semibold text-ink-muted">Juhtiv pakkumine</span>
            <span className="font-heading text-h3 font-bold text-ink">
              {formatEurAmount(currentPriceEur)}
            </span>
            <span className="text-bodySm text-ink-muted">
              {minNextBidEur !== null
                ? `Järgmine vähim samm: ${formatEurAmount(minNextBidEur)}${bidStepEur !== null ? ` (samm ${formatEurAmount(bidStepEur)})` : ''}`
                : bidStepEur !== null
                  ? `Samm ${formatEurAmount(bidStepEur)}`
                  : 'Samm puudub'}
              {marginToSecondEur !== null ? ` · edu teise ees +${formatEurAmount(marginToSecondEur)}` : ''}
            </span>
          </div>
        )}
        <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
          <span className="text-label font-semibold text-ink-muted">
            Lõppaeg · anti-snipe {String(antiSnipeMinutes)} min
          </span>
          {ended ? (
            <span className="font-heading text-h3 font-bold text-ink">Lõppenud</span>
          ) : (
            <span
              className={`font-heading text-h3 font-bold ${countdownUrgent ? 'animate-pulse motion-reduce:animate-none text-primaryDark' : 'text-ink'}`}
            >
              {remainingMs === null ? '—' : formatCountdown(remainingMs)}
            </span>
          )}
          {extendedFlash ? (
            <span className="w-fit rounded-pill bg-info-light px-2 py-0.5 text-label font-semibold text-info">
              Pikendatud
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
          <span className="text-label font-semibold text-ink-muted">Ülekanne</span>
          <span className="flex items-center gap-xs text-bodySm font-semibold text-ink">
            <span
              className={`inline-block h-2 w-2 rounded-full ${ended ? 'bg-danger' : liveDotClass[connection]}`}
            />
            {ended ? 'Lõppenud' : liveLabel[connection]}
          </span>
          {paused ? (
            <span className="text-bodySm text-ink-muted">
              Voog peatatud{pendingWhilePaused > 0 ? ` (${String(pendingWhilePaused)} uut ootab)` : ''}
            </span>
          ) : null}
        </div>
      </div>

      {notices.length > 0 ? (
        <ul className="mb-md space-y-xs">
          {notices.map((notice) => (
            <li
              key={String(notice.id)}
              className="rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
            >
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}

      {endModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md">
          <form
            action={endAuctionManuallyAction}
            className="w-full max-w-md rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="id" value={auctionId} />
            <input
              type="hidden"
              name="redirectTo"
              value={`/admin/auctions/${encodeURIComponent(auctionId)}/monitor`}
            />
            <h2 className="font-heading text-h4 font-bold text-ink">Lõpeta oksjon käsitsi</h2>
            <p className="mt-xs text-bodySm text-ink-muted">
              Põhjus kirjutatakse auditilogi; tegevus on pöördumatu.
            </p>
            <label htmlFor="end-manual-reason" className="mt-md block text-label font-semibold text-ink">
              Põhjus (kohustuslik)
            </label>
            <textarea
              id="end-manual-reason"
              name="reason"
              value={endReason}
              onChange={(event) => {
                setEndReason(event.target.value)
              }}
              rows={3}
              required
              minLength={5}
              className="mt-1 h-auto w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <label htmlFor="end-manual-outcome" className="mt-md block text-label font-semibold text-ink">
              Tulem
            </label>
            <select
              id="end-manual-outcome"
              name="outcome"
              defaultValue="winner"
              className="mt-1 h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary"
            >
              <option value="winner">Müüd — juhtiv pakkumine võidab</option>
              <option value="unsold">Müümata</option>
            </select>
            <div className="mt-md flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => {
                  setEndModalOpen(false)
                }}
                className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
              >
                Tühista
              </button>
              <button
                type="submit"
                disabled={endReason.trim().length < 5}
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-ink-inverse transition-opacity duration-hover ease-hover hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Kinnita lõpetamine
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {!isSealed ? (
        <>
          <p className="sr-only">Jälgitav oksjon: {title}</p>
          <div className="mb-sm flex flex-wrap items-center gap-sm">
            <button
              type="button"
              onClick={() => {
                setManualPause((current) => !current)
              }}
              className={`${filterChipBase} px-4 ${manualPause ? filterChipActive : filterChipIdle}`}
              aria-pressed={manualPause}
            >
              {manualPause ? 'Jätka voogu' : 'Peata voog'}
            </button>
            <span className="text-label font-semibold text-ink-muted">Allikas:</span>
            {sourceFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setSourceFilter(option.value)
                }}
                aria-pressed={sourceFilter === option.value}
                className={`${filterChipBase} ${sourceFilter === option.value ? filterChipActive : filterChipIdle}`}
              >
                {option.label}
              </button>
            ))}
            <span className="text-label font-semibold text-ink-muted">Olek:</span>
            {statusFilterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusFilter(option.value)
                }}
                aria-pressed={statusFilter === option.value}
                className={`${filterChipBase} ${statusFilter === option.value ? filterChipActive : filterChipIdle}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div
            className="max-h-[32rem] overflow-x-auto overflow-y-auto rounded-card border border-border bg-bgPage"
            onScroll={onFeedScroll}
            role="log"
            aria-live={paused ? 'off' : 'polite'}
          >
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border bg-bg-mist">
                  <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                    Aeg
                  </th>
                  <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                    Pakkuja
                  </th>
                  <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                    Summa
                  </th>
                  <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                    Allikas
                  </th>
                  <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                    Olek
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-md py-lg text-center text-bodySm text-ink-muted">
                      {rows.length === 0
                        ? 'Pakkumisi veel ei ole — voog algab esimese pakkumisega.'
                        : 'Filtritesse ei mahu ühtegi pakkumist.'}
                    </td>
                  </tr>
                ) : (
                  feedEntries.map((entry) =>
                    entry.kind === 'row' ? (
                      <FeedBidRow key={entry.row.key} row={entry.row} nowMs={Date.now() - skewRef.current} />
                    ) : (
                      <FeedBurstRow
                        key={entry.key}
                        entry={entry}
                        nowMs={Date.now() - skewRef.current}
                        open={expandedBursts.has(entry.key)}
                        onToggle={() => {
                          setExpandedBursts((current) => {
                            const next = new Set(current)
                            if (next.has(entry.key)) {
                              next.delete(entry.key)
                            } else {
                              next.add(entry.key)
                            }
                            return next
                          })
                        }}
                      />
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-xs text-bodySm text-ink-muted">
            Vaikimisi näidatakse ainult summasid ja aegu. Pakkuja identiteet avaneb ainult
            auditeeritud paljastamise kaudu; iga paljastus logitakse auditilogi. Ühenduse katkes
            ajal saabunud pakkumised märgitakse “laaditud hiljem”.
          </p>
        </>
      ) : (
        <p className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-ink-muted">
          Suletud oksjonil voogu ei näidata; loendus uueneb otseülekande sündmustest.
        </p>
      )}

      {anomalies.length > 0 ? (
        <AnomaliesPanel auctionId={auctionId} anomalies={anomalies} canFlag={canFlagAnomalies} />
      ) : null}

      {extensions.length > 0 ? (
        <section className="mt-md rounded-card border border-border bg-bgPage px-md py-sm">
          <h2 className="text-label font-semibold text-ink-muted">
            Anti-snipe pikenduste logi
          </h2>
          <ul className="mt-xs space-y-1">
            {extensions.map((entry) => (
              <li key={entry.key} className="text-bodySm text-ink">
                <time dateTime={entry.at} title={formatDateTime(entry.at)}>
                  {formatClock(entry.at)}
                </time>{' '}
                → +{String(entry.windowMinutes ?? antiSnipeMinutes)} min · uus lõpp:{' '}
                {formatDateTime(entry.endsAt)}
                {entry.bidId !== null ? ` · pakkumine …${entry.bidId.slice(-6)}` : ''}
                {entry.live ? ' · voost' : ''}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
