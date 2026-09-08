import Link from 'next/link'

import { DataTable, type DataTableColumn } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { StatusChip } from '../../_components/StatusChip'
import { requireAdminRepositories } from '../../_lib/admin'
import { auctionObjectTypeLabels, formatDateTime } from '../../_lib/labels'
import { can } from '../../_lib/permissions'

import type { AuctionObjectType } from '@/lib/data/schema'

export const metadata = { title: 'Sul. avamine' }

interface SealedOpeningRow {
  id: string
  title: string
  objectType: AuctionObjectType
  endsAt: string | null
  sealedBidCount: number
}

export default async function AdminSealedOpeningPage() {
  const { session, repositories } = await requireAdminRepositories()

  if (!can(session.role, 'sealed:read')) {
    return (
      <ErrorNotice message="Teil puudub õigus suletud pakkumiste avamise vaatamiseks." />
    )
  }

  // Queue mirrors the rail badge query in the admin layout: sealed auctions
  // whose ceremony has not advanced yet (status is still 'ended', not
  // 'appraised'/'unsold'), matching what /ceremony gates the flow on.
  const { docs } = await repositories.find({
    collection: 'auctions',
    where: {
      and: [{ type: { equals: 'sealed' } }, { status: { equals: 'ended' } }],
    },
    sort: '-endsAt',
    pagination: false,
  })

  const sealedBidCounts = new Map<string, number>()
  if (docs.length > 0) {
    const sealedBids = await repositories.find({
      collection: 'bids',
      where: {
        and: [
          { auction: { in: docs.map((doc) => doc.id) } },
          { type: { equals: 'sealed' } },
        ],
      },
      pagination: false,
      limit: 2000,
    })
    for (const bid of sealedBids.docs) {
      sealedBidCounts.set(
        bid.auctionId,
        (sealedBidCounts.get(bid.auctionId) ?? 0) + 1,
      )
    }
  }

  const rows: SealedOpeningRow[] = docs.map((doc) => ({
    id: doc.id,
    title: doc.title,
    objectType: doc.objectType,
    endsAt: doc.endsAt,
    sealedBidCount: sealedBidCounts.get(doc.id) ?? 0,
  }))

  const columns: readonly DataTableColumn<SealedOpeningRow>[] = [
    {
      key: 'title',
      label: 'Oksjon',
      render: (row) => (
        <Link
          href={`/admin/auctions/${row.id}/ceremony`}
          className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: 'objectType',
      label: 'Objekt',
      render: (row) => auctionObjectTypeLabels[row.objectType],
    },
    {
      key: 'status',
      label: 'Olek',
      render: () => <StatusChip status="ended" />,
    },
    {
      key: 'sealedBidCount',
      label: 'Suletud pakkumisi',
      render: (row) => String(row.sealedBidCount),
    },
    {
      key: 'endsAt',
      label: 'Lõppes',
      render: (row) => (row.endsAt ? formatDateTime(row.endsAt) : '—'),
    },
    {
      key: 'actions',
      label: 'Tegevused',
      render: (row) => (
        <Link
          href={`/admin/auctions/${row.id}/ceremony`}
          className="whitespace-nowrap font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
        >
          Ava tseremoonia
        </Link>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        breadcrumb={
          <>
            <Link
              href="/admin"
              className="transition-colors duration-hover ease-hover hover:text-primary"
            >
              Töölaud
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Sul. avamine</span>
          </>
        }
        title="Suletud pakkumiste avamine"
        description="Lõppenud suletud oksjonid, mis ootavad avamise tseremooniat. Pakkumised on krüpteeritud kuni üheaegse paljastamiseni."
        actions={
          rows.length > 0 ? (
            <span className="rounded-pill bg-[var(--st-ended-bg)] px-3 py-1 text-label font-semibold text-[color:var(--st-ended-text)]">
              {String(rows.length)} ootel
            </span>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        emptyLabel="Avamise tseremooniat ootavaid oksjoneid ei ole."
      />
    </div>
  )
}
