'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'

import { BellIcon, CheckIcon } from './icons'
import { markNotificationReadAction } from '../_actions/notifications'
import { formatRelativeTime } from '../_lib/labels'

export interface BellNotification {
  id: string
  title: string | null
  createdAt: string
}

/**
 * Topbar notification bell: shows the operator's unread count and a
 * dropdown of the most recent unread notifications with mark-as-read.
 * The count is local state, so marking read updates it in place without
 * a page reload.
 */
export function NotificationBell({
  items,
  unreadCount,
}: {
  items: BellNotification[]
  unreadCount: number
}) {
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(unreadCount)
  const [list, setList] = useState(items)
  const [isPending, startTransition] = useTransition()

  function markRead(id: string): void {
    const data = new FormData()
    data.set('id', id)
    startTransition(async () => {
      const read = await markNotificationReadAction(data)
      if (!read) return
      setUnread((count) => Math.max(0, count - 1))
      setList((current) => current.filter((item) => item.id !== id))
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Teavitused, ${String(unread)} lugemata`}
        onClick={() => {
          setOpen((value) => !value)
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-button border border-border bg-bgPage text-ink transition-colors duration-hover hover:border-primary hover:text-primary"
      >
        <BellIcon className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-pill bg-danger px-1 text-[10px] font-bold leading-none text-white">
            {unread > 99 ? '99+' : String(unread)}
          </span>
        )}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Teavitused"
          className="absolute right-0 top-full z-20 mt-2xs w-80 rounded-card border border-border bg-bgPage py-2xs shadow-modal"
        >
          {list.length === 0 ? (
            <p className="px-sm py-xs text-label text-inkMuted">Uusi teavitusi pole</p>
          ) : (
            list.map((item) => (
              <div key={item.id} className="flex items-start gap-2xs px-sm py-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-bodySm font-semibold text-ink">
                    {item.title ?? 'Teavitus'}
                  </p>
                  <p className="text-label text-inkMuted">{formatRelativeTime(item.createdAt)}</p>
                </div>
                <button
                  type="button"
                  aria-label="Märgi loetuks"
                  disabled={isPending}
                  onClick={() => {
                    markRead(item.id)
                  }}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-button text-inkMuted transition-colors duration-hover hover:bg-primaryLight hover:text-primaryDark disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
              </div>
            ))
          )}
          <div className="mt-2xs border-t border-border pt-2xs">
            <Link
              href="/admin/notifications"
              onClick={() => {
                setOpen(false)
              }}
              className="block px-sm py-xs text-bodySm font-semibold text-primary transition-colors duration-hover hover:text-primaryHover"
            >
              Kõik teavitused
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
