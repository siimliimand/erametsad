'use client'

import { LotCard, type LotCardProps } from '@eametsad/ui'
import { useRouter } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  useAuctionStream,
  type AuctionStreamPublishedPayload,
} from '../_lib/use-auction-stream'

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
 *   When omitted, the default renderer draws the same LotCard markup as
 *   the page grid (lotCardProps mapping duplicated here because page.tsx
 *   is a server module).
 */

// CSP allows only 'self' data: blob: for images, so lots without media get
// an inline SVG placeholder instead of an external image host. Mirrors the
// fallback in (portal)/page.tsx.
const LOT_IMAGE_FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" role="img" aria-label="Erametsad"><rect width="640" height="400" fill="#2E6B4F"/><text x="320" y="208" fill="#FFFFFF" font-family="sans-serif" font-size="28" text-anchor="middle">Erametsad</text></svg>',
)}`

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

function lotCardProps(lot: AuctionSummary): LotCardProps {
  const ended = lot.status === 'ended'
  return {
    image: { src: lot.image ?? LOT_IMAGE_FALLBACK, alt: lot.title },
    title: lot.title,
    alghind: lot.minBid,
    county: lot.county?.name ?? lot.address ?? 'Eesti',
    area: lot.area ?? 0,
    endsAt: lot.endsAt ?? new Date().toISOString(),
    status: ended ? 'ended' : 'active',
    href: `/oksjon/${lot.id}`,
    // Ended flip: with a completion year the card switches to its archive
    // presentation; without one the pill flips and Countdown shows
    // "Lõppenud" on its own.
    ...(ended && lot.endYear !== null
      ? {
          archive: true,
          endYear: lot.endYear,
          ...(lot.finalPrice !== null ? { finalPrice: lot.finalPrice } : {}),
        }
      : {}),
  }
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
      const response = await fetch(`/api/v1/auctions?${search.toString()}`, {
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
      <div className="grid gap-md sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {view.map((lot) => {
          const highlighted = highlightedIds.has(lot.id)
          const content =
            renderLot?.(lot, { highlighted }) ?? <LotCard {...lotCardProps(lot)} />
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
    </div>
  )
}
