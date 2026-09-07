import type { ReactNode } from 'react'

import { DataTable, type DataTableColumn } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, formatRelativeTime } from '../../_lib/labels'
import { can } from '../../_lib/permissions'

import {
  NOTIFICATION_EVENTS,
  notificationChannelLabel,
} from '@/app/(portal)/user/notifications/_components/notifications-data'
import type { NotificationDoc } from '@/lib/data/repositories'

/**
 * Read-only notification list behind the bell dropdown footer. Guards keep
 * notifications read own-record scoped for non-admin staff and unscoped for
 * admins, so the session-context query renders exactly what the repository
 * allows: admins see the operational list, specialist/seller their own.
 * No actions here — marking read stays in the bell (audited server action).
 */

export const metadata = { title: 'Teavitused' }

export default async function AdminNotificationsPage() {
  const { session, repositories } = await requireAdminRepositories()

  if (!can(session.role, 'workspace:view')) {
    return <ErrorNotice message="Teil puudub õigus teavituste vaatamiseks." />
  }

  const { docs } = await repositories.find({
    collection: 'notifications',
    sort: '-createdAt',
    pagination: false,
    limit: 100,
  })

  const now = Date.now()

  const eventLabel = (event: string): string =>
    NOTIFICATION_EVENTS.find((definition) => definition.value === event)?.chipLabel ?? event

  const statusCell = (row: NotificationDoc): ReactNode =>
    row.readAt ? (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-bgMist px-2 py-0.5 text-label font-medium text-inkMuted">
        Loetud
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 rounded-pill bg-primaryLight px-2 py-0.5 text-label font-semibold text-primaryDark">
        <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-primary" />
        Lugemata
      </span>
    )

  const columns: readonly DataTableColumn<NotificationDoc>[] = [
    {
      key: 'title',
      label: 'Teavitus',
      render: (row) => (
        <span className="block">
          <span className={`block truncate ${row.readAt ? 'font-medium' : 'font-semibold'}`}>
            {row.title ?? 'Teavitus'}
          </span>
          {row.body ? (
            <span className="block truncate text-label text-inkMuted">{row.body}</span>
          ) : null}
        </span>
      ),
    },
    { key: 'event', label: 'Sündmus', render: (row) => eventLabel(row.event) },
    {
      key: 'channel',
      label: 'Kanal',
      render: (row) => (row.channel ? notificationChannelLabel(row.channel) : '—'),
    },
    { key: 'status', label: 'Olek', render: statusCell },
    {
      key: 'createdAt',
      label: 'Aeg',
      render: (row) => (
        <time dateTime={row.createdAt} title={formatDateTime(row.createdAt)}>
          {formatRelativeTime(row.createdAt, now)}
        </time>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Teavitused"
        description="Vaid lugemiseks. Admin näeb kõiki teavitusi, spetsialist ja müüja ainult enda omi. Lugematuks märkimine toimub läbi kellukese."
      />
      <DataTable
        columns={columns}
        rows={docs}
        emptyLabel="Teavitusi ei ole."
        rowClassName={(row) => (row.readAt ? '' : 'bg-primaryLight/40')}
      />
    </div>
  )
}
