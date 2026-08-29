import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { StatisticsSnapshotForm } from '../../_components/StatisticsSnapshotForm'

export const metadata = { title: 'Uus statistikakirje' }

export default async function NewStatisticsSnapshotPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus statistikakirje"
        description="Lisa statistilise kokkuvõtte kirje kuupäeva ja tüübiga."
        backHref="/admin/content/statistics"
      />
      <StatisticsSnapshotForm />
    </div>
  )
}
