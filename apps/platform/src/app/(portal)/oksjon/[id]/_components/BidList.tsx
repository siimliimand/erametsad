'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { OutbidBanner } from './OutbidBanner'
import {
  useAuctionStream,
  type AuctionStreamBidCreatedPayload,
} from '../../../_lib/use-auction-stream'

import type { AuctionBidView } from '@/lib/auction/queries'

// ── Role-shaped bid list (task 4.5, portal-lot-detail spec) ─────────────
// Authed viewers get "#N {amount} € · Pakkuja #k · relative time" rows in
// descending order with own-bid highlight and autobid marker; guests get
// the count and latest time only (the API enforces the split, task 1.3).
// bid:created SSE events prepend a live row instantly and trigger a quiet
// refetch that reconciles labels, ordering, and the outbid state.

// ── Formatting ──────────────────────────────────────────────────────────

function eur(value: number): string {
  return value.toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}

/** Estonian relative time ("5 minutit tagasi"); `now` injectable for the ticker. */
function relativeTime(value: string, now: number): string {
  const time = Date.parse(value)
  if (Number.isNaN(time)) return value
  const seconds = Math.round((now - time) / 1000)
  if (seconds < 10) return 'just nüüd'
  const plural = (
    count: number,
    singular: string,
    pluralForm: string,
  ): string => `${String(count)} ${count === 1 ? singular : pluralForm} tagasi`
  if (seconds < 60) return plural(seconds, 'sekund', 'sekundit')
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return plural(minutes, 'minut', 'minutit')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return plural(hours, 'tund', 'tundi')
  const days = Math.round(hours / 24)
  return plural(days, 'päev', 'päeva')
}

// ── Outbid derivation ───────────────────────────────────────────────────
// The public auction stream carries no per-user outbid event (that lives on
// the user-area personal stream), so the state is derived from the bid
// data: the viewer led at some point in this session and the authoritative
// leading amount is now above their best bid.

function isBidView(value: unknown): value is AuctionBidView {
  if (typeof value !== 'object' || value === null) return false
  const kind = (value as Record<string, unknown>).kind
  return kind === 'authed' || kind === 'guest' || kind === 'sealed'
}

function maxOwnAmount(view: AuctionBidView): number | null {
  if (view.kind !== 'authed') return null
  let max: number | null = null
  for (const row of view.bids) {
    if (row.isOwn && (max === null || row.amount > max)) max = row.amount
  }
  return max
}

function isLeadingNow(view: AuctionBidView): boolean {
  if (view.kind !== 'authed') return false
  const own = maxOwnAmount(view)
  return (
    own !== null &&
    view.leadingBidAmount !== null &&
    view.leadingBidAmount <= own
  )
}

// ── Row model ───────────────────────────────────────────────────────────

interface LiveRow {
  key: string
  amount: number
  createdAt: string
}

interface DisplayRow {
  key: string
  amount: number
  createdAt: string
  /** `null` while the refetch has not yet labeled a live-prepended row. */
  label: string | null
  isAutobid: boolean
  isOwn: boolean
}

const PANEL_CLASSES =
  'flex flex-col gap-sm rounded-card border border-border bg-bgPage p-md shadow-card'

export interface BidListProps {
  auctionId: string
  /** Server-shaped view from getAuctionBids; re-adopted on router.refresh(). */
  initialView: AuctionBidView
}

