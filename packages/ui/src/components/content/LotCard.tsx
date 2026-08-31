'use client'

import { MapPin, Package, Ruler, Trees } from 'lucide-react'
import { Card } from '../Card'
import { Countdown } from '../Countdown'
import { StatusPill, type StatusKey } from '../StatusPill'

export interface LotCardProps {
  image: { src: string; alt: string }
  title: string
  alghind: number
  county: string
  area: number
  endsAt: string
  status: StatusKey
  /** Object type shown as a badge overlay, e.g. "Raieõigus". */
  typeLabel?: string
  /** Parish; rendered with county as "parish vald, county" in the metadata grid. */
  parish?: string
  /** Species list rendered as a comma-joined grid cell. */
  speciesNames?: string[]
  /** Standing volume in m³. */
  volumeM3?: number
  /** CTA text inside the whole-card link. */
  ctaLabel?: string
  href?: string
  archive?: boolean
  endYear?: number
  finalPrice?: number
  className?: string
}

const DEFAULT_CTA_LABEL = 'Vaata lähemalt'

// The enhanced presentation activates on any listing-detail prop so callers
// never get a half-upgraded card; the minimal markup stays byte-identical
// for AuctionTicker-style usage that passes none of these.
function isEnhanced(props: {
  typeLabel?: string | undefined
  parish?: string | undefined
  speciesNames?: string[] | undefined
  volumeM3?: number | undefined
}): boolean {
  return Boolean(
    props.typeLabel ||
    props.parish ||
    (props.speciesNames !== undefined && props.speciesNames.length > 0) ||
    props.volumeM3 !== undefined,
  )
}

interface MetadataCell {
  Icon: typeof MapPin
  text: string
}

function collectMetadataCells(props: {
  parish?: string | undefined
  county: string
  area: number
  speciesNames?: string[] | undefined
  volumeM3?: number | undefined
}): MetadataCell[] {
  const cells: MetadataCell[] = []
  if (props.parish || props.county) {
    cells.push({
      Icon: MapPin,
      text: props.parish
        ? `${props.parish} vald, ${props.county}`
        : props.county,
    })
  }
  if (props.area) {
    cells.push({ Icon: Ruler, text: `${props.area} ha` })
  }
  if (props.speciesNames && props.speciesNames.length > 0) {
    cells.push({ Icon: Trees, text: props.speciesNames.join(', ') })
  }
  if (props.volumeM3 !== undefined) {
    cells.push({ Icon: Package, text: `${props.volumeM3} m³` })
  }
  return cells
}

export function LotCard({
  image,
  title,
  alghind,
  county,
  area,
  endsAt,
  status,
  typeLabel,
  parish,
  speciesNames,
  volumeM3,
  ctaLabel = DEFAULT_CTA_LABEL,
  href,
  archive = false,
  endYear,
  finalPrice,
  className,
}: LotCardProps) {
  const displayPrice =
    archive && finalPrice !== undefined ? finalPrice : alghind
  const enhanced = isEnhanced({ typeLabel, parish, speciesNames, volumeM3 })

  const imageEl = enhanced ? (
    <div className="relative">
      <div className="aspect-[16/10] overflow-hidden rounded-card">
        <img
          src={image.src}
          alt={image.alt}
          className="h-full w-full object-cover transition-transform duration-hover group-hover:scale-105"
        />
      </div>
      {typeLabel && (
        <span className="absolute left-3 top-3 inline-flex items-center rounded-pill bg-bgPage/90 px-2.5 py-1 font-body text-label font-semibold text-ink">
          {typeLabel}
        </span>
      )}
      {/* Solid pill backdrop keeps the countdown legible over any photo. */}
      {archive ? (
        endYear !== undefined && (
          <span className="absolute right-3 top-3 inline-flex items-center rounded-pill bg-bgPage/90 px-2.5 py-1 font-body text-label text-inkMuted">
            Lõppenud {endYear}
          </span>
        )
      ) : (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-pill bg-bgPage/90 px-2.5 py-1">
          <Countdown endsAt={endsAt} size="sm" showLabel={false} />
        </span>
      )}
    </div>
  ) : (
    <div className="aspect-[16/10] overflow-hidden rounded-card">
      <img
        src={image.src}
        alt={image.alt}
        className="h-full w-full object-cover transition-transform duration-hover group-hover:scale-105"
      />
    </div>
  )

  const contentEl = enhanced ? (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-heading text-h4 text-ink">{title}</h4>
        <StatusPill status={archive ? 'ended' : status} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        {collectMetadataCells({
          parish,
          county,
          area,
          speciesNames,
          volumeM3,
        }).map(({ Icon, text }) => (
          <div key={text} className="flex min-w-0 items-center gap-1.5">
            <Icon size={14} className="shrink-0 text-inkMuted" aria-hidden />
            <span className="truncate font-body text-bodySm text-inkMuted">
              {text}
            </span>
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between gap-2 border-t border-border pt-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-body text-label text-inkMuted">
            {archive && finalPrice !== undefined ? 'Lõpphind' : 'Alghind'}
          </span>
          <span
            className="font-mono text-h4 tracking-tight text-ink"
            style={{ fontFeatureSettings: '"tnum" 1' }}
          >
            {displayPrice.toLocaleString('et')} €
          </span>
        </div>

        {/* Span, not button: the whole card is already one link, and nested
            interactive elements would be invalid HTML. */}
        {href && (
          <span className="inline-flex items-center justify-center rounded-button bg-primary px-4 py-2 font-label text-label font-semibold text-inkInverse transition-opacity duration-hover ease-hover group-hover:opacity-90 motion-reduce:transition-none">
            {ctaLabel}
          </span>
        )}
      </div>
    </div>
  ) : (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-heading text-h4 text-ink">{title}</h4>
        <StatusPill status={archive ? 'ended' : status} size="sm" />
      </div>

      <p className="font-body text-bodySm text-inkMuted">
        {county}, {area.toFixed(1)} ha
      </p>

      <div className="flex items-center justify-between">
        <span
          className={`font-mono text-h4 tracking-tight ${archive ? 'text-inkMuted' : 'text-ink'}`}
          style={{ fontFeatureSettings: '"tnum" 1' }}
        >
          {displayPrice.toLocaleString('et')} €
        </span>

        {archive ? (
          <span className="font-body text-label text-inkMuted">
            Lõppenud {endYear}
          </span>
        ) : (
          <Countdown endsAt={endsAt} size="sm" />
        )}
      </div>
    </div>
  )

  const card = (
    <Card
      image={imageEl}
      content={contentEl}
      hover={!archive}
      className={archive ? 'opacity-70' : ''}
    />
  )

  if (href) {
    return (
      <a href={href} className={`group block ${className ?? ''}`}>
        {card}
      </a>
    )
  }

  return <div className={className}>{card}</div>
}
