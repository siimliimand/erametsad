import { SettingsForm } from './_components/SettingsForm'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'

export const metadata = { title: 'Seaded' }

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({ collection: 'settings', limit: 1 })
  const settings = docs[0]

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Seaded"
        description="Platvormi seaded: üldsätted, oksjonite reeglid, teenustasud, päringud, integratsioonid ja õigused."
      />
      <SettingsForm settings={settings} />
    </div>
  )
}
