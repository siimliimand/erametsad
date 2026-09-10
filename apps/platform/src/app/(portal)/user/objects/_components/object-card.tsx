'use client'

import { Countdown } from '@erametsad/ui'
import { ArrowUpRight, FileText, Zap } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { formatDate, formatEur, TYPE_LABELS } from './format'
import type { SellerAuctionRow } from './seller-data'

const OBJECT_TYPE_LABELS: Record<string, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  pakett: 'Pakett',
  kiire: 'Kiiroksjon',
}

// Demo pill tones (.pill-active/.pill-soon/.pill-muted/.pill-done).
const PILL_TONES: Record<string, { label: string; className: string }> = {
  active: { label: 'Aktiivne', className: 'bg-statusActive/10 text-statusActive' },
  scheduled: { label: 'Plaanis', className: 'bg-cta/15 text-ctaHover' },
  ended: { label: 'Lõppenud', className: 'bg-bgMist text-inkMuted' },
  'sealed-opening-pending': { label: 'Avamine ootel', className: 'bg-info/10 text-info' },
  contract: {
    label: 'Leping allkirjastatud',
    className: 'bg-primaryLight text-primaryHover',
  },
  completed: {
    label: 'Leping allkirjastatud',
    className: 'bg-primaryLight text-primaryHover',
  },
  archived: {
    label: 'Leping allkirjastatud',
    className: 'bg-primaryLight text-primaryHover',
  },
  unsold: { label: 'Müümata', className: 'bg-cta/15 text-ctaHover' },
  appraised: { label: 'Müümata', className: 'bg-cta/15 text-ctaHover' },
  draft: { label: 'Mustand', className: 'bg-bgMist text-inkMuted' },
}

const SIGNED_STATUSES: readonly string[] = ['contract', 'completed', 'archived']
const DIM_STATUSES: readonly string[] = ['unsold', 'appraised', 'draft']

const ENDED_PILL = { label: 'Lõppenud', className: 'bg-bgMist text-inkMuted' } as const

const btnSm =
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-button px-3.5 text-label font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none'

function StatusPill({ status }: { status: string }) {
  const tone = PILL_TONES[status] ?? ENDED_PILL
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-[3px] text-[13px] font-semibold ${tone.className}`}
    >
      <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
      {tone.label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const sealed = type === 'sealed'
  return (
    <span
      className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-[0.04em] ${
        sealed
          ? 'border border-inkMuted bg-inkMuted text-inkInverse'
          : 'border border-statusActive bg-transparent text-statusActive'
      }`}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  )
}

function sideNote(row: SellerAuctionRow): string | null {
  if (SIGNED_STATUSES.includes(row.status)) {
    const ended = row.endsAt !== null ? `Lõppenud ${formatDate(row.endsAt)}. ` : ''
    return `${ended}Ostja andmed nähtavad ainult lepingus.`
  }
  if (row.status === 'unsold' || row.status === 'appraised') {
    return 'Oksjon jäi tulemuseta.'
  }
  if (row.status === 'draft') {
    return 'Muudatused tehakse koos metsaspetsialistiga — enne avaldamist vaatab ta objekti üle.'
  }
  if (row.status === 'ended' || row.status === 'sealed-opening-pending') {
    return row.endsAt !== null ? `Lõppenud ${formatDate(row.endsAt)}.` : null
  }
  return null
}

function PriceStat({ row }: { row: SellerAuctionRow }) {
  const preEnd = row.status === 'scheduled' || row.status === 'active'
  let value: string
  let muted = false
  if (preEnd) {
    if (row.leadingPrice !== null) {
      value = formatEur(row.leadingPrice)
    } else if (row.type === 'sealed') {
      value = `${formatEur(row.startPrice)} (algushind)`
    } else {
      value = '—'
      muted = true
    }
  } else if (row.finalPrice !== null) {
    value = formatEur(row.finalPrice)
  } else {
    value = '—'
    muted = true
  }
  return (
    <div>
      <span className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
        {preEnd ? 'Hetke hind' : 'Lõpphind'}
      </span>
      <span
        className={`font-mono text-lg ${muted ? 'font-medium text-inkMuted' : 'font-semibold text-ink'}`}
        style={{ fontFeatureSettings: '"tnum" 1' }}
      >
        {value}
      </span>
    </div>
  )
}

interface ObjectCardProps {
  row: SellerAuctionRow
  busy: boolean
  reviewSent: boolean
  relistSent: boolean
  feedback: ReactNode
  onOpenBids: (auctionId: string) => void
  onPreview: (auctionId: string) => void
  onReview: (row: SellerAuctionRow) => void
  onRelist: (row: SellerAuctionRow) => void
}

