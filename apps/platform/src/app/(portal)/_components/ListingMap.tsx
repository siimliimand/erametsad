'use client'

import { MapEstonia, type MapPin } from '@eametsad/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Kaardivaade for the listing toggle. Built on MapEstonia with three
// documented adaptations, because its pin model is {lat, lng, label, onClick}:
// 1. Popups are Leaflet HTML strings (MapEstonia binds `label` verbatim), so
//    next/link cannot live inside them. Client-side navigation is provided by
//    a delegated click handler on the wrapper for `[data-lm-link]` anchors.
// 2. The mini countdown is a plain DOM span refreshed once a second via
//    `[data-lm-countdown]`; the ui Countdown component cannot render inside a
//    popup string.
// 3. MapEstonia has no clustering and no custom pin icons. Grid clustering
//    runs client-side below CLUSTER_MAX_ZOOM + 1; a cluster pin shows the lot
//    count and zooms in two steps on click (MapEstonia calls setView when the
//    zoom prop changes).

export interface ListingMapLot {
  id: string
  title: string
  area: number | null
  minBid: number
  finalPrice: number | null
  endsAt: string | null
  coordinates: { lat: number; lng: number } | null
  /**
   * Katastri- või registri number for the popup. Optional because the
   * current map payload (listAuctionMapPoints → AuctionSummary) does not
   * carry cadastres/registryNumbers yet; the integrator should extend the
   * map query to pass `cadastres[0] ?? registryNumbers[0]` when available.
   * Otherwise structurally assignable from AuctionSummary as-is.
   */
  registryNumber?: string | null
}

export interface ListingMapProps {
  lots: ListingMapLot[]
  className?: string
}

type LocatedListingMapLot = ListingMapLot & { coordinates: { lat: number; lng: number } }

const DEFAULT_CENTER: [number, number] = [58.6, 25.0]
const DEFAULT_ZOOM = 7
const CLUSTER_MAX_ZOOM = 9

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatMiniCountdown(msLeft: number): string {
  const totalMinutes = Math.floor(msLeft / 60_000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${String(days)}p ${String(hours)}h ${String(minutes)}m`
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`
  return `${String(minutes)}m`
}

function buildPopupHtml(lot: ListingMapLot): string {
  const title = escapeHtml(lot.title)
  const rows: string[] = []
  if (lot.area !== null) {
    rows.push(`<div>Pindala: <span class="font-mono">${lot.area.toFixed(1)} ha</span></div>`)
  }
  rows.push(`<div>Alghind: <span class="font-mono">${lot.minBid.toLocaleString('et')} €</span></div>`)
  if (lot.finalPrice !== null) {
    rows.push(`<div>Lõpphind: <span class="font-mono">${lot.finalPrice.toLocaleString('et')} €</span></div>`)
  }
  if (lot.registryNumber !== null && lot.registryNumber !== undefined && lot.registryNumber !== '') {
    rows.push(`<div>Katastri- või registri nr: <span class="font-mono">${escapeHtml(lot.registryNumber)}</span></div>`)
  }
  const countdown = lot.endsAt
    ? `<span class="font-mono" data-lm-countdown data-ends-at="${escapeHtml(lot.endsAt)}">…</span>`
    : '<span class="font-mono">—</span>'
  return (
    `<div class="flex min-w-[180px] flex-col gap-1 font-body">` +
    `<p class="font-heading text-h4 text-ink">${title}</p>` +
    `<div class="flex flex-col gap-0.5 text-bodySm text-inkMuted">${rows.join('')}</div>` +
    `<div class="text-bodySm text-inkMuted">Aega jäänud ${countdown}</div>` +
    `<a href="/oksjon/${encodeURIComponent(lot.id)}" data-lm-link ` +
    `class="mt-1 inline-flex w-fit items-center rounded-button bg-primary px-3 py-1.5 text-label font-semibold text-white transition-colors duration-hover ease-hover hover:bg-primaryHover">Vaata</a>` +
    `</div>`
  )
}

function buildPins(
  lots: LocatedListingMapLot[],
  zoom: number,
  onClusterClick: (lat: number, lng: number) => void,
): MapPin[] {
  if (zoom > CLUSTER_MAX_ZOOM) {
    return lots.map((lot) => ({
      lat: lot.coordinates.lat,
      lng: lot.coordinates.lng,
      label: buildPopupHtml(lot),
    }))
  }

  const cellSize = 360 / 2 ** (zoom + 3)
  const buckets = new Map<string, LocatedListingMapLot[]>()
  for (const lot of lots) {
    const key = `${String(Math.floor(lot.coordinates.lat / cellSize))}:${String(Math.floor(lot.coordinates.lng / cellSize))}`
    const bucket = buckets.get(key)
    if (bucket === undefined) buckets.set(key, [lot])
    else bucket.push(lot)
  }

  const pins: MapPin[] = []
  for (const bucket of buckets.values()) {
    const first = bucket[0]
    if (first === undefined) continue
    const { lat, lng } = first.coordinates
    if (bucket.length === 1) {
      pins.push({ lat, lng, label: buildPopupHtml(first) })
      continue
    }
    const centroidLat = bucket.reduce((sum, lot) => sum + lot.coordinates.lat, 0) / bucket.length
    const centroidLng = bucket.reduce((sum, lot) => sum + lot.coordinates.lng, 0) / bucket.length
    pins.push({
      lat: centroidLat,
      lng: centroidLng,
      label: `<strong class="font-heading">${String(bucket.length)} oksjonit</strong>`,
      onClick: () => {
        onClusterClick(centroidLat, centroidLng)
      },
    })
  }
  return pins
}

export function ListingMap({ lots, className = '' }: ListingMapProps) {
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<{ center: [number, number]; zoom: number }>({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  })

  const located = useMemo(
    () =>
      lots.filter((lot): lot is LocatedListingMapLot => lot.coordinates !== null),
    [lots],
  )

  const zoomToCluster = useCallback((lat: number, lng: number) => {
    setView((current) => ({
      center: [lat, lng],
      zoom: Math.min(current.zoom + 2, CLUSTER_MAX_ZOOM + 1),
    }))
  }, [])

  const pins = useMemo(
    () => buildPins(located, view.zoom, zoomToCluster),
    [located, view.zoom, zoomToCluster],
  )

  useEffect(() => {
    function tick() {
      const root = wrapperRef.current
      if (root === null) return
      const nodes = root.querySelectorAll<HTMLElement>('[data-lm-countdown]')
      for (const node of nodes) {
        const raw = node.dataset.endsAt
        const left = raw === undefined || raw === '' ? Number.NaN : Date.parse(raw) - Date.now()
        node.textContent =
          Number.isFinite(left) && left > 0 ? formatMiniCountdown(left) : 'Lõppenud'
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  const handleWrapperClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const link = target.closest<HTMLAnchorElement>('[data-lm-link]')
      const href = link?.getAttribute('href')
      if (href === null || href === undefined || href === '') return
      event.preventDefault()
      router.push(href)
    },
    [router],
  )

  if (located.length === 0) {
    return (
      <div className={`rounded-card border border-border bg-white p-lg text-center ${className}`}>
        <p className="font-heading text-h4 text-ink">Kaardivaade ei ole saadaval</p>
        <p className="mt-2 font-body text-body text-inkMuted">
          Ükski oksjon ei sisalda kaardi asukohta.
        </p>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} onClick={handleWrapperClick} className={className}>
      <MapEstonia pins={pins} center={view.center} zoom={view.zoom} />
    </div>
  )
}
