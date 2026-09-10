import { Countdown } from '@erametsad/ui'
import { ArrowUpRight, PenLine } from 'lucide-react'
import Link from 'next/link'

import { AutobidderInline } from './autobidder-inline'
import { BidStatusPill, ContractPendingPill } from './bid-status-pill'
import { formatEur } from './format'
import { MaskedAmount } from './masked-amount'
import { TypeBadge } from './type-badge'
import type { MyBidRow } from './types'
import { ACTIVE_GROUP_STATUSES } from './types'

import type { AuctionObjectType } from '@/lib/data/schema'

const SEALED_LEADING_MASK = 'Suletud pakkumised avaldatakse pärast lõppemist'
const SEALED_NOTE =
  'Kõik pakkumised avatakse korraga pärast oksjoni tähtaega.'
const NO_LEADS = 'Pakkumisi veel ei ole.'

// Singular card labels, mirroring PortalLotCard. A new AuctionObjectType
// fails typecheck here until it gets a label.
const OBJECT_TYPE_LABELS: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  pakett: 'Pakett',
  kiire: 'Kiiroksjon',
}

const ACTION_CLASSES = {
  primary:
    'bg-primary text-inkInverse hover:bg-primaryHover',
  cta: 'bg-cta text-ink hover:bg-ctaHover',
  outline:
    'border border-primary bg-transparent text-primary hover:bg-primaryLight',
} as const

function CardAction({
  href,
  variant,
  children,
}: {
  href: string
  variant: keyof typeof ACTION_CLASSES
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-8 items-center gap-2 rounded-button px-3.5 text-sm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${ACTION_CLASSES[variant]}`}
    >
      {children}
    </Link>
  )
}

function Stat({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <span className="mb-0.5 block text-xs font-semibold uppercase tracking-[0.04em] text-inkMuted">
        {label}
      </span>
      {children}
    </div>
  )
}

function statValueClass(): string {
  return 'font-mono text-lg font-semibold tracking-tight text-ink'
}

// Demo .bid-card (09-user-bids.html): title with the type badge, the county
// · area · type sub line, the stat rows, and the right rail with pills,
// countdown and actions. Lost cards render dimmed; a fresh SSE outbid
// flashes the card. Only values the data layer provides render.
export function BidCard({
  row,
  highlighted,
}: {
  row: MyBidRow
  highlighted: boolean
}) {
  const active = ACTIVE_GROUP_STATUSES.includes(row.auction.auctionStatus)
  const sealed = row.auction.auctionType === 'sealed'
  const lost = row.outcome === 'lost'
  const won = row.outcome === 'won'

  const subParts: string[] = []
  if (row.auction.county !== null) subParts.push(row.auction.county.name)
  if (row.auction.areaHa !== null)
    subParts.push(`${row.auction.areaHa.toLocaleString('et-EE')} ha`)
  subParts.push(OBJECT_TYPE_LABELS[row.auction.objectType])

  return (
    <article
      data-auction-id={row.auction.id}
      className={`grid gap-4 rounded-card border border-border bg-bgPage p-[22px] pr-6 shadow-card transition-shadow duration-hover ease-hover hover:shadow-card-hover motion-reduce:transition-none md:grid-cols-[minmax(0,1fr)_260px] md:gap-x-8 ${
        highlighted ? 'border-danger bg-dangerLight' : ''
      } ${lost ? 'opacity-70' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <Link
            href={`/oksjon/${row.auction.id}`}
            className={`font-heading text-lg font-bold leading-[1.3] text-ink transition-colors duration-hover ease-hover hover:text-primary motion-reduce:transition-none ${
              lost ? 'text-inkMuted' : ''
            }`}
          >
            {row.auction.title}
          </Link>
          <TypeBadge type={row.auction.auctionType} />
        </div>
        <p className="m-0 mt-1.5 text-sm text-inkMuted">
          {subParts.join(' · ')}
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-x-9 gap-y-3.5">
          <Stat label="Minu pakkumine">
            <span className="inline-flex items-center gap-2">
              {row.myBid !== null ? (
                <span className={statValueClass()}>
                  {formatEur(row.myBid.amountEur)}
                </span>
              ) : (
                <span className={statValueClass()}>—</span>
              )}
              {sealed && (
                <span className="inline-flex items-center rounded-pill bg-bgMist px-2.5 py-0.5 text-xs font-semibold text-inkMuted">
                  Pimepakkumine
                </span>
              )}
            </span>
          </Stat>

          {active ? (
            <Stat label="Hetkel juhtiv">
              {sealed ? (
                <MaskedAmount explanation={SEALED_LEADING_MASK} />
              ) : row.leadingAmountEur !== null ? (
                <span className={statValueClass()}>
                  {formatEur(row.leadingAmountEur)}
                </span>
              ) : (
                <MaskedAmount explanation={NO_LEADS} />
              )}
            </Stat>
          ) : (
            <Stat label="Lõpphind">
              <span className={statValueClass()}>
                {row.finalPriceEur != null
                  ? formatEur(row.finalPriceEur)
                  : '—'}
              </span>
            </Stat>
          )}

          {active && !sealed && (
            <Stat label="Automaatpakkuja">
              <AutobidderInline
                auctionId={row.auction.id}
                minBidEur={row.auction.minBidEur}
                bidStepEur={row.auction.bidStepEur}
                currentLeadingEur={row.leadingAmountEur}
                myBidAmountEur={row.myBid?.amountEur ?? null}
              />
            </Stat>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 md:min-w-0 md:flex-col md:items-end md:justify-between md:border-l md:border-t-0 md:pl-6 md:pt-0 md:text-right">
        <div className="flex flex-col items-start gap-2 md:items-end">
          <BidStatusPill row={row} ended={!active} />
          {row.contractPending === true && <ContractPendingPill />}
          {active && row.auction.endsAt !== null && (
            <Countdown
              endsAt={row.auction.endsAt}
              format="portal"
              size="sm"
            />
          )}
          {active && sealed && (
            <p className="m-0 max-w-[220px] text-[13px] text-inkMuted md:text-right">
              {SEALED_NOTE}
            </p>
          )}
        </div>

        <div className="flex flex-row flex-wrap items-center gap-2.5 md:flex-col md:items-end">
          {active && (
            <CardAction href={`/oksjon/${row.auction.id}`} variant="primary">
              Vaata oksjonit
              <ArrowUpRight size={14} aria-hidden="true" />
            </CardAction>
          )}
          {!active && won && row.contractPending === true && (
            <CardAction
              href={`/lepingud/oksjonileping/${row.auction.id}`}
              variant="cta"
            >
              Allkirjasta leping
              <PenLine size={14} aria-hidden="true" />
            </CardAction>
          )}
          {!active && (
            <CardAction href={`/oksjon/${row.auction.id}`} variant="outline">
              Vaata tulemust
            </CardAction>
          )}
        </div>
      </div>
    </article>
  )
}
