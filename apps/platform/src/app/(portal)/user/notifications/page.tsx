import type { Metadata } from 'next'

import {
  NOTIFICATION_TABS,
  NotificationsClient,
  type NotificationTabId,
} from './_components/notifications-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Teavitused',
}

interface NotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstRaw(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : null
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams

  const found = NOTIFICATION_TABS.find((entry) => entry.id === firstRaw(params.tab))
  const tab: NotificationTabId = found ? found.id : 'inbox'

  const rawToken = firstRaw(params.unsubscribe)
  const unsubscribeToken = rawToken !== null && rawToken.trim() !== '' ? rawToken.trim() : null

  return <NotificationsClient initialTab={tab} unsubscribeToken={unsubscribeToken} />
}
