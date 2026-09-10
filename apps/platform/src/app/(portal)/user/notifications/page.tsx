import type { Metadata } from 'next'

import { NotificationsClient } from './_components/notifications-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Teavitused',
}

interface NotificationsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const params = await searchParams

  const rawToken = Array.isArray(params.unsubscribe) ? params.unsubscribe[0] : params.unsubscribe
  const unsubscribeToken = typeof rawToken === 'string' && rawToken.trim() !== '' ? rawToken.trim() : null

  return <NotificationsClient unsubscribeToken={unsubscribeToken} />
}
