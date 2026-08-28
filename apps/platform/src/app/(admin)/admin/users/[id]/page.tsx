import Link from 'next/link'
import { notFound } from 'next/navigation'

import { updateUserAction } from '../../../_actions/users'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  authMethodLabels,
  formatDateTime,
  userRoleLabels,
  userStatusLabels,
} from '../../../_lib/labels'

import { userRoles, userStatuses } from '@/lib/data/schema'

export const metadata = { title: 'Muuda kasutajat' }

const roleOptions = userRoles
  .filter((role) => role !== 'guest')
  .map((role) => ({ value: role, label: userRoleLabels[role] }))

const statusOptions = userStatuses.map((status) => ({
  value: status,
  label: userStatusLabels[status],
}))

export default async function EditUserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const user = await repositories.findByID({ collection: 'users', id })
  if (!user) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={user.name ?? user.email}
        description="Muuda kasutaja rolli, olekut ja kontaktandmeid."
        backHref="/admin/users"
      />
      <form
        action={updateUserAction}
        className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md"
      >
        <input type="hidden" name="id" value={user.id} />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">E-post</span>
            <p className="h-10 rounded-input border border-border bg-bg-mist px-3 py-2 text-bodySm text-ink-muted">
              {user.email}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">Loodud</span>
            <p className="h-10 rounded-input border border-border bg-bg-mist px-3 py-2 text-bodySm text-ink-muted">
              {formatDateTime(user.createdAt)}
            </p>
          </div>
        </div>
        <FormField label="Nimi" name="name" defaultValue={user.name ?? ''} />
        <FormField label="Telefon" name="phone" type="tel" defaultValue={user.phone ?? ''} />
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <FormSelectField
            label="Roll"
            name="role"
            options={roleOptions}
            defaultValue={user.role}
          />
          <FormSelectField
            label="Olek"
            name="status"
            options={statusOptions}
            defaultValue={user.status}
          />
        </div>
        <p className="text-bodySm text-ink-muted">
          Sisselogimise viis: {authMethodLabels[user.authMethod]}
        </p>
        <div className="flex items-center gap-sm pt-xs">
          <button type="submit" className={primaryButtonClass}>
            Salvesta
          </button>
          <Link href="/admin/users" className={secondaryButtonClass}>
            Tühista
          </Link>
        </div>
      </form>
    </div>
  )
}
