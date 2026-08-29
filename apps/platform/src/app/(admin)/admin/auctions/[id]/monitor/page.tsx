import { notFound } from 'next/navigation'

import { BidMonitor, type MonitorBidRow } from './bid-monitor'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { StatusPill, formatEur } from '../../../../_lib/labels'

export const metadata = { title: 'Pakkumiste monitor' }

export default async function AuctionMonitorPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { repositories } = await requireAdminRepositories()

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) notFound()

  // Open auctions only carry meaningful amounts; sealed amounts stay
  // encrypted in D1, so the history list hides them (amount 0).
  const isSealed = auction.type === 'sealed'
  const bidsResult = await repositories.find({
    collection: 'bids',
    where: { auction: { equals: id } },
    sort: '-createdAt',
    limit: 15,
  })
  const initialRows: MonitorBidRow[] = isSealed
    ? []
    : bidsResult.docs.map((bid) => ({
        key: `history-${bid.id}`,
        amountEur: bid.amountCents / 100,
        placedAt: bid.createdAt,
        live: false,
      }))
  const leadingBid = bidsResult.docs.find((bid) => bid.status === 'leading') ?? null
  const initialPriceEur =
    (auction.finalPriceCents ?? leadingBid?.amountCents ?? auction.minBidCents) / 100
  const ended = !['draft', 'scheduled', 'active'].includes(auction.status)

  return (
    <div>
      <PageHeader
        title={`Monitor: ${auction.title}`}
        description="Sama otseülekanne, mida kasutab avalik portaal. Näidatakse summasid ja aegu, mitte pakkujaid."
        backHref={`/admin/auctions/${id}`}
        actions={<StatusPill status={auction.status} />}
      />
      {isSealed ? (
        <p className="mb-md rounded-input border border-info bg-info-light px-md py-sm text-bodySm text-info">
          Suletud oksjonil on pakkumiste sisu krüptitud kuni avamistseremooniani; monitor näitab
          ainult otseülekande sündmusi. Hetkehind: {formatEur(auction.minBidCents)} (lähtehind).
        </p>
      ) : null}
      <BidMonitor
        auctionId={auction.id}
        title={auction.title}
        initialRows={initialRows}
        initialPriceEur={initialPriceEur}
        endsAt={auction.endsAt}
        initialEnded={ended}
      />
    </div>
  )
}
