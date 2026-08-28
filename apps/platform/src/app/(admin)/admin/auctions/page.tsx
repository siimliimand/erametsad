import Link from 'next/link'

import { deleteAuctionAction } from '../../_actions/auctions'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { primaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { PlusIcon } from '../../_components/icons'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, StatusPill } from '../../_lib/labels'

import type { AuctionDoc } from '@/lib/data/repositories'

interface AuctionRow {
  id: string
  title: string
  status: AuctionDoc['status']
  startsAt: string | null
  endsAt: string | null
  bidCount: number
}

export const metadata = { title: 'Oksjonid' }

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'auctions',
    sort: '-createdAt',
    limit: 25,
  })
  const rows: AuctionRow[] = await Promise.all(
    docs.map(async (auction) => {
      const bids = await repositories.find({
        collection: 'bids',
        where: { auction: { equals: auction.id } },
        pagination: false,
      })
      return {
        id: auction.id,
        title: auction.title,
        status: auction.status,
        startsAt: auction.startsAt,
        endsAt: auction.endsAt,
        bidCount: bids.docs.length,
      }
    }),
  )

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Oksjonid"
        description="Kõik oksjonid koos oleku, ajade ja pakkumuste arvuga."
        actions={
          <Link href="/admin/auctions/new" className={primaryButtonClass}>
            <PlusIcon />
            Loo oksjon
          </Link>
        }
      />
      <DataTable
        columns={[
          { key: 'title', label: 'Pealkiri' },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <StatusPill status={row.status} />,
          },
          { key: 'startsAt', label: 'Algab', render: (row) => formatDateTime(row.startsAt) },
          { key: 'endsAt', label: 'Lõpeb', render: (row) => formatDateTime(row.endsAt) },
          { key: 'bidCount', label: 'Pakkumusi' },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteAuctionAction}>
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  className="text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80"
                >
                  Kustuta
                </button>
              </form>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Oksjoneid ei ole. Loo esimene oksjon."
      />
    </div>
  )
}
