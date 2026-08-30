'use client'

import { Countdown } from '@eametsad/ui'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementType,
} from 'react'

import { ActiveBidsTable } from './active-bids-table'
import { AutobidderInline } from './autobidder-inline'
import { BidStatusPill } from './bid-status-pill'
import { EndedBidsTable } from './ended-bids-table'
import { formatDateTime, formatEur } from './format'
import { BotIcon, CloseIcon, FlagIcon, GavelIcon } from './icons'
import { BIDS_TABS, type BidsTabId, type MyBidRow } from './types'

import { useMyStream } from '@/app/(portal)/_lib/use-my-stream'
function tabHref(tab: BidsTabId): string {
  return tab === 'aktiivsed' ? '/user/bids' : `/user/bids?tab=${tab}`
}

interface ToastState {
  message: string
  key: number
}

interface EmptyTabProps {
  icon: ElementType
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

function EmptyTab({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyTabProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-card border border-border bg-bgPage px-4 py-16 shadow-card">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-bgMist">
        <Icon className="h-8 w-8 text-inkMuted" aria-hidden="true" />
      </div>

      <h3 className="text-h4 font-semibold text-ink">{title}</h3>
      <p className="mt-2 max-w-sm text-center text-bodySm text-inkMuted">
        {description}
      </p>
      {actionLabel !== undefined && actionHref !== undefined && (
        <Link
          href={actionHref}
          className="mt-6 inline-flex h-10 items-center rounded-button bg-primary px-4 font-label font-semibold text-inkInverse transition-colors duration-hover hover:bg-primaryHover"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  )
}

export interface BidsViewProps {
  initialTab: BidsTabId
  initialActive: MyBidRow[]
  ended: MyBidRow[]
}

export function BidsView({ initialTab, initialActive, ended }: BidsViewProps) {
  const router = useRouter()
  const { subscribe } = useMyStream()
  const [activeRows, setActiveRows] = useState(initialActive)
  const [tab, setTab] = useState<BidsTabId>(initialTab)
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [toast, setToast] = useState<ToastState | null>(null)
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // router.refresh() re-renders this page server-side; the fresh rows are
  // the source of truth, so they replace local optimistic row edits.
  useEffect(() => {
    setActiveRows(initialActive)
  }, [initialActive])

  useEffect(
    () =>
      subscribe('outbid', ({ auctionId, auctionTitle, newAmount }) => {
        setActiveRows((rows) =>
          rows.map((row) =>
            row.auction.id === auctionId
              ? {
                  ...row,
                  myBid: row.myBid
                    ? { ...row.myBid, status: 'outbid' as const }
                    : row.myBid,
                  leadingAmountEur:
                    row.auction.auctionType === 'open'
                      ? newAmount
                      : row.leadingAmountEur,
                }
              : row,
          ),
        )
        setHighlightedIds((ids) => new Set(ids).add(auctionId))
        if (highlightTimer.current !== null)
          clearTimeout(highlightTimer.current)
        highlightTimer.current = setTimeout(() => {
          setHighlightedIds(new Set())
        }, 6000)
        setToast({
          message: `${auctionTitle ?? 'Oksjon'}: keegi pakkus üle sinu pakkumise (${formatEur(newAmount)}).`,
          key: Date.now(),
        })
      }),
    [subscribe],
  )

  // The server decides tab membership; a refresh moves ended rows to
  // Lõppenud with their outcome and final price.
  useEffect(
    () =>
      subscribe('auction_end', () => {
        router.refresh()
      }),
    [router, subscribe],
  )

  useEffect(
    () =>
      subscribe('countdown_sync', ({ auctionId, endsAt }) => {
        setActiveRows((rows) =>
          rows.map((row) =>
            row.auction.id === auctionId
              ? { ...row, auction: { ...row.auction, endsAt } }
              : row,
          ),
        )
      }),
    [subscribe],
  )

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current)
    }
  }, [])

  const selectTab = useCallback(
    (next: BidsTabId) => {
      setTab(next)
      router.replace(tabHref(next), { scroll: false })
    },
    [router],
  )

  // Autobidders only run on open auctions.
  const autobidderRows = useMemo(
    () => activeRows.filter((row) => row.auction.auctionType === 'open'),
    [activeRows],
  )

  const counters: Record<BidsTabId, number> = {
    aktiivsed: activeRows.length,
    loppenud: ended.length,
    automaatpakkuja: autobidderRows.length,
  }

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-heading text-h2 text-ink">Minu pakkumised</h1>

      <nav
        aria-label="Pakkumiste vaated"
        className="overflow-x-auto border-b border-border"
      >
        <ul className="flex min-w-max">
          {BIDS_TABS.map((entry) => {
            const active = entry.id === tab
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    selectTab(entry.id)
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex items-center gap-2 px-4 py-3 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                    active
                      ? 'border-b-2 border-primary text-primary'
                      : 'border-b-2 border-transparent text-inkMuted hover:border-primary hover:text-primary'
                  }`}
                >
                  {entry.label}
                  <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primaryLight px-1.5 text-[11px] font-semibold text-primaryDark">
                    {counters[entry.id]}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {tab === 'aktiivsed' &&
        (activeRows.length === 0 ? (
          <EmptyTab
            icon={GavelIcon}
            title="Aktiivseid pakkumisi pole"
            description="Kui teed oksjonil pakkumise, näed siin selle staatust ja juhtivat hinda reaalajas."
            actionLabel="Vaata oksjoneid"
            actionHref="/"
          />
        ) : (
          <ActiveBidsTable rows={activeRows} highlightedIds={highlightedIds} />
        ))}

      {tab === 'loppenud' &&
        (ended.length === 0 ? (
          <EmptyTab
            icon={FlagIcon}
            title="Lõppenud pakkumisi pole"
            description="Oksjoni lõppedes näed siin oma tulemust ja lõpphinda."
          />
        ) : (
          <EndedBidsTable rows={ended} />
        ))}

      {tab === 'automaatpakkuja' &&
        (autobidderRows.length === 0 ? (
          <EmptyTab
            icon={BotIcon}
            title="Automaatpakkujat pole võimalik seada"
            description="Automaatpakkuja töötab avatud oksjonitel. Tee pakkumine mõnele avatud oksjonile ja seadista siin maksimaalne summa."
            actionLabel="Vaata oksjoneid"
            actionHref="/"
          />
        ) : (
          <div className="flex flex-col gap-md">
            {autobidderRows.map((row) => (
              <article
                key={row.auction.id}
                className="flex flex-col gap-xs rounded-card border border-border bg-bgPage p-md shadow-card"
              >
                <div className="flex flex-wrap items-center justify-between gap-xs">
                  <div className="flex flex-col gap-2xs">
                    <Link
                      href={`/oksjon/${row.auction.id}`}
                      className="font-label font-semibold text-ink transition-colors duration-hover hover:text-primary"
                    >
                      {row.auction.title}
                    </Link>
                    {row.auction.county !== null && (
                      <span className="text-bodySm text-inkMuted">
                        {row.auction.county.name}
                      </span>
                    )}
                  </div>
                  {row.auction.endsAt !== null && (
                    <Countdown endsAt={row.auction.endsAt} size="sm" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-sm">
                  <BidStatusPill row={row} />
                  <span className="text-bodySm text-inkMuted">
                    Minu pakkumine:{' '}
                    {row.myBid !== null
                      ? `${formatEur(row.myBid.amountEur)} (${formatDateTime(row.myBid.createdAt)})`
                      : '—'}
                  </span>
                  <span className="text-bodySm text-inkMuted">
                    Juhtiv hind:{' '}
                    {row.leadingAmountEur !== null
                      ? formatEur(row.leadingAmountEur)
                      : '—'}
                  </span>
                </div>
                <AutobidderInline
                  auctionId={row.auction.id}
                  minBidEur={row.auction.minBidEur}
                  bidStepEur={row.auction.bidStepEur}
                  currentLeadingEur={row.leadingAmountEur}
                />
              </article>
            ))}
          </div>
        ))}

      {toast !== null && (
        <div
          key={toast.key}
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-button bg-ink px-4 py-3 text-inkInverse shadow-modal"
        >
          <p className="text-bodySm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => {
              setToast(null)
            }}
            aria-label="Sulge teavitus"
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-pill transition-opacity duration-hover hover:opacity-80"
          >
            <CloseIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
