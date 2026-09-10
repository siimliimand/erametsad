'use client'

import { MapEstonia, type MapPin } from '@erametsad/ui'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Kaardivaade for the listing toggle, mapped to the demo popup card in
// docs/design/demo/portal/01-listing.html (.map-popup). Built on MapEstonia
// with documented adaptations, because its pin model is {lat, lng, label,
// onClick} and the Leaflet map instance is not exposed:
// 1. Popups are Leaflet HTML strings (MapEstonia binds `label` verbatim), so
//    next/link and Lucide cannot live inside them. Client-side navigation is
//    provided by a delegated click handler on the wrapper for `[data-lm-link]`
//    anchors, and the close control is Leaflet's own popup close button.
// 2. The ui `Countdown` component cannot render inside a popup string, so the
//    "Aega jäänud" value is a plain DOM span refreshed once a second that
//    mirrors Countdown format="portal" (2p HH:MM:SS, "Lõpeb varsti" badge in
//    the final hour, warn <1h and critical <5min tiers).
// 3. Escape has no Leaflet handle from React: the handler bumps `popupEpoch`,
//    which rebuilds the pins (MapEstonia re-creates markers whenever the pins
//    prop changes) and thereby closes any open popup.
// 4. MapEstonia has no clustering and no custom pin icons. Grid clustering
//    runs client-side below CLUSTER_MAX_ZOOM + 1; a cluster pin shows the lot
//    count and zooms in two steps on click (MapEstonia calls setView when the
//    zoom prop changes). Leaflet's autoClose keeps exactly one popup open.

export interface ListingMapLot {
  id: string
  title: string
  area: number | null
  minBid: number
  endsAt: string | null
  coordinates: { lat: number; lng: number } | null
  /**
   * Katastri- või registri number for the "Katastritunnus" row. Filled from
   * the server map payload (listAuctionMapPoints → AuctionSummary
   * registryNumber, cadastres[0] ?? registryNumbers[0]).
   */
  registryNumber?: string | null
}

