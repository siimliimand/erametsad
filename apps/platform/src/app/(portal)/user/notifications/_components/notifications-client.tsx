'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { NotificationInbox } from './notification-inbox'
import { PreferenceMatrix } from './preference-matrix'
import { SavedSearches } from './saved-searches'
import { useMyStream } from '../../../_lib/use-my-stream'
import { UserPageHead } from '../../_components/UserPageHead'

interface NotificationsClientProps {
  unsubscribeToken: string | null
}

// Demo 11-user-notifications.html: three stacked panels under the shared
// Minu keskkond page head and sub-nav (design D5 keeps the saved-searches
// panel as a functional deviation below the demo's two).
export function NotificationsClient({ unsubscribeToken }: NotificationsClientProps) {
  const router = useRouter()
  const stream = useMyStream()
  // Stream notification events bump the inbox: each bump merges a fresh
  // first page into the list and refreshes the unread count.
  const [streamEpoch, setStreamEpoch] = useState(0)
  const savedSearchesRef = useRef<HTMLDivElement | null>(null)

  useEffect(
    () =>
      stream.subscribe('notification', () => {
        setStreamEpoch((epoch) => epoch + 1)
      }),
    [stream],
  )

  // Unsubscribe token links land on the saved searches panel (spec).
  useEffect(() => {
    if (unsubscribeToken === null) return
    savedSearchesRef.current?.scrollIntoView({ block: 'start' })
  }, [unsubscribeToken])

  const clearUnsubscribeToken = useCallback(() => {
    router.replace('/user/notifications', { scroll: false })
  }, [router])

  return (
    <>
      <UserPageHead
        title="Teavitused"
        summary="Kõik platvormi sõnumid ühes kohas — pakkumiste sündmused, oksjonite tähtajad ja lepingud. Allpool saad valida, mis ja millistel kanalitel sinuni jõuab."
      />
      <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 pt-[32px]">
        <NotificationInbox streamEpoch={streamEpoch} />
        <PreferenceMatrix />
        <div ref={savedSearchesRef} className="scroll-mt-24">
          <SavedSearches
            unsubscribeToken={unsubscribeToken}
            onTokenHandled={clearUnsubscribeToken}
          />
        </div>
      </div>
    </>
  )
}
