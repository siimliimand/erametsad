'use client'

import { SearchX } from 'lucide-react'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { PortalLotCard } from './PortalLotCard'
import {
  useAuctionStream,
  type AuctionStreamPublishedPayload,
} from '../_lib/use-auction-stream'

import { apiFetch } from '@/lib/api/client'
import type { AuctionListResult, AuctionSummary } from '@/lib/auction/queries'

/**
 * Drop-in client wrapper for the portal listing grid. Integration is a
 * two-line change in (portal)/page.tsx:
 *
 *   <AuctionStreamProvider>
 *     <LiveListing lots={result.auctions} query={search.toString()} />
 *   </AuctionStreamProvider>
 *
 * Props contract:
 * - lots — the server-rendered lots (listAuctions result.auctions). Used as
 *   the initial view and re-adopted whenever the server re-renders (for
 *   example after the stream's router.refresh() on reconnect).
 * - query — optional URLSearchParams string of the current listing view
 *   (tab objectTypes plus active filters, e.g. 'objectType=raieoigus').
 *   Used to fetch the full summary of a newly published lot from
 *   GET /api/v1/auctions so it can be prepended. Without it (or when the
 *   fetch cannot place the lot), the component falls back to
 *   router.refresh().
 * - renderLot — optional custom card renderer; receives the updated lot
 *   and { highlighted: boolean } (true briefly after a live prepend).
 *   When omitted, the default renderer draws PortalLotCard with the demo
 *   card anatomy inside the demo auto-fill grid.
 */

const HIGHLIGHT_MS = 6_000

export interface LiveLotState {
  /** True briefly after the lot was prepended by a live publish event. */
  highlighted: boolean
}

export interface LiveListingProps {
  lots: AuctionSummary[]
  query?: string
  renderLot?: (lot: AuctionSummary, state: LiveLotState) => ReactNode
}

export function LiveListing({ lots, query, renderLot }: LiveListingProps) {
  const router = useRouter()
  const { subscribe } = useAuctionStream()
  const [view, setView] = useState<AuctionSummary[]>(lots)
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  )
  const [announcement, setAnnouncement] = useState('')

  const viewRef = useRef(view)
  viewRef.current = view
  const queryRef = useRef(query)
  queryRef.current = query
  const publishInFlightRef = useRef(false)
  const highlightTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  // The server re-render (router.refresh, navigation back to the page) is
  // authoritative; adopt its lots over the locally mutated view.
  useEffect(() => {
    setView(lots)
  }, [lots])

  useEffect(() => {
    const timers = highlightTimersRef.current
    return () => {
      for (const timer of timers.values()) clearTimeout(timer)
      timers.clear()
    }
  }, [])

  const flashHighlight = useCallback((auctionId: string): void => {
    const timers = highlightTimersRef.current
    const existing = timers.get(auctionId)
    if (existing !== undefined) clearTimeout(existing)
    setHighlightedIds((current) => new Set(current).add(auctionId))
    timers.set(
      auctionId,
      setTimeout(() => {
        timers.delete(auctionId)
        setHighlightedIds((current) => {
          const next = new Set(current)
          next.delete(auctionId)
          return next
        })
      }, HIGHLIGHT_MS),
    )
  }, [])

  const fetchPublishedLot = useCallback(
    async (auctionId: string): Promise<AuctionSummary | null> => {
      const listingQuery = queryRef.current
      if (listingQuery === undefined) return null
      const search = new URLSearchParams(listingQuery)
      search.set('auctionStatus', 'active')
      const response = await apiFetch(`/api/v1/auctions?${search.toString()}`, {
        cache: 'no-store',
      })
      if (!response.ok) return null
      const result = (await response.json()) as AuctionListResult
      if (!Array.isArray(result.auctions)) return null
      return result.auctions.find((lot) => lot.id === auctionId) ?? null
    },
    [],
  )

  useEffect(() => {
    const handlePublished = (payload: AuctionStreamPublishedPayload): void => {
      const auctionId = payload.auctionId
      if (viewRef.current.some((lot) => lot.id === auctionId)) return
      if (publishInFlightRef.current) {
        router.refresh()
        return
      }
      publishInFlightRef.current = true
      void fetchPublishedLot(auctionId)
        .then((lot) => {
          if (
            lot !== null &&
            lot.status === 'active' &&
            !viewRef.current.some((existing) => existing.id === lot.id)
          ) {
            setView((current) => [lot, ...current])
            flashHighlight(lot.id)
            setAnnouncement('Uus oksjon lisandus.')
          } else {
            // Published lot belongs to another page, another tab, or the
            // lookup failed; the server render sorts it out.
            router.refresh()
          }
        })
        .catch(() => {
          router.refresh()
        })
        .finally(() => {
          publishInFlightRef.current = false
        })
    }

    const offExtended = subscribe('auction:extended', (payload) => {
      // Anti-snipe extension: the card's countdown updates in place from
      // the new endsAt; no reload.
      setView((current) =>
        current.map((lot) =>
          lot.id === payload.auctionId ? { ...lot, endsAt: payload.endsAt } : lot,
        ),
      )
    })

    const offEnded = subscribe('auction:ended', (payload) => {
      setView((current) =>
        current.map((lot) =>
          lot.id === payload.auctionId && lot.status !== 'ended'
            ? { ...lot, status: 'ended' }
            : lot,
        ),
      )
      setAnnouncement('Oksjon lõppes.')
    })

    const offPublished = subscribe('auction:published', handlePublished)

    return () => {
      offExtended()
      offEnded()
      offPublished()
    }
  }, [subscribe, fetchPublishedLot, flashHighlight, router])

  return (
    <div className="flex flex-col gap-md">
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {view.length === 0 ? (
        <div className="flex flex-col items-center gap-2.5 rounded-card bg-primaryLight px-7 py-12 text-center">
          <SearchX size={32} className="text-primary" aria-hidden />
          <h2 className="m-0 font-heading text-[22px] font-bold text-ink">
            Oksjoneid ei leitud
          </h2>
          <p className="m-0 max-w-[34em] font-body text-body text-inkMuted">
            Valitud filtritele ei vasta hetkel ükski aktiivne oksjon. Muuda või
            tühjenda filtreid ja proovi uuesti.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-gutter">
          {view.map((lot) => {
            const highlighted = highlightedIds.has(lot.id)
            const content =
              renderLot?.(lot, { highlighted }) ?? <PortalLotCard lot={lot} />
            return (
              <div
                key={lot.id}
                className={`rounded-card transition-all duration-1000 ease-out ${
                  highlighted ? 'bg-primary/5 ring-2 ring-primary' : ''
                }`}
              >
                {content}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