export function BidList({ auctionId, initialView }: BidListProps) {
  const { subscribe } = useAuctionStream()

  const [view, setView] = useState<AuctionBidView>(initialView)
  const [liveRows, setLiveRows] = useState<LiveRow[]>([])
  const [hasLed, setHasLed] = useState(() => isLeadingNow(initialView))
  const [now, setNow] = useState(() => Date.now())

  const viewRef = useRef(view)
  viewRef.current = view

  // Server re-render (router.refresh after a bid, SSE reconnect) is
  // authoritative; adopt it over the locally mutated view.
  useEffect(() => {
    setView(initialView)
    setLiveRows([])
  }, [initialView])

  // A leading streak in this session arms the outbid banner; it clears once
  // the authoritative view shows the viewer leading again.
  useEffect(() => {
    if (isLeadingNow(view)) setHasLed(true)
  }, [view])
  const outbid = hasLed && !isLeadingNow(view)

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 30_000)
    return () => {
      clearInterval(timer)
    }
  }, [])

  const refetch = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        `/api/v1/auctions/${encodeURIComponent(auctionId)}/bids`,
        {
          cache: 'no-store',
        },
      )
      if (!response.ok) return
      const payload: unknown = await response.json()
      if (!isBidView(payload)) return
      setView(payload)
      setLiveRows([])
    } catch {
      // Keep the current view (with live rows) until a later event retries.
    }
  }, [auctionId])

  useEffect(() => {
    const handleBidCreated = (
      payload: AuctionStreamBidCreatedPayload,
    ): void => {
      if (payload.auctionId !== auctionId) return
      setView((current) => {
        if (current.kind === 'guest') {
          return {
            kind: 'guest',
            bidCount: current.bidCount + 1,
            latestBidAt: payload.placedAt,
          }
        }
        if (current.kind === 'sealed' && current.bidCount !== null) {
          return { kind: 'sealed', bidCount: current.bidCount + 1 }
        }
        return current
      })
      if (viewRef.current.kind !== 'authed') return
      // Optimistic prepend: the new bid is normally the new highest amount.
      // The refetch below replaces it with the labeled authoritative row.
      const key = `live:${payload.placedAt}:${String(payload.amount)}`
      setLiveRows((current) =>
        current.some((row) => row.key === key)
          ? current
          : [
              ...current,
              { key, amount: payload.amount, createdAt: payload.placedAt },
            ],
      )
      void refetch()
    }

    return subscribe('bid:created', handleBidCreated)
  }, [auctionId, subscribe, refetch])

  const rows = useMemo<DisplayRow[]>(() => {
    if (view.kind !== 'authed') return []
    const stamp = (row: { createdAt: string; amount: number }): string =>
      `${String(Date.parse(row.createdAt))}:${String(row.amount)}`
    const known = new Set(view.bids.map(stamp))
    const live: DisplayRow[] = liveRows
      .filter((row) => !known.has(stamp(row)))
      .map((row) => ({
        key: row.key,
        amount: row.amount,
        createdAt: row.createdAt,
        label: null,
        isAutobid: false,
        isOwn: false,
      }))
    const shaped: DisplayRow[] = view.bids.map((row) => ({
      key: row.id,
      amount: row.amount,
      createdAt: row.createdAt,
      label: row.label,
      isAutobid: row.source === 'autobidder',
      isOwn: row.isOwn,
    }))
    return [...live, ...shaped].sort((a, b) => b.amount - a.amount)
  }, [view, liveRows])

  // ── Guest variant: count + latest time only ────────────────────────────

  if (view.kind === 'guest') {
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Pakkumised</h2>
        <p className="text-body text-ink">
          Pakkumisi:{' '}
          <span className="font-semibold">{String(view.bidCount)}</span>
        </p>
        <p className="text-bodySm text-inkMuted">
          Viimane pakkumise aeg:{' '}
          {view.latestBidAt !== null
            ? relativeTime(view.latestBidAt, now)
            : '—'}
        </p>
        <p className="text-bodySm text-inkMuted">
          Summad ja pakkujate arv on nähtavad sisseloginud kasutajatele.
        </p>
      </section>
    )
  }

  // ── Sealed variant (defensive; the page mounts the list on open only) ──

  if (view.kind === 'sealed') {
    return (
      <section className={PANEL_CLASSES}>
        <h2 className="font-heading text-h4 text-ink">Pakkumised</h2>
        <p className="text-body text-ink">
          Pakkumisi:{' '}
          <span className="font-semibold">{String(view.bidCount ?? 0)}</span>
        </p>
      </section>
    )
  }

  // ── Authed variant: descending amount rows ─────────────────────────────

  return (
    <section className={PANEL_CLASSES}>
      {outbid && <OutbidBanner />}
      <h2 className="font-heading text-h4 text-ink">Pakkumised</h2>
      {rows.length === 0 ? (
        <p className="text-body text-inkMuted">Pakkumisi veel pole.</p>
      ) : (
        <ol className="flex flex-col gap-2xs">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className={`flex flex-wrap items-baseline gap-x-2xs rounded-input px-2xs py-2xs ${
                row.isOwn ? 'bg-primaryLight' : ''
              }`}
            >
              <span className="font-mono text-bodySm text-inkMuted">{`#${String(index + 1)}`}</span>
              <span className="text-body font-semibold text-ink">
                {eur(row.amount)}
              </span>
              {row.label !== null && (
                <>
                  <span className="text-bodySm text-inkMuted">·</span>
                  <span className="text-bodySm text-inkMuted">{row.label}</span>
                </>
              )}
              {row.isAutobid && (
                <span className="inline-flex items-center rounded-pill bg-infoLight px-2 py-0.5 text-xs font-medium text-info">
                  Automaatpakkuja
                </span>
              )}
              {row.isOwn && (
                <span className="inline-flex items-center rounded-pill bg-primaryLight px-2 py-0.5 text-xs font-medium text-primaryDark">
                  Sinu pakkumine
                </span>
              )}
              <span className="ml-auto text-bodySm text-inkMuted">
                {row.label !== null || row.isAutobid ? '· ' : ''}
                {relativeTime(row.createdAt, now)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
