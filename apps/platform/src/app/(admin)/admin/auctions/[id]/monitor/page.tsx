import { notFound } from 'next/navigation'

import { BidMonitor, type MonitorBidRow, type MonitorExtensionEntry } from './bid-monitor'
import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { StatusPill, formatEur } from '../../../../_lib/labels'
import { auctionInScope, auctionScope, can } from '../../../../_lib/permissions'

import { clampAntiSnipeMinutes } from '@/lib/bidding/anti-snipe'
import { centsToEuros } from '@/lib/data/repositories/money'
import { getRepositories } from '@/lib/data/runtime'

export const metadata = { title: 'Pakkumiste monitor' }

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null
}

function optionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function optionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export default async function AuctionMonitorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string; teade?: string }>
}) {
  const { id } = await params
  const { viga, teade } = await searchParams
  const { session, repositories } = await requireAdminRepositories()

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) notFound()

  // Page-level authorization (D1): specialists see only assigned lots and
  // sellers only their own. The sidebar never authorizes.
  const scope = auctionScope(session.role, session.userId)
  if (!auctionInScope(scope, { specialistId: auction.specialistId, sellerId: auction.sellerId })) {
    notFound()
  }

  // The guard matrix binds bid reads to the reader's own bids, so after the
  // scope check above the feed reads run as a trusted system caller — the
  // monitor must show the whole lot feed, not the operator's own bids.
  const trusted = await getRepositories()

  const isSealed = auction.type === 'sealed'
  const bidsResult = await trusted.find({
    collection: 'bids',
    where: { auction: { equals: id } },
    sort: '-createdAt',
    ...(isSealed ? { pagination: false } : { limit: 30 }),
  })

  const initialRows: MonitorBidRow[] = isSealed
    ? []
    : bidsResult.docs.map((bid) => ({
        key: `history-${bid.id}`,
        bidId: bid.id,
        amountEur: centsToEuros(bid.amountCents),
        placedAt: bid.createdAt,
        source: bid.source,
        status: bid.status,
        backfilled: false,
      }))
  const sealedBidCount = isSealed ? bidsResult.docs.length : null

  const byAmount = [...bidsResult.docs].sort((a, b) => b.amountCents - a.amountCents)
  const leadingBid = byAmount.find((bid) => bid.status === 'leading') ?? null
  const initialPriceEur = centsToEuros(
    auction.finalPriceCents ?? leadingBid?.amountCents ?? auction.minBidCents,
  )
  const secondBid =
    leadingBid === null
      ? null
      : (byAmount.find((bid) => bid.id !== leadingBid.id && bid.amountCents < leadingBid.amountCents) ??
        null)
  const marginToSecondEur =
    leadingBid === null || secondBid === null
      ? null
      : centsToEuros(leadingBid.amountCents - secondBid.amountCents)
  const bidStepCents = auction.bidStepCents ?? 0
  const minNextBidEur =
    leadingBid !== null && bidStepCents > 0
      ? centsToEuros(leadingBid.amountCents + bidStepCents)
      : null

  // Anti-snipe extensions are recorded as `anti_snipe_extension` audit
  // entries; the log starts from that history and live `auction:extended`
  // frames append to it. Audit reads stay admin-only, so roles without
  // `audit:read` fall back to the live frames alone.
  let initialExtensions: MonitorExtensionEntry[] = []
  if (!isSealed) {
    try {
      const auditResult = await trusted.find({
        collection: 'audit-entry',
        where: {
          entityType: { equals: 'auction' },
          entityId: { equals: id },
          action: { equals: 'anti_snipe_extension' },
        },
        sort: '-createdAt',
        limit: 20,
      })
      initialExtensions = auditResult.docs.flatMap<MonitorExtensionEntry>((entry) => {
        const before = asRecord(entry.before)
        const after = asRecord(entry.after)
        const previousEndsAt = optionalString(before?.endsAt)
        const endsAt = optionalString(after?.endsAt)
        if (previousEndsAt === null || endsAt === null) return []
        return [
          {
            key: `audit-${entry.id}`,
            at: entry.createdAt,
            previousEndsAt,
            endsAt,
            windowMinutes: optionalNumber(after?.windowMinutes),
            bidId: optionalString(after?.bidId),
            live: false,
          },
        ]
      })
    } catch {
      // Operator roles without audit read permission: the SSE feed still
      // fills the extension log as extensions happen.
    }
  }

  const settingsResult = await trusted.find({ collection: 'settings', limit: 1 })
  const antiSnipeMinutes = clampAntiSnipeMinutes(
    settingsResult.docs[0]?.antiSnipeDurationMinutes,
  )
  const ended = !['draft', 'scheduled', 'active'].includes(auction.status)

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div
          role="status"
          className="mb-md rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
        >
          {teade}
        </div>
      ) : null}
      <PageHeader
        title={`Monitor: ${auction.title}`}
        description="Sama otseülekanne, mida kasutab avalik portaal. Näidatakse summasid ja aegu, mitte pakkujaid."
        backHref={`/admin/auctions/${id}`}
        actions={<StatusPill status={auction.status} />}
      />
      <BidMonitor
        auctionId={auction.id}
        title={auction.title}
        isSealed={isSealed}
        sealedBidCount={sealedBidCount}
        initialRows={initialRows}
        initialPriceEur={initialPriceEur}
        marginToSecondEur={marginToSecondEur}
        minNextBidEur={minNextBidEur}
        bidStepEur={bidStepCents > 0 ? centsToEuros(bidStepCents) : null}
        endsAt={auction.endsAt}
        initialEnded={ended}
        serverTimeIso={new Date().toISOString()}
        antiSnipeMinutes={antiSnipeMinutes}
        initialExtensions={initialExtensions}
        canEndManually={can(session.role, 'auctions:end-manual')}
      />
      {isSealed ? (
        <p className="mt-md rounded-input border border-info bg-info-light px-md py-sm text-bodySm text-info">
          Suletud oksjonil on pakkumiste sisu krüptitud kuni avamistseremooniani; monitor näitab
          ainult pakkumiste arvu. Lähtehind: {formatEur(auction.minBidCents)}.
        </p>
      ) : null}
    </div>
  )
}
