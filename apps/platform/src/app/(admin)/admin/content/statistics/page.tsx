import Link from 'next/link'

import { deleteStatisticsSnapshotAction } from '../../../_actions/content'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import { auctionObjectTypeLabels, formatEurAmount } from '../../../_lib/labels'

import type { StatisticsSnapshotDoc } from '@/lib/data/repositories'

interface StatisticsRow {
  id: string
  date: string
  objectType: StatisticsSnapshotDoc['objectType']
  count: number
  area: number | null
  volume: number | null
  eur: number
}

export const metadata = { title: 'Statistika' }

export default async function AdminStatisticsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'statistics-snapshots',
    sort: '-date',
    pagination: false,
  })
  const rows: StatisticsRow[] = docs.map((snapshot) => ({
    id: snapshot.id,
    date: snapshot.date,
    objectType: snapshot.objectType,
    count: snapshot.count,
    area: snapshot.area,
    volume: snapshot.volume,
    eur: snapshot.eur,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Statistika"
        description="Müügistatistika kokkuvõtted kuupäeva ja objekti tüübi järgi."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/statistics/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus kirje
          </Link>
        }
      />
      <DataTable
        columns={[
          {
            key: 'date',
            label: 'Kuupäev',
            render: (row) => row.date.slice(0, 10),
          },
          {
            key: 'objectType',
            label: 'Objekti tüüp',
            render: (row) => auctionObjectTypeLabels[row.objectType],
          },
          { key: 'count', label: 'Arv' },
          {
            key: 'area',
            label: 'Pindala (ha)',
            render: (row) => (row.area !== null ? String(row.area) : '—'),
          },
          {
            key: 'volume',
            label: 'Maht (m³)',
            render: (row) => (row.volume !== null ? String(row.volume) : '—'),
          },
          {
            key: 'eur',
            label: 'Summa',
            render: (row) => formatEurAmount(row.eur),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteStatisticsSnapshotAction}>
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
        emptyLabel="Statistikakirjeid ei ole."
      />
    </div>
  )
}
