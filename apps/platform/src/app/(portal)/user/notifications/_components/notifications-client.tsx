'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { NotificationInbox } from './notification-inbox'
import { PreferenceMatrix } from './preference-matrix'
import { SavedSearches } from './saved-searches'
import { useMyStream } from '../../../_lib/use-my-stream'

export const NOTIFICATION_TABS = [
  { id: 'inbox', label: 'Postkast' },
  { id: 'seaded', label: 'Seaded' },
  { id: 'tellimused', label: 'Otsingute tellimused' },
] as const

export type NotificationTabId = (typeof NOTIFICATION_TABS)[number]['id']

function tabHref(tab: NotificationTabId): string {
  return tab === 'inbox' ? '/user/notifications' : `/user/notifications?tab=${tab}`
}

interface NotificationsClientProps {
  initialTab: NotificationTabId
  unsubscribeToken: string | null
}

export function NotificationsClient({ initialTab, unsubscribeToken }: NotificationsClientProps) {
  const router = useRouter()
  const stream = useMyStream()
  // Stream notification events bump the inbox: each bump merges a fresh
  // first page into the list and refreshes the unread count.
  const [streamEpoch, setStreamEpoch] = useState(0)
  const [tab, setTab] = useState<NotificationTabId>(
    unsubscribeToken !== null ? 'tellimused' : initialTab,
  )

  useEffect(
    () =>
      stream.subscribe('notification', () => {
        setStreamEpoch((epoch) => epoch + 1)
      }),
    [stream],
  )

  const selectTab = useCallback(
    (next: NotificationTabId) => {
      setTab(next)
      router.replace(tabHref(next), { scroll: false })
    },
    [router],
  )

  const clearUnsubscribeToken = useCallback(() => {
    router.replace(tabHref(tab), { scroll: false })
  }, [router, tab])

  return (
    <div className="flex flex-col gap-lg">
      <h1 className="font-heading text-h2 text-ink">Teavitused</h1>

      <nav aria-label="Teavituste vaated" className="overflow-x-auto border-b border-border">
        <ul className="flex min-w-max">
          {NOTIFICATION_TABS.map((entry) => {
            const active = entry.id === tab
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => { selectTab(entry.id); }}
                  aria-current={active ? 'page' : undefined}
                  className={`relative px-4 py-3 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                    active
                      ? 'border-b-2 border-primary text-primary'
                      : 'border-b-2 border-transparent text-inkMuted hover:border-primary hover:text-primary'
                  }`}
                >
                  {entry.label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {tab === 'inbox' && <NotificationInbox streamEpoch={streamEpoch} />}
      {tab === 'seaded' && <PreferenceMatrix />}
      {tab === 'tellimused' && (
        <SavedSearches
          unsubscribeToken={unsubscribeToken}
          onTokenHandled={clearUnsubscribeToken}
        />
      )}
    </div>
  )
}
