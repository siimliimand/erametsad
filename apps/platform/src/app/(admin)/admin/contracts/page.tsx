import Link from 'next/link'

import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { ContractStatusPill, formatDateTime } from '../../_lib/labels'

import type { UserDoc } from '@/lib/data/repositories'
import type { ContractStatus } from '@/lib/data/schema'

interface ContractRow {
  id: string
  status: string
  createdAt: string
  auctionTitle: string
  sellerName: string
  sellerId: string | null
  buyerName: string
  buyerId: string | null
}

export const metadata = { title: 'Lepingud' }

export default async function AdminContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs: contracts } = await repositories.find({
    collection: 'contracts',
    sort: '-createdAt',
    limit: 50,
  })

  const lotIds = [...new Set(contracts.map((contract) => contract.lotId))]
  const auctions =
    lotIds.length > 0
      ? (
          await repositories.find({
            collection: 'auctions',
            where: { id: { in: lotIds } },
            pagination: false,
          })
        ).docs
      : []
  const auctionById = new Map(auctions.map((auction) => [auction.id, auction]))

  const winningBidIds = [
    ...new Set(auctions.map((auction) => auction.winningBid).filter((id): id is string => !!id)),
  ]
  const winningBids =
    winningBidIds.length > 0
      ? (
          await repositories.find({
            collection: 'bids',
            where: { id: { in: winningBidIds } },
            pagination: false,
          })
        ).docs
      : []
  const bidById = new Map(winningBids.map((bid) => [bid.id, bid]))

  const partyIds = [
    ...new Set(
      [
        ...auctions.map((auction) => auction.sellerId),
        ...winningBids.map((bid) => bid.userId),
      ].filter((id): id is string => !!id),
    ),
  ]
  const parties: UserDoc[] =
    partyIds.length > 0
      ? (
          await repositories.find({
            collection: 'users',
            where: { id: { in: partyIds } },
            pagination: false,
          })
        ).docs
      : []
  const userLabel = new Map(parties.map((party) => [party.id, party.name ?? party.email]))

  const rows: ContractRow[] = contracts.map((contract) => {
    const auction = auctionById.get(contract.lotId)
    const winningBid = auction?.winningBid ? bidById.get(auction.winningBid) : undefined
    return {
      id: contract.id,
      status: contract.status,
      createdAt: contract.createdAt,
      auctionTitle: auction?.title ?? contract.lotId,
      sellerName: auction?.sellerId ? (userLabel.get(auction.sellerId) ?? auction.sellerId) : '—',
      sellerId: auction?.sellerId ?? null,
      buyerName: winningBid ? (userLabel.get(winningBid.userId) ?? winningBid.userId) : '—',
      buyerId: winningBid?.userId ?? null,
    }
  })

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Lepingud"
        description="Sõlmitavad ja sõlmitud müügilepingud koos pooltega."
        actions={
          <Link href="/admin/contracts/templates" className={secondaryButtonClass}>
            Lepingu mallid
          </Link>
        }
      />
      <DataTable
        columns={[
          { key: 'auctionTitle', label: 'Oksjon' },
          {
            key: 'sellerName',
            label: 'Müüja',
            render: (row) =>
              row.sellerId ? (
                <Link
                  href={`/admin/users/${row.sellerId}`}
                  className="text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {row.sellerName}
                </Link>
              ) : (
                row.sellerName
              ),
          },
          {
            key: 'buyerName',
            label: 'Ostja',
            render: (row) =>
              row.buyerId ? (
                <Link
                  href={`/admin/users/${row.buyerId}`}
                  className="text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                >
                  {row.buyerName}
                </Link>
              ) : (
                row.buyerName
              ),
          },
          { key: 'status', label: 'Olek', render: (row) => <ContractStatusPill status={row.status as ContractStatus} /> },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <Link
                href={`/admin/contracts/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                Vaata
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Lepinguid ei ole."
      />
    </div>
  )
}
