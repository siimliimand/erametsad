import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  deleteAuctionAction,
  generateContractAction,
  publishAuctionAction,
  rejectAuctionBidAction,
  approveAuctionBidAction,
} from '../../../_actions/auctions'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass, secondaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  bidSourceLabels,
  bidStatusLabels,
  contractStatusLabels,
  formatDateTime,
  formatEur,
  formatRelativeTime,
  StatusPill,
} from '../../../_lib/labels'

import type { Bid } from '@/lib/data/schema'

export const metadata = { title: 'Oksjoni detailvaade' }

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
      <span className="text-label font-semibold text-ink-muted">{label}</span>
      <span className="text-bodySm font-semibold text-ink">{value}</span>
    </div>
  )
}

function SuccessNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-md rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
    >
      {message}
    </div>
  )
}

const rejectButtonClass =
  'text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80'

export default async function AuctionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string; teade?: string }>
}) {
  const { id } = await params
  const { viga, teade } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) notFound()
  const detailPath = `/admin/auctions/${id}`

  const [bidsResult, pendingResult, contractsResult, specialistResult, countyResult, parishResult] =
    await Promise.all([
      repositories.find({
        collection: 'bids',
        where: { auction: { equals: id } },
        sort: '-createdAt',
        pagination: false,
      }),
      repositories.find({
        collection: 'bids',
        where: {
          and: [
            { auction: { equals: id } },
            { status: { equals: 'pending_approval' } },
          ],
        },
        sort: '-createdAt',
        pagination: false,
      }),
      repositories.find({
        collection: 'contracts',
        where: { lot: { equals: id } },
        sort: '-createdAt',
        pagination: false,
      }),
      auction.specialistId
        ? repositories.findByID({ collection: 'specialists', id: auction.specialistId })
        : Promise.resolve(null),
      auction.countyId
        ? repositories.findByID({ collection: 'counties', id: auction.countyId })
        : Promise.resolve(null),
      auction.parishId
        ? repositories.findByID({ collection: 'parishes', id: auction.parishId })
        : Promise.resolve(null),
    ])

  const bids = bidsResult.docs as Bid[]
  const pendingBids = pendingResult.docs as Bid[]
  const leadingBid = bids.find((bid) => bid.status === 'leading') ?? null
  const currentPriceCents =
    auction.finalPriceCents ??
    leadingBid?.amountCents ??
    auction.minBidCents
  const isFinished = ['ended', 'appraised', 'unsold', 'contract', 'completed', 'archived'].includes(
    auction.status,
  )
  const canPublish = auction.status === 'draft' || auction.status === 'scheduled'
  const ceremonyReady = auction.type === 'sealed' && auction.status === 'ended'
  const canGenerateContract =
    auction.status === 'appraised' && contractsResult.docs.length === 0
  const contracts = contractsResult.docs as {
    id: string
    status: keyof typeof contractStatusLabels
    createdAt: string
  }[]

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? <SuccessNotice message={teade} /> : null}
      <PageHeader
        title={auction.title}
        description={`URL-nimi: ${auction.slug}`}
        backHref="/admin/auctions"
        actions={
          <>
            <StatusPill status={auction.status} />
            {canPublish ? (
              <form action={publishAuctionAction}>
                <input type="hidden" name="id" value={auction.id} />
                <button type="submit" className={primaryButtonClass}>
                  Avalikusta
                </button>
              </form>
            ) : null}
            <Link href={`${detailPath}/monitor`} className={secondaryButtonClass}>
              Pakkumiste monitor
            </Link>
            {ceremonyReady ? (
              <Link href={`${detailPath}/ceremony`} className={secondaryButtonClass}>
                Pitseeritud avamine
              </Link>
            ) : null}
            <Link href={`${detailPath}/edit`} className={secondaryButtonClass}>
              Muuda
            </Link>
            <form action={deleteAuctionAction}>
              <input type="hidden" name="id" value={auction.id} />
              <button type="submit" className={rejectButtonClass}>
                Kustuta
              </button>
            </form>
          </>
        }
      />

      <section className="mb-md grid grid-cols-1 gap-xs sm:grid-cols-2 lg:grid-cols-4">
        <InfoRow
          label="Hetkehind"
          value={isFinished && auction.finalPriceCents === null ? '—' : formatEur(currentPriceCents)}
        />
        <InfoRow label="Pakkumusi" value={String(bids.length)} />
        <InfoRow label="Objekti tüüp" value={auction.objectType} />
        <InfoRow
          label="Oksjoni tüüp"
          value={auction.type === 'sealed' ? 'Suletud (pitserta)' : 'Avatud'}
        />
        <InfoRow label="Lähtehind" value={formatEur(auction.minBidCents)} />
        <InfoRow label="Pakkumise samm" value={formatEur(auction.bidStepCents)} />
        <InfoRow label="Reservhind" value={formatEur(auction.reservePriceCents)} />
        <InfoRow
          label="Lõpphind"
          value={auction.finalPriceCents === null ? '—' : formatEur(auction.finalPriceCents)}
        />
        <InfoRow label="Algus" value={formatDateTime(auction.startsAt)} />
        <InfoRow label="Lõpp" value={formatDateTime(auction.endsAt)} />
        <InfoRow
          label="Asukoht"
          value={
            [countyResult?.name, parishResult?.name, auction.address]
              .filter((part) => part !== null && part !== undefined && part !== '')
              .join(', ') || '—'
          }
        />
        <InfoRow label="Spetsialist" value={specialistResult?.name ?? '—'} />
      </section>

      {canGenerateContract ? (
        <section className="mb-md rounded-card border border-border bg-bgPage p-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Lepingu voog</h2>
          <p className="mb-sm text-bodySm text-ink-muted">
            Oksjon on hinnatud ja võitja määratud. Koosta võitjale oksjonileping.
          </p>
          <form action={generateContractAction}>
            <input type="hidden" name="auctionId" value={auction.id} />
            <button type="submit" className={primaryButtonClass}>
              Genereeri leping
            </button>
          </form>
        </section>
      ) : null}

      {contracts.length > 0 ? (
        <section className="mb-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Lepingud</h2>
          <DataTable
            columns={[
              { key: 'id', label: 'Number' },
              {
                key: 'status',
                label: 'Olek',
                render: (row) => contractStatusLabels[row.status],
              },
              { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
            ]}
            rows={contracts}
            emptyLabel="Lepinguid pole."
          />
        </section>
      ) : null}

      {pendingBids.length > 0 ? (
        <section className="mb-md">
          <h2 className="mb-xs font-heading text-h4 font-bold text-ink">
            Alapakkumused ootel ({String(pendingBids.length)})
          </h2>
          <p className="mb-xs text-bodySm text-ink-muted">
            Lähtehinnast madalamad pakkumused vajavad müüja või administraatori otsust.
          </p>
          <DataTable
            columns={[
              { key: 'amountCents', label: 'Summa', render: (row) => formatEur(row.amountCents) },
              {
                key: 'createdAt',
                label: 'Aeg',
                render: (row) => formatRelativeTime(row.createdAt),
              },
              {
                key: 'source',
                label: 'Allikas',
                render: (row) => bidSourceLabels[row.source],
              },
              {
                key: 'actions',
                label: 'Otsus',
                render: (row) => (
                  <span className="flex items-center gap-sm">
                    <form action={approveAuctionBidAction}>
                      <input type="hidden" name="auctionId" value={auction.id} />
                      <input type="hidden" name="bidId" value={row.id} />
                      <button
                        type="submit"
                        className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
                      >
                        Kinnita
                      </button>
                    </form>
                    <form action={rejectAuctionBidAction}>
                      <input type="hidden" name="auctionId" value={auction.id} />
                      <input type="hidden" name="bidId" value={row.id} />
                      <button type="submit" className={rejectButtonClass}>
                        Lükka tagasi
                      </button>
                    </form>
                  </span>
                ),
              },
            ]}
            rows={pendingBids}
          />
        </section>
      ) : null}

      <section>
        <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Pakkumused</h2>
        <DataTable
          columns={[
            { key: 'amountCents', label: 'Summa', render: (row) => formatEur(row.amountCents) },
            { key: 'createdAt', label: 'Aeg', render: (row) => formatRelativeTime(row.createdAt) },
            {
              key: 'status',
              label: 'Olek',
              render: (row) => bidStatusLabels[row.status],
            },
            {
              key: 'source',
              label: 'Allikas',
              render: (row) => bidSourceLabels[row.source],
            },
          ]}
          rows={bids.slice(0, 15)}
          emptyLabel="Pakkumusi pole."
        />
        <p className="mt-xs text-bodySm text-ink-muted">
          Nimekirjas näidatakse ainult summasid ja aegu; pakkujate identiteeti ei avaldata.
        </p>
      </section>
    </div>
  )
}
