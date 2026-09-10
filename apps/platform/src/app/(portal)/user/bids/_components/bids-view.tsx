'use client'

import { Bell, CheckCircle2, FilterX, Gavel, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import { BidCard } from './bid-card'
import { formatEur } from './format'
import {
  BID_FILTERS,
  matchesFilters,
  type BidFilterId,
  type MyBidRow,
} from './types'

import { useMyStream } from '@/app/(portal)/_lib/use-my-stream'

interface ToastState {
  message: string
  key: number
}

export interface BidsViewProps {
  initialFilters: BidFilterId[]
  initialActive: MyBidRow[]
  ended: MyBidRow[]
}

// Demo Minu pakkumised body (09-user-bids.html .bid-wrap): hint banner,
// filter chip row, bid cards, empty states. The SSE wiring is unchanged
// from the previous table view: outbid updates the card and raises a toast,
// auction_end refreshes server rows (moving cards between chips), and
// countdown_sync corrects drifted deadlines.
export function BidsView({
  initialFilters,
  initialActive,
  ended,
}: BidsViewProps) {
  const router = useRouter()
  const { subscribe } = useMyStream()
  const [activeRows, setActiveRows] = useState(initialActive)
  const [filters, setFilters] = useState<ReadonlySet<BidFilterId>>(
    () => new Set(initialFilters),
  )
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

  // The server decides chip membership; a refresh moves ended rows to
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

  const toggleFilter = useCallback(
    (id: BidFilterId) => {
      const next = new Set(filters)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      setFilters(next)
      const selected = [...next]
      router.replace(
        selected.length > 0 ? `/user/bids?olek=${selected.join(',')}` : '/user/bids',
        { scroll: false },
      )
    },
    [filters, router],
  )

  const clearFilters = useCallback(() => {
    setFilters(new Set())
    router.replace('/user/bids', { scroll: false })
  }, [router])

  const rows = useMemo(
    () => [...activeRows, ...ended],
    [activeRows, ended],
  )
  const visibleRows = useMemo(
    () => rows.filter((row) => matchesFilters(row, filters)),
    [rows, filters],
  )

  return (
    <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3.5 rounded-card bg-infoLight px-5 py-4">
        <Bell size={20} className="flex-none text-info" aria-hidden="true" />
        <p className="m-0 min-w-[320px] flex-1 text-[15px] text-ink">
          Lülita teavitused sisse, et mitte oksjoni lõppu magama jääda.
        </p>
        <Link
          href="/user/notifications"
          className="inline-flex h-8 flex-none items-center rounded-button border border-primary bg-transparent px-3.5 text-sm font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none"
        >
          Ava teavitused
        </Link>
      </div>

      <div
        role="group"
        aria-label="Filtreeri pakkumisi"
        className="flex flex-wrap items-center gap-2.5"
      >
        <span className="text-[13px] font-semibold text-ink">
          Filtreeri:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {BID_FILTERS.map((filter) => {
            const pressed = filters.has(filter.id)
            return (
              <button
                key={filter.id}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  toggleFilter(filter.id)
                }}
                className={`rounded-pill border px-3 py-1 text-[13px] font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
                  pressed
                    ? 'border-primary bg-primary text-inkInverse'
                    : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
                }`}
              >
                {filter.label}
              </button>
            )
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-border bg-bgPage px-4 py-16 text-center shadow-card">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-pill bg-bgMist">
            <Gavel className="h-8 w-8 text-inkMuted" aria-hidden="true" />
          </div>
          <h2 className="m-0 font-heading text-h4 font-bold text-ink">
            Pakkumisi pole
          </h2>
          <p className="mt-2 max-w-sm text-bodySm text-inkMuted">
            Kui teed oksjonil pakkumise, näed siin selle staatust, juhtivat
            hinda ja tulemust reaalajas.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex h-10 items-center rounded-button bg-primary px-4 font-label font-semibold text-inkInverse transition-colors duration-hover hover:bg-primaryHover"
          >
            Vaata oksjoneid
          </Link>
        </div>
      ) : visibleRows.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-card bg-primaryLight px-7 py-12 text-center">
          <FilterX
            size={32}
            className="text-primary"
            aria-hidden="true"
          />
          <h2 className="m-0 font-heading text-[22px] font-bold text-ink">
            Filtritele ei vasta ükski pakkumine
          </h2>
          <p className="m-0 max-w-[34em] text-body text-inkMuted">
            Muuda filtrit laiemaks või tühjenda need — kõik sinu pakkumised
            on siin loetletud.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-2.5 inline-flex h-10 items-center rounded-button border border-primary bg-transparent px-6 text-body font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-bgPage hover:text-primaryHover motion-reduce:transition-none"
          >
            Tühjenda filtrid
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {visibleRows.map((row) => (
            <BidCard
              key={row.auction.id}
              row={row}
              highlighted={highlightedIds.has(row.auction.id)}
            />
          ))}
        </div>
      )}

      {toast !== null && (
        <div
          key={toast.key}
          role="alert"
          className="fixed bottom-5 right-5 z-50 flex max-w-[360px] items-start gap-2.5 rounded-button bg-primaryDark px-[18px] py-3.5 text-inkInverse shadow-modal"
        >
          <CheckCircle2
            size={18}
            className="mt-0.5 flex-none text-accent"
            aria-hidden="true"
          />
          <p className="m-0 text-[15px] font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => {
              setToast(null)
            }}
            aria-label="Sulge teavitus"
            className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-pill transition-opacity duration-hover hover:opacity-80"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  )
}
