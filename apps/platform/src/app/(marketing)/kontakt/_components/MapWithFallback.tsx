'use client'

import { MapEstonia, type MapPin } from '@eametsad/ui'
import { MapPin as MapPinIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

// MapEstonia only falls back when the leaflet import itself fails; a live map
// whose tile server is unreachable just stays blank. Watch the rendered tile
// images and swap to a static block when none have loaded within the grace
// period.
const TILE_GRACE_MS = 8000

export interface MapWithFallbackProps {
  center: [number, number]
  zoom: number
  pinLabel?: string | undefined
  address?: string | undefined
}

function StaticMapFallback(props: { address?: string | undefined }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-sm rounded-card bg-bgMist p-lg text-center shadow-card">
      <MapPinIcon className="h-10 w-10 text-primary" aria-hidden="true" />
      <p className="font-heading text-h4 text-ink">Kaart ei ole praegu saadaval</p>
      {props.address ? (
        <p className="font-body text-body text-ink">{props.address}</p>
      ) : null}
      <p className="max-w-container-sm font-body text-bodySm text-inkMuted">
        Helistage või kasutage üleval olevat päringuvormi — vastame 1 tööpäeva
        jooksul.
      </p>
    </div>
  )
}

export function MapWithFallback(props: MapWithFallbackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [tilesFailed, setTilesFailed] = useState(false)

  const pins = useMemo<MapPin[]>(
    () => [
      {
        lat: props.center[0],
        lng: props.center[1],
        ...(props.pinLabel ? { label: props.pinLabel } : {}),
      },
    ],
    [props.center, props.pinLabel],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Tile loads do not bubble, but they do capture; only leaflet tile images
    // count, so a failed marker-icon download cannot mask a tile outage.
    let tileLoaded = false
    const handleLoad = (event: Event) => {
      if (
        event.target instanceof HTMLImageElement &&
        event.target.classList.contains('leaflet-tile')
      ) {
        tileLoaded = true
      }
    }
    container.addEventListener('load', handleLoad, true)

    const timer = window.setTimeout(() => {
      const hasLoadedTiles =
        tileLoaded || container.querySelector('.leaflet-tile-loaded') !== null
      if (!hasLoadedTiles) setTilesFailed(true)
    }, TILE_GRACE_MS)

    return () => {
      window.clearTimeout(timer)
      container.removeEventListener('load', handleLoad, true)
    }
  }, [])

  if (tilesFailed) {
    return <StaticMapFallback address={props.address} />
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-card shadow-card">
      <MapEstonia center={props.center} zoom={props.zoom} pins={pins} />
    </div>
  )
}