export interface ListingMapProps {
  lots: ListingMapLot[]
  /**
   * Kept for source compatibility but not applied: the component owns its
   * responsive slot height, so caller height classes cannot fight it.
   */
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

/** Countdown format="portal" equivalent: `{d}p HH:MM:SS`. */
function formatPortalCountdown(msLeft: number): string {
  const totalSeconds = Math.floor(msLeft / 1000)
  const days = Math.floor(totalSeconds / 86_400)
  const hours = Math.floor((totalSeconds % 86_400) / 3_600)
  const minutes = Math.floor((totalSeconds % 3_600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value: number) => String(value).padStart(2, '0')
  const hms = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  return days > 0 ? `${String(days)}p ${hms}` : hms
}

// "Lõpeb varsti" badge tiers, matching the ui Countdown portal branch.
const SOON_BADGE_WARN =
  'rounded-pill bg-statusEndingSoon/10 px-2 py-0.5 text-xs font-semibold text-statusEndingSoon animate-pulse-countdown'
const SOON_BADGE_CRITICAL =
  'rounded-pill bg-statusCritical/10 px-2 py-0.5 text-xs font-semibold text-statusCritical animate-pulse-countdown-fast'
const REMAINING_NORMAL = 'text-ink'
const REMAINING_ENDED = 'text-inkMuted'

function popupRow(label: string, valueHtml: string, valueClass: string): string {
  return (
    '<div class="flex items-baseline justify-between gap-3 text-sm">' +
    `<dt class="text-inkMuted">${escapeHtml(label)}</dt>` +
    `<dd class="m-0 text-right font-semibold ${valueClass}">${valueHtml}</dd>` +
    '</div>'
  )
}

/** Demo .map-popup anatomy; exported for tests. */
export function buildPopupHtml(lot: ListingMapLot): string {
  const rows: string[] = []
  if (lot.area !== null) {
    rows.push(popupRow('Pindala', `${escapeHtml(lot.area.toLocaleString('et-EE'))} ha`, ''))
  }
  rows.push(
    popupRow('Alghind', `${escapeHtml(lot.minBid.toLocaleString('et-EE'))} €`, 'font-mono tabular-nums tracking-tight text-ctaHover'),
  )
  if (lot.registryNumber !== null && lot.registryNumber !== undefined && lot.registryNumber !== '') {
    rows.push(popupRow('Katastritunnus', escapeHtml(lot.registryNumber), 'font-mono'))
  }
  const countdown =
    lot.endsAt === null
      ? '<span data-lm-remaining class="text-inkMuted">—</span>'
      : `<span data-lm-remaining class="${REMAINING_NORMAL}">…</span>` +
        `<span data-lm-soon class="hidden ${SOON_BADGE_WARN}">Lõpeb varsti</span>`
  rows.push(
    `<div class="flex items-baseline justify-between gap-3 text-sm">` +
      '<dt class="text-inkMuted">Aega jäänud</dt>' +
      (lot.endsAt === null
        ? `<dd class="m-0 text-right font-mono font-semibold tabular-nums tracking-tight">${countdown}</dd>`
        : `<dd class="m-0 text-right font-mono font-semibold tabular-nums tracking-tight" data-lm-countdown data-ends-at="${escapeHtml(lot.endsAt)}">${countdown}</dd>`) +
      '</div>',
  )
  return (
    '<div role="dialog" aria-label="Oksjoni andmed kaardil" class="flex flex-col gap-2 font-body text-ink">' +
    `<h3 class="m-0 pr-6 font-heading text-[17px] font-bold leading-[1.35] text-ink">${escapeHtml(lot.title)}</h3>` +
    `<dl class="m-0 grid gap-[5px]">${rows.join('')}</dl>` +
    `<a href="/oksjon/${encodeURIComponent(lot.id)}" data-lm-link ` +
    'class="mt-1 inline-flex w-fit items-center rounded-button bg-primary px-3 py-1.5 text-label font-semibold text-white transition-colors duration-hover ease-hover hover:bg-primaryHover">Vaata</a>' +
    '</div>'
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

export function ListingMap({ lots }: ListingMapProps) {
  const router = useRouter()
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<{ center: [number, number]; zoom: number }>({
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
  })
  // Rebuilt pins close every Leaflet popup; bumped by the Escape handler.
  const [popupEpoch, setPopupEpoch] = useState(0)

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
    // popupEpoch in deps: a bump forces a marker rebuild, which closes popups.
    // exhaustive-deps is not active in this config, so the extra dep is safe.
    [located, view.zoom, popupEpoch, zoomToCluster],
  )

  useEffect(() => {
    function tick() {
      const root = wrapperRef.current
      if (root === null) return
      const nodes = root.querySelectorAll<HTMLElement>('[data-lm-countdown]')
      for (const node of nodes) {
        const remaining = node.querySelector<HTMLElement>('[data-lm-remaining]')
        const soon = node.querySelector<HTMLElement>('[data-lm-soon]')
        if (remaining === null) continue
        const raw = node.dataset.endsAt
        const left = raw === undefined || raw === '' ? Number.NaN : Date.parse(raw) - Date.now()
        if (!Number.isFinite(left) || left <= 0) {
          remaining.textContent = 'Lõppenud'
          remaining.className = REMAINING_ENDED
          remaining.classList.remove('hidden')
          soon?.classList.add('hidden')
        } else if (left < 5 * 60_000) {
          remaining.classList.add('hidden')
          if (soon !== null) {
            soon.className = SOON_BADGE_CRITICAL
            soon.classList.remove('hidden')
          }
        } else if (left < 60 * 60_000) {
          remaining.classList.add('hidden')
          if (soon !== null) {
            soon.className = SOON_BADGE_WARN
            soon.classList.remove('hidden')
          }
        } else {
          remaining.textContent = formatPortalCountdown(left)
          remaining.className = REMAINING_NORMAL
          remaining.classList.remove('hidden')
          soon?.classList.add('hidden')
        }
      }
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
    }
  }, [])

  // Escape closes the open popup (demo behavior). Leaflet owns the popup, so
  // closing means rebuilding the pins; a DOM check skips the rebuild when no
  // popup is open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (wrapperRef.current?.querySelector('.leaflet-popup') === null) return
      setPopupEpoch((epoch) => epoch + 1)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
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
      <div className="rounded-card border border-border bg-white p-lg text-center">
        <p className="font-heading text-h4 text-ink">Kaardivaade ei ole saadaval</p>
        <p className="mt-2 font-body text-body text-inkMuted">
          Ükski oksjon ei sisalda kaardi asukohta.
        </p>
      </div>
    )
  }

  // The component owns its slot height (240px below lg, 400px at lg+). The
  // [&_.map-estonia] overrides defeat the min-height: 400px that MapEstonia.css
  // hard-codes on the map root, its leaflet container, and the error fallback
  // (packages/ui MapEstonia.css lines 4/10/19); without them the mobile slot
  // is pinned at 400px and the fallback overflows the shorter wrapper. The
  // [&_.leaflet-popup-*] overrides restyle Leaflet's popup chrome into the
  // demo popup card: 280px white card, card radius, modal shadow, 18px padding.
  return (
    <div
      ref={wrapperRef}
      onClick={handleWrapperClick}
      className="h-60 overflow-hidden rounded-card border border-border bg-bgMist lg:h-[400px] [&_.leaflet-popup-close-button]:p-1.5 [&_.leaflet-popup-close-button]:right-[10px] [&_.leaflet-popup-close-button]:text-inkMuted [&_.leaflet-popup-close-button]:top-[10px] [&_.leaflet-popup-close-button:hover]:text-ink [&_.leaflet-popup-content]:!m-0 [&_.leaflet-popup-content]:w-auto [&_.leaflet-popup-content]:p-[18px] [&_.leaflet-popup-content-wrapper]:w-[280px] [&_.leaflet-popup-content-wrapper]:rounded-card [&_.leaflet-popup-content-wrapper]:border [&_.leaflet-popup-content-wrapper]:border-border [&_.leaflet-popup-content-wrapper]:bg-white [&_.leaflet-popup-content-wrapper]:shadow-modal [&_.map-estonia]:h-full [&_.map-estonia]:min-h-0 [&_.map-estonia__fallback]:h-full [&_.map-estonia__fallback]:min-h-0"
    >
      <MapEstonia pins={pins} center={view.center} zoom={view.zoom} />
    </div>
  )
}
