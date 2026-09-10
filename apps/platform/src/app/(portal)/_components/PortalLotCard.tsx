'use client'

import { Countdown, StatusPill } from '@erametsad/ui'
import { Zap } from 'lucide-react'

import type { AuctionSummary } from '@/lib/auction/queries'
import type { AuctionObjectType } from '@/lib/data/schema'

// Singular card labels; ListingTabs only exports the plural tab labels.
// A new AuctionObjectType fails typecheck here until it gets a label.
const OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  pakett: 'Pakett',
  kiire: 'Kiiroksjon',
}

// CSP allows only 'self' data: blob: for images, so lots without media get
// an inline SVG placeholder instead of an external image host.
const LOT_IMAGE_FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400" role="img" aria-label="Erametsad"><rect width="640" height="400" fill="#2E6B4F"/><text x="320" y="208" fill="#FFFFFF" font-family="sans-serif" font-size="28" text-anchor="middle">Erametsad</text></svg>',
)}`

export interface PortalLotCardProps {
  lot: AuctionSummary
  className?: string
}

// Demo anatomy (docs/design/demo/portal/01-listing.html .lotcard): media with
// the Kiiroksjon flag, type + status row, name, cadastre in mono, meta line,
// amber Alghind block, and the portal countdown under a hairline divider.
// Meta parts render only for values the data layer provides.
export function PortalLotCard({ lot, className }: PortalLotCardProps) {
  const ended = lot.status === 'ended'

  const meta: string[] = []
  if (lot.area !== null) meta.push(`${lot.area.toLocaleString('et')} ha`)
  if (lot.volume !== null) meta.push(`${lot.volume.toLocaleString('et')} m³`)
  if (lot.parish !== null) meta.push(`${lot.parish.name} vald`)
  if (lot.county !== null) meta.push(lot.county.name)

  return (
    <a
      href={`/oksjon/${lot.id}`}
      className={`group flex flex-col overflow-hidden rounded-card border border-border bg-bgPage text-ink shadow-card transition-all duration-hover ease-hover hover:-translate-y-0.5 hover:text-ink hover:shadow-card-hover ${className ?? ''}`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-bgMist">
        <img
          src={lot.image ?? LOT_IMAGE_FALLBACK}
          alt={lot.title}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {lot.isQuickAuction && (
          <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-pill bg-cta px-3 py-[3px] font-body text-[13px] font-semibold text-ink">
            <Zap size={13} fill="currentColor" aria-hidden />
            Kiiroksjon
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 px-[22px] py-5">
        <div className="flex items-center justify-between gap-2.5">
          <span className="font-body text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
            {OBJECT_TYPE_LABELS[lot.objectType]}
          </span>
          <StatusPill status={ended ? 'ended' : 'active'} size="sm" />
        </div>

        <h3 className="m-0 font-heading text-lg font-bold leading-[1.35] text-ink">
          {lot.title}
        </h3>

        {lot.registryNumber !== null && (
          <span className="font-mono text-[15px] font-medium text-ink">
            {lot.registryNumber}
          </span>
        )}

        {meta.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 font-body text-sm text-inkMuted">
            {meta.map((part) => (
              <span key={part}>{part}</span>
            ))}
          </div>
        )}

        <p className="m-0 mt-auto pt-1.5">
          <span className="block font-body text-xs font-medium uppercase tracking-[0.02em] text-inkMuted">
            Alghind
          </span>
          <span
            className="font-mono text-xl font-medium tracking-tight text-ctaHover"
            style={{ fontFeatureSettings: '"tnum" 1' }}
          >
            {lot.minBid.toLocaleString('et')} €
          </span>
        </p>

        <div className="mt-1 border-t border-border pt-1.5">
          <Countdown
            endsAt={lot.endsAt ?? new Date().toISOString()}
            format="portal"
            size="sm"
          />
        </div>
      </div>
    </a>
  )
}
