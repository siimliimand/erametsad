import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CeremonyFlow } from './ceremony-flow'
import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { secondaryButtonClass } from '../../../../_components/FormField'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { contractStatusLabels, formatDateTime, formatEur, StatusPill } from '../../../../_lib/labels'

export const metadata = { title: 'Pitseeritud avamine' }

export default async function AuctionCeremonyPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (auction?.type !== 'sealed') notFound()
  const detailPath = `/admin/auctions/${id}`

  const sealedBidsResult = await repositories.find({
    collection: 'bids',
    where: {
      and: [
        { auction: { equals: id } },
        { type: { equals: 'sealed' } },
      ],
    },
    pagination: false,
  })
  const contractsResult = await repositories.find({
    collection: 'contracts',
    where: { lot: { equals: id } },
    sort: '-createdAt',
    pagination: false,
  })
  const contracts = contractsResult.docs as {
    id: string
    status: keyof typeof contractStatusLabels
    createdAt: string
  }[]

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={`Pitseeritud avamine: ${auction.title}`}
        description="Kahesammuline tseremoonia: kaks erinevat administraatorit avavad lukustatud pakkumused."
        backHref={detailPath}
        actions={<StatusPill status={auction.status} />}
      />

      {auction.status === 'ended' ? (
        <CeremonyFlow
          auctionId={auction.id}
          sealedBidCount={sealedBidsResult.docs.length}
          reservePriceCents={auction.reservePriceCents ?? null}
        />
      ) : auction.status === 'appraised' ? (
        <div className="space-y-md">
          <section className="rounded-card border border-l-4 border-info bg-info-light p-md">
            <h2 className="mb-xs font-heading text-h4 font-bold text-info">Tseremoonia läbi</h2>
            <p className="text-bodySm text-info">
              Võitja on kinnitatud. Lõpphind:{' '}
              <span className="font-semibold">{formatEur(auction.finalPriceCents)}</span>
              {auction.winningBid ? <> Võidupakkumus: {auction.winningBid}</> : null}
            </p>
          </section>
          {contracts.length > 0 ? (
            <section className="rounded-card border border-border bg-bgPage p-md">
              <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Lepingud</h2>
              <ul className="space-y-xs text-bodySm text-ink">
                {contracts.map((contract) => (
                  <li key={contract.id}>
                    {contract.id} — {contractStatusLabels[contract.status]} —{' '}
                    {formatDateTime(contract.createdAt)}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </div>
      ) : auction.status === 'unsold' ? (
        <div className="space-y-md">
          <section className="rounded-card border border-l-4 border-danger bg-danger-light p-md">
            <h2 className="mb-xs font-heading text-h4 font-bold text-danger">Müümata</h2>
            <p className="text-bodySm text-danger">
              Avamine tühistati või reservhind jäi täitmata; võitjat pole.
            </p>
          </section>
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </div>
      ) : (
        <div className="space-y-md">
          <section className="rounded-card border border-border bg-bgPage p-md">
            <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Ootel</h2>
            <p className="text-bodySm text-ink-muted">
              Tseremoonia on võimalik ainult lõppenud suletud oksjonil. Krüptitud pakkumusi:{' '}
              <span className="font-semibold text-ink">{String(sealedBidsResult.docs.length)}</span>.
            </p>
          </section>
          <Link href={detailPath} className={secondaryButtonClass}>
            Tagasi detailvaatesse
          </Link>
        </div>
      )}
    </div>
  )
}
