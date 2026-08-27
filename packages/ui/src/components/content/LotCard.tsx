'use client'

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
  href?: string
  archive?: boolean
  endYear?: number
  finalPrice?: number
  className?: string
}

export function LotCard({
  image,
  title,
  alghind,
  county,
  area,
  endsAt,
  status,
  href,
  archive = false,
  endYear,
  finalPrice,
  className,
}: LotCardProps) {
  const imageEl = (
    <div className="aspect-[16/10] overflow-hidden rounded-card">
      <img
        src={image.src}
        alt={image.alt}
        className="h-full w-full object-cover transition-transform duration-hover group-hover:scale-105"
      />
    </div>
  )

  const displayPrice = archive && finalPrice !== undefined ? finalPrice : alghind

  const contentEl = (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-heading text-h4 text-ink">{title}</h4>
        <StatusPill
          status={archive ? 'ended' : status}
          size="sm"
        />
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