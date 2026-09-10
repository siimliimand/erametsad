'use client'

import { TrendingUp } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { OutbidBanner } from './OutbidBanner'
import {
  useAuctionStream,
  type AuctionStreamBidCreatedPayload,
} from '../../../_lib/use-auction-stream'

import type { AuctionBidView } from '@/lib/auction/queries'

// ── Role-shaped bid list (task 4.5, portal-lot-detail spec) ─────────────
// Authed viewers get the demo history table (Aeg / Summa / Pakkuja / Viis)
// in descending amount order: mono relative times, the leading row in the
// demo primary-light style with the inset bar and the "Liidab" chip, and a
// Käsitsi/Automaat source chip per row. Anonymity holds — only the server's
// "Pakkuja #k" labels, never identities. Guests get the count and latest
// time only (the API enforces the split, task 1.3). bid:created SSE frames
// carry no amount, so authed viewers reconcile new bids through a quiet
// refetch; guests bump the optimistic count.

// ── Formatting ──────────────────────────────────────────────────────────

function eur(value: number): string {
  return value.toLocaleString('et-EE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
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

const TH_CLASSES =
  'bg-bgMist border-b border-border px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted'

const TD_CLASSES = 'border-b border-border px-4 py-3 align-middle'

/** Demo .src-chip: muted for manual bids, info-toned for autobidder bids. */
function SourceChip({ isAutobid }: { isAutobid: boolean }) {
  return (
    <span
      className={`inline-block rounded-pill px-2.5 py-0.5 text-xs font-semibold ${
        isAutobid ? 'bg-infoLight text-info' : 'bg-bgMist text-inkMuted'
      }`}
    >
      {isAutobid ? 'Automaat' : 'Käsitsi'}
    </span>
  )
}

export interface BidListProps {
  auctionId: string
  /** Server-shaped view from getAuctionBids; re-adopted on router.refresh(). */
  initialView: AuctionBidView
}

export function BidList({ auctionId, initialView }: BidListProps) {
  const { subscribe } = useAuctionStream()

  const [view, setView] = useState<AuctionBidView>(initialView)
  const [hasLed, setHasLed] = useState(() => isLeadingNow(initialView))
  const [now, setNow] = useState(() => Date.now())

  const viewRef = useRef(view)
  viewRef.current = view

  // Server re-render (router.refresh after a bid, SSE reconnect) is
  // authoritative; adopt it over the locally mutated view.
  useEffect(() => {
    setView(initialView)
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
      // Public frames carry no amount, so authed rows come from the
      // authoritative refetch rather than the event payload.
      if (viewRef.current.kind !== 'authed') return
      void refetch()
    }

    return subscribe('bid:created', handleBidCreated)
  }, [auctionId, subscribe, refetch])

  const rows = useMemo<DisplayRow[]>(() => {
    if (view.kind !== 'authed') return []
    const shaped: DisplayRow[] = view.bids.map((row) => ({
      key: row.id,
      amount: row.amount,
      createdAt: row.createdAt,
      label: row.label,
      isAutobid: row.source === 'autobidder',
      isOwn: row.isOwn,
    }))
    return shaped.sort((a, b) => b.amount - a.amount)
  }, [view])

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

  // ── Authed variant: demo history table ────────────────────────────────

  return (
    <section className={PANEL_CLASSES}>
      {outbid && <OutbidBanner />}
      <h2 className="font-heading text-h4 text-ink">Pakkumiste ajalugu</h2>
      <p className="text-bodySm text-inkMuted">
        Uusimad eespool. Pakkujad on anonüümsed — näidame ainult numbri ja
        pakkumise viisi.
      </p>
      {rows.length === 0 ? (
        <p className="text-body text-inkMuted">Pakkumisi veel pole.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-card border border-border bg-bgPage">
            <table className="w-full min-w-[600px] border-collapse text-bodySm">
              <thead>
                <tr>
                  <th scope="col" className={TH_CLASSES}>
                    Aeg
                  </th>
                  <th scope="col" className={TH_CLASSES}>
                    Summa
                  </th>
                  <th scope="col" className={TH_CLASSES}>
                    Pakkuja
                  </th>
                  <th scope="col" className={TH_CLASSES}>
                    Viis
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isLeading =
                    view.leadingBidAmount !== null &&
                    row.amount === view.leadingBidAmount
                  return (
                    <tr
                      key={row.key}
                      className={isLeading || row.isOwn ? 'bg-primaryLight' : ''}
                    >
                      <td
                        className={`${TD_CLASSES} font-mono text-xs text-inkMuted ${
                          isLeading
                            ? 'shadow-[inset_3px_0_0_var(--color-primary)]'
                            : ''
                        }`}
                      >
                        {relativeTime(row.createdAt, now)}
                      </td>
                      <td className={`${TD_CLASSES} font-mono font-semibold text-ink`}>
                        {eur(row.amount)}
                        {isLeading && (
                          <span className="ml-2 inline-flex items-center gap-1 rounded-pill bg-primary px-2 py-0.5 align-middle text-[11px] font-bold uppercase tracking-[0.04em] text-white">
                            <TrendingUp className="h-3 w-3" aria-hidden="true" />
                            Liidab
                          </span>
                        )}
                      </td>
                      <td className={`${TD_CLASSES} text-ink`}>
                        {row.label ?? '—'}
                        {row.isOwn && (
                          <span className="ml-2 inline-block rounded-pill bg-primaryDark px-2 py-0.5 align-middle text-[11px] font-semibold text-white">
                            Sinu pakkumine
                          </span>
                        )}
                      </td>
                      <td className={TD_CLASSES}>
                        <SourceChip isAutobid={row.isAutobid} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-bodySm text-inkMuted">
            Kuvame{' '}
            <span className="font-mono">{String(rows.length)}</span> viimast
            pakkumist kokku{' '}
            <span className="font-mono">{String(view.bidCount)}</span>-st.
          </p>
        </>
      )}
    </section>
  )
}
