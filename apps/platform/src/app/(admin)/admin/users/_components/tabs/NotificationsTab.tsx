import type { ReactNode } from 'react'

import { DataTable } from '../../../../_components/DataTable'
import { formatDateTime, formatRelativeTime } from '../../../../_lib/labels'

import {
  NOTIFICATION_EVENTS,
  notificationChannelLabel,
} from '@/app/(portal)/user/notifications/_components/notifications-data'

export interface NotificationRow {
  id: string
  title: string | null
  body: string | null
  event: string
  channel: string | null
  readAt: string | null
  createdAt: string
}

function eventLabel(event: string): string {
  return NOTIFICATION_EVENTS.find((definition) => definition.value === event)?.chipLabel ?? event
}

function statusCell(row: NotificationRow): ReactNode {
  return row.readAt ? (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-bgMist px-2 py-0.5 text-label font-medium text-inkMuted">
      Loetud
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-primaryLight px-2 py-0.5 text-label font-semibold text-primaryDark">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-pill bg-primary" />
      Lugemata
    </span>
  )
}

// Read-only per-user slice of the admin notifications list: same columns and
// labels as /admin/notifications, no actions — marking read stays in the bell
// (audited server action).
export function NotificationsTab({ rows }: { rows: NotificationRow[] }) {
  const now = Date.now()

  return (
    <div>
      <p className="mb-sm text-bodySm text-ink-muted">
        Kasutaja viimased teavitused. Vaid lugemiseks; lugematuks märkimine toimub läbi kellukese.
      </p>
      <DataTable
        columns={[
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
        ]}
        rows={rows}
        emptyLabel="Teavitusi ei ole."
        rowClassName={(row) => (row.readAt ? '' : 'bg-primaryLight/40')}
      />
    </div>
  )
}
