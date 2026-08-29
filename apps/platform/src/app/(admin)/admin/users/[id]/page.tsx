import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  grantAuctionRightAction,
  revokeAuctionRightAction,
  revokeUserSessionAction,
  updateUserAction,
} from '../../../_actions/users'
import { DataTable } from '../../../_components/DataTable'
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
  auctionObjectTypeLabels,
  authMethodLabels,
  formatDateTime,
  maskIsikukood,
  userRoleLabels,
  userStatusLabels,
} from '../../../_lib/labels'

import { listUserSessions } from '@/lib/auth/session'
import type { UserDoc } from '@/lib/data/repositories'
import { auctionObjectTypes, userRoles, userStatuses } from '@/lib/data/schema'

export const metadata = { title: 'Muuda kasutajat' }

const roleOptions = userRoles
  .filter((role) => role !== 'guest')
  .map((role) => ({ value: role, label: userRoleLabels[role] }))

const statusOptions = userStatuses.map((status) => ({
  value: status,
  label: userStatusLabels[status],
}))

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-danger hover:text-danger'

interface RightRow {
  id: string
  objectType: string
  grantedAt: string
  grantedByName: string
  revokedAt: string | null
  userId: string
}

interface SessionRow {
  id: string
  sessionId: string
  createdAt: string
  userId: string
}

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

  const [rights, sessions] = await Promise.all([
    repositories.find({
      collection: 'auction-rights',
      where: { user: { equals: id } },
      sort: '-grantedAt',
      pagination: false,
    }),
    listUserSessions(id),
  ])

  const granterIds = [...new Set(rights.docs.map((right) => right.grantedBy))]
  const granters: UserDoc[] =
    granterIds.length > 0
      ? (
          await repositories.find({
            collection: 'users',
            where: { id: { in: granterIds } },
            pagination: false,
          })
        ).docs
      : []
  const granterNames = new Map(granters.map((granter) => [granter.id, granter.name ?? granter.email]))

  const rightRows: RightRow[] = rights.docs.map((right) => ({
    id: right.id,
    objectType: right.objectType,
    grantedAt: right.grantedAt,
    grantedByName: granterNames.get(right.grantedBy) ?? right.grantedBy,
    revokedAt: right.revokedAt,
    userId: id,
  }))

  const sessionRows: SessionRow[] = sessions.map((sessionInfo) => ({
    id: sessionInfo.sessionId,
    sessionId: sessionInfo.sessionId,
    createdAt: sessionInfo.createdAt.toISOString(),
    userId: id,
  }))

  const activeObjectTypes = new Set(
    rights.docs.filter((right) => right.revokedAt === null).map((right) => right.objectType),
  )
  const grantOptions = auctionObjectTypes
    .filter((objectType) => !activeObjectTypes.has(objectType))
    .map((objectType) => ({ value: objectType, label: auctionObjectTypeLabels[objectType] }))

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
          <div className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">Isikukood</span>
            <p className="h-10 rounded-input border border-border bg-bg-mist px-3 py-2 text-bodySm text-ink-muted">
              {maskIsikukood(user.isikukood)}
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">Sisselogimise viis</span>
            <p className="h-10 rounded-input border border-border bg-bg-mist px-3 py-2 text-bodySm text-ink-muted">
              {authMethodLabels[user.authMethod]}
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
        <div className="flex items-center gap-sm pt-xs">
          <button type="submit" className={primaryButtonClass}>
            Salvesta
          </button>
          <Link href="/admin/users" className={secondaryButtonClass}>
            Tühista
          </Link>
        </div>
      </form>

      <section className="mt-lg">
        <h2 className="font-heading text-h4 font-bold text-ink">Oksjoniõigused</h2>
        <p className="mt-xs text-bodySm text-ink-muted">
          Millistes objekti tüüpides tohib kasutaja pakkumusi teha.
        </p>
        <div className="mt-sm">
          <DataTable
            columns={[
              {
                key: 'objectType',
                label: 'Objekti tüüp',
                render: (row) => auctionObjectTypeLabels[row.objectType as keyof typeof auctionObjectTypeLabels],
              },
              { key: 'grantedAt', label: 'Antud', render: (row) => formatDateTime(row.grantedAt) },
              { key: 'grantedByName', label: 'Andja' },
              {
                key: 'revokedAt',
                label: 'Olek',
                render: (row) =>
                  row.revokedAt === null ? (
                    <span className="text-label font-semibold text-primaryDark">Kehtiv</span>
                  ) : (
                    <span className="text-label font-semibold text-ink-muted">
                      Tühistatud {formatDateTime(row.revokedAt)}
                    </span>
                  ),
              },
              {
                key: 'actions',
                label: 'Tegevused',
                render: (row) =>
                  row.revokedAt === null ? (
                    <form action={revokeAuctionRightAction}>
                      <input type="hidden" name="rightId" value={row.id} />
                      <input type="hidden" name="userId" value={row.userId} />
                      <button type="submit" className={smallButtonClass}>
                        Tühista õigus
                      </button>
                    </form>
                  ) : (
                    '—'
                  ),
              },
            ]}
            rows={rightRows}
            emptyLabel="Kasutajal ei ole oksjoniõigusi."
          />
        </div>
        {grantOptions.length > 0 ? (
          <form
            action={grantAuctionRightAction}
            className="mt-sm flex max-w-container-sm flex-wrap items-end gap-sm rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="userId" value={user.id} />
            <div className="w-64">
              <FormSelectField
                label="Anna uus õigus"
                name="objectType"
                options={grantOptions}
                defaultValue={grantOptions[0]?.value}
              />
            </div>
            <button type="submit" className={primaryButtonClass}>
              Anna õigus
            </button>
          </form>
        ) : (
          <p className="mt-sm text-bodySm text-ink-muted">
            Kõik objekti tüübid on juba õigustatud.
          </p>
        )}
      </section>

      <section className="mt-lg">
        <h2 className="font-heading text-h4 font-bold text-ink">Aktiivsed sessioonid</h2>
        <p className="mt-xs text-bodySm text-ink-muted">
          Kasutaja avatud sisselogimisseansid. Tühistamine sunnib uue sisselogimise.
        </p>
        <div className="mt-sm">
          <DataTable
            columns={[
              {
                key: 'sessionId',
                label: 'Sessioon',
                render: (row) => (
                  <span className="font-mono text-bodySm">{row.sessionId.slice(0, 8)}</span>
                ),
              },
              { key: 'createdAt', label: 'Algatatud', render: (row) => formatDateTime(row.createdAt) },
              {
                key: 'actions',
                label: 'Tegevused',
                render: (row) => (
                  <form action={revokeUserSessionAction}>
                    <input type="hidden" name="userId" value={row.userId} />
                    <input type="hidden" name="sessionId" value={row.sessionId} />
                    <button type="submit" className={smallButtonClass}>
                      Tühista
                    </button>
                  </form>
                ),
              },
            ]}
            rows={sessionRows}
            emptyLabel="Aktiivseid sessioone ei ole."
          />
        </div>
      </section>
    </div>
  )
}