// Demo .obj-card (10-user-objects.html): info column with title + type badge,
// sub line and stat row; right rail with status pill, countdown/note and
// actions. Stats render only values the data layer provides — Vaatamisi and
// Jälgijaid collapse away until the data layer tracks them.
export function ObjectCard({
  row,
  busy,
  reviewSent,
  relistSent,
  feedback,
  onOpenBids,
  onPreview,
  onReview,
  onRelist,
}: ObjectCardProps) {
  const isDraft = row.status === 'draft'
  const isSigned = SIGNED_STATUSES.includes(row.status)
  const isUnsold = row.status === 'unsold' || row.status === 'appraised'
  const dim = DIM_STATUSES.includes(row.status)
  const isActive = row.status === 'active'

  const subParts: string[] = []
  if (row.countyName !== null) subParts.push(row.countyName)
  if (row.areaHa !== null) subParts.push(`${row.areaHa.toLocaleString('et')} ha`)
  subParts.push(OBJECT_TYPE_LABELS[row.objectType] ?? row.objectType)
  if (isDraft) subParts.push('veel avaldamata')

  const note = sideNote(row)

  return (
    <article
      className={`grid gap-4 rounded-card border border-border bg-bgPage p-[22px] shadow-card transition-shadow duration-hover ease-hover hover:shadow-card-hover md:grid-cols-[minmax(0,1fr)_260px] md:gap-x-8 ${dim ? 'opacity-70' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          {isDraft ? (
            <span className="font-heading text-lg font-bold leading-[1.3] text-inkMuted">
              {row.title}
            </span>
          ) : (
            <Link
              href={`/oksjon/${row.id}`}
              className="font-heading text-lg font-bold leading-[1.3] text-ink transition-colors duration-hover ease-hover hover:text-primary motion-reduce:transition-none"
            >
              {row.title}
            </Link>
          )}
          <TypeBadge type={row.type} />
        </div>
        <p className="m-0 mt-1.5 text-sm text-inkMuted">{subParts.join(' · ')}</p>

        <div className="mt-4 flex flex-wrap items-end gap-x-9 gap-y-3">
          {!isDraft && <PriceStat row={row} />}
          {!isDraft && (
            <button
              type="button"
              onClick={() => {
                onOpenBids(row.id)
              }}
              title="Vaata pakkumisi"
              className="group text-left"
            >
              <span className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
                Pakkumisi
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-lg font-semibold text-ink transition-colors duration-hover ease-hover group-hover:text-primary motion-reduce:transition-none">
                {String(row.bidCount)}
                {row.pendingApprovalCount > 0 && (
                  <span className="rounded-pill bg-cta px-1.5 py-0.5 font-body text-xs font-bold text-ink">
                    {row.pendingApprovalCount} ootel
                  </span>
                )}
              </span>
            </button>
          )}
          {row.views !== null && (
            <div>
              <span className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
                Vaatamisi
              </span>
              <span className="font-mono text-lg font-semibold text-ink">
                {String(row.views)}
              </span>
            </div>
          )}
          {isDraft && (
            <div>
              <span className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
                Pakkumisi
              </span>
              <span className="font-mono text-lg font-medium text-inkMuted">—</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-row flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-left md:flex-col md:items-end md:justify-between md:border-l md:border-t-0 md:pl-6 md:text-right">
        <StatusPill status={row.status} />
        {isActive && row.endsAt !== null ? (
          <Countdown endsAt={row.endsAt} format="portal" size="sm" />
        ) : (
          note !== null && (
            <p className="m-0 max-w-[220px] text-[13px] text-inkMuted md:max-w-none">
              {note}
            </p>
          )
        )}
        <div className="flex flex-row flex-wrap items-center gap-2.5 md:flex-col md:items-end">
          {(row.status === 'active' || row.status === 'scheduled') && (
            <Link
              href={`/oksjon/${row.id}`}
              className={`${btnSm} bg-primary text-inkInverse hover:bg-primaryHover`}
            >
              Vaata oksjonit
              <ArrowUpRight size={14} aria-hidden="true" />
            </Link>
          )}
          {(row.status === 'ended' || row.status === 'sealed-opening-pending') && (
            <Link
              href={`/oksjon/${row.id}`}
              className={`${btnSm} border border-primary bg-transparent text-primary hover:bg-primaryLight`}
            >
              Vaata oksjonit
            </Link>
          )}
          {isSigned && (
            <Link
              href={`/lepingud/oksjonileping/${row.id}`}
              className={`${btnSm} border border-primary bg-transparent text-primary hover:bg-primaryLight`}
            >
              Leping ja PDF
              <FileText size={14} aria-hidden="true" />
            </Link>
          )}
          {isUnsold && (
            <button
              type="button"
              disabled={relistSent || busy}
              onClick={() => {
                onRelist(row)
              }}
              className={`${btnSm} bg-cta text-ink hover:bg-ctaHover disabled:cursor-not-allowed disabled:opacity-40`}
            >
              Proovi uuesti
              <Zap size={14} aria-hidden="true" />
            </button>
          )}
          {isDraft && (
            <>
              <button
                type="button"
                onClick={() => {
                  onPreview(row.id)
                }}
                className={`${btnSm} border border-primary bg-transparent text-primary hover:bg-primaryLight`}
              >
                Eelvaade
              </button>
              <button
                type="button"
                disabled={reviewSent || busy}
                onClick={() => {
                  onReview(row)
                }}
                className={`${btnSm} border border-primary bg-transparent text-primary hover:bg-primaryLight disabled:cursor-not-allowed disabled:opacity-40`}
              >
                Saada spetsialistile
              </button>
            </>
          )}
          {feedback}
        </div>
      </div>
    </article>
  )
}
