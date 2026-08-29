import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { StatisticsSnapshotForm } from '../../_components/StatisticsSnapshotForm'

export const metadata = { title: 'Muuda statistikakirjet' }

export default async function EditStatisticsSnapshotPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const snapshot = await repositories.findByID({ collection: 'statistics-snapshots', id })
  if (!snapshot) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={snapshot.date.slice(0, 10)}
        description="Muuda statistikakirje arve ja summat."
        backHref="/admin/content/statistics"
      />
      <StatisticsSnapshotForm snapshot={snapshot} />
    </div>
  )
}
