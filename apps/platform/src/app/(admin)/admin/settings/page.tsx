import { NotificationTemplates } from './_components/NotificationTemplates'
import { SettingsForm } from './_components/SettingsForm'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { can } from '../../_lib/permissions'

export const metadata = { title: 'Seaded' }

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { session, repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({ collection: 'settings', limit: 1 })
  const settings = docs[0]

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Seaded"
        description="Platvormi seaded: üldsätted, oksjonite reeglid, teenustasud, päringud, integratsioonid ja õigused."
      />
      {can(session.role, 'settings:write') ? null : (
        <div
          role="note"
          className="mb-md rounded-input border border-border bg-bgMist px-md py-sm text-bodySm font-medium text-inkMuted"
        >
          Muutmise õigus puudub — teavita superadminit.
        </div>
      )}
      <SettingsForm settings={settings} />
      <div className="mt-lg">
        <NotificationTemplates />
      </div>
    </div>
  )
}
