import { Card, StatusPill } from '@eametsad/ui'
import Link from 'next/link'

// CSP allows only 'self' data: blob: for images, so lots without media get
// an inline SVG placeholder instead of an external image host.
const ARCHIVE_IMAGE_FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" role="img" aria-label="Erametsad"><rect width="640" height="400" fill="#2E6B4F"/><text x="320" y="208" fill="#FFFFFF" font-family="sans-serif" font-size="28" text-anchor="middle">Erametsad</text></svg>',
)}`

function formatEndDate(iso: string): string {
  return new Date(iso).toLocaleDateString('et-EE', { dateStyle: 'long' })
}

export interface ArchiveCardProps {
  title: string
  href: string
  image?: { src: string; alt: string } | undefined
  finalPrice: number | null
  endYear: number | null
  endedAt: string | null
  county: string
  area: number | null
}

// Archive variant of the LotCard pattern, built from the same Card +
// StatusPill primitives: the price row shows the final price or
// "Müümata jäi" (never the start price), and the shape has no place for
// winner identity or bid counts.
export function ArchiveCard({
  title,
  href,
  image,
  finalPrice,
  endYear,
  endedAt,
  county,
  area,
}: ArchiveCardProps) {
  const imageEl = (
    <div className="aspect-[16/10] overflow-hidden rounded-card">
      <img
        src={image?.src ?? ARCHIVE_IMAGE_FALLBACK}
        alt={image?.alt ?? title}
        className="h-full w-full object-cover"
      />
    </div>
  )

  const contentEl = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-heading text-h4 text-ink">{title}</h4>
        <StatusPill status="ended" size="sm" />
      </div>

      <p className="font-body text-bodySm text-inkMuted">
        {county}, {(area ?? 0).toFixed(1)} ha
      </p>

      <div className="flex items-end justify-between gap-2">
        {finalPrice === null ? (
          <span className="font-body text-h4 text-inkMuted">Müümata jäi</span>
        ) : (
          <span
            className="font-mono text-h4 tracking-tight text-inkMuted"
            style={{ fontFeatureSettings: '"tnum" 1' }}
          >
            {finalPrice.toLocaleString('et')} €
          </span>
        )}
        <span className="flex flex-col items-end gap-1">
          {endYear !== null && (
            <span className="inline-flex h-5 items-center rounded-pill bg-primaryLight px-1.5 font-mono text-[11px] font-semibold text-primaryDark">
              {endYear}
            </span>
          )}
          {endedAt !== null && (
            <span className="font-body text-label text-inkMuted">{formatEndDate(endedAt)}</span>
          )}
        </span>
      </div>
    </div>
  )

  return (
    <Link href={href} className="group block">
      <Card
        image={imageEl}
        content={contentEl}
        hover={false}
        className="opacity-70 transition-opacity duration-hover ease-hover group-hover:opacity-100"
      />
    </Link>
  )
}
