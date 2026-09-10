import { notFound } from 'next/navigation'

import { BidMonitor, type MonitorBidRow, type MonitorExtensionEntry, type MonitorUnderbidRow } from './bid-monitor'
import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { StatusPill, formatEur } from '../../../../_lib/labels'
import { auctionInScope, auctionScope, can } from '../../../../_lib/permissions'
import { flaggedUserIdsFromEntries } from '../../../users/_components/user-search'

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

  // Masked bidder aliases ("Pakkuja #N") are feed-local and carry no
  // identity: numbers follow first appearance from the oldest bid onward.
  // Real identity leaves the server only through the audited
  // revealBidderIdentityAction (`user.identity_view`).
  const aliasById = new Map<string, number>()
  for (const bid of [...bidsResult.docs].reverse()) {
    if (aliasById.has(bid.userId)) continue
    aliasById.set(bid.userId, aliasById.size + 1)
  }
  const bidderIds = [...aliasById.keys()]
  const accountCreatedAtById = new Map<string, string>()
  if (bidderIds.length > 0) {
    try {
      const usersResult = await trusted.find({
        collection: 'users',
        where: { id: { in: bidderIds } },
        pagination: false,
      })
      for (const user of usersResult.docs) {
        accountCreatedAtById.set(user.id, user.createdAt)
      }
    } catch {
      // Account ages feed the advisory new-account heuristic only; the
      // monitor feed works without them.
    }
  }

  // Anomaly heuristics and their evidence (ip_hash, account ages) stay with
  // admin/superadmin: the gate is server-side, so sellers and specialists
  // neither receive the ip_hash data nor the anomaly panel at all (spec:
  // anomaly cards hidden from sellers). Declared before the row build below
  // needs it.
  const canViewAnomalies = can(session.role, 'audit:read')

  // Shill flags (spec delta admin-people): flagged bidder ids come from the
  // append-only `user.shill_flag` audit entries; only bidders of this lot
  // are passed down, so the client never receives the whole flag list.
  const flaggedBidderIds: string[] = []
  try {
    const flagResult = await trusted.find({
      collection: 'audit-entry',
      where: { action: { equals: 'user.shill_flag' } },
      sort: '-createdAt',
      pagination: false,
      limit: 2000,
    })
    const flagged = flaggedUserIdsFromEntries(flagResult.docs)
    for (const bidderId of bidderIds) {
      if (flagged.has(bidderId)) flaggedBidderIds.push(bidderId)
    }
  } catch {
    // Roles without audit read keep the feed; the flag icons degrade away.
  }

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
        bidderId: bid.userId,
        bidderAlias: aliasById.get(bid.userId) ?? null,
        bidderAccountCreatedAt: accountCreatedAtById.get(bid.userId) ?? null,
        ipHash: canViewAnomalies ? (bid.ipHash ?? null) : null,
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

  // Pending alapakkumised for this lot (oldest first). Accepting promotes
  // the alapakkumine itself to leading (approveAlapakkumine), so the
  // resulting leading amount is the bid's own amount — offered only when
  // no strictly higher leader blocks the promotion. Sealed rows keep the
  // amount hidden until the opening ceremony, so they carry no accept
  // affordance here.
  const pendingUnderbids = bidsResult.docs
    .filter((bid) => bid.status === 'pending_approval')
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
  const underbids: MonitorUnderbidRow[] = pendingUnderbids.map((bid) => {
    const canBecomeLeading =
      !isSealed && (leadingBid === null || leadingBid.amountCents <= bid.amountCents)
    const amountEur = isSealed ? null : centsToEuros(bid.amountCents)
    return {
      key: `underbid-${bid.id}`,
      bidId: bid.id,
      bidderId: bid.userId,
      bidderAlias: aliasById.get(bid.userId) ?? null,
      amountEur,
      submittedAt: bid.createdAt,
      resultingLeadingEur: canBecomeLeading ? amountEur : null,
      canBecomeLeading,
    }
  })

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
        description="Sama otseülekanne, mida kasutab avalik portaal. Vaikimisi näidatakse summasid ja aegu; identiteet avaneb ainult auditeeritud paljastamisega."
        backHref={`/auctions/${id}`}
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
        // audit:read binds anomalies to admin/superadmin (sellers and
        // specialists are denied); the same role set holds the audited
        // anomaly.flag write, so it also gates "Märgi uurimiseks".
        canViewAnomalies={canViewAnomalies}
        // bids:write denies sellers, so the ip_hash-carrying export and its
        // affordance stay with admin/superadmin/specialist.
        canExportBids={can(session.role, 'bids:write')}
        canViewUsers={can(session.role, 'users:read')}
        canViewCeremony={can(session.role, 'sealed:read')}
        canDecideUnderbids={auction.status === 'active'}
        underbids={underbids}
        flaggedBidderIds={flaggedBidderIds}
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
