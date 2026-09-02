'use client'

import { Btn, EmptyState } from '@erametsad/ui'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  apiJson,
  deepLinkFor,
  formatEstonianDateTime,
  NOTIFICATION_EVENTS,
  notificationChannelLabel,
  type NotificationItem,
  type NotificationListResponse,
} from './notifications-data'

interface ChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function CategoryChip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-pill px-4 py-2 font-body text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
        active
          ? 'bg-primary text-inkInverse'
          : 'border border-border bg-bgMist text-ink hover:bg-primaryLight'
      }`}
    >
      {label}
    </button>
  )
}

interface RowProps {
  item: NotificationItem
  onMarkRead: (id: string) => void
}

function rowClasses(unread: boolean): string {
  return `block w-full rounded-card border px-md py-sm text-left transition-colors duration-hover ease-hover ${
    unread
      ? 'border-border border-l-4 border-l-primary bg-bgMist'
      : 'border-border bg-bgPage hover:bg-bgMist'
  }`
}

function InboxItemRow({ item, onMarkRead }: RowProps) {
  const unread = item.readAt === null
  const href = deepLinkFor(item.payload)
  const channelLabel = item.channel !== null ? notificationChannelLabel(item.channel) : null

  const markIfUnread = () => {
    if (unread) onMarkRead(item.id)
  }

  const inner = (
    <>
      <span className="sr-only">{unread ? 'Lugemata teavitus. ' : ''}</span>
      <div className="flex items-start justify-between gap-sm">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2xs">
            {unread && (
              <span className="h-2 w-2 shrink-0 rounded-pill bg-primary" aria-hidden="true" />
            )}
            <span
              className={`font-body text-bodySm font-semibold ${
                unread ? 'text-primaryDark' : 'text-inkMuted'
              }`}
            >
              {NOTIFICATION_EVENTS.find((event) => event.value === item.category)?.chipLabel ??
                item.category}
            </span>
            {channelLabel !== null && (
              <span className="inline-flex shrink-0 items-center rounded-pill border border-border px-2 py-0.5 font-body text-[11px] text-inkMuted">
                {channelLabel}
              </span>
            )}
          </div>
          <p className={`mt-2xs font-body text-body ${unread ? 'font-semibold text-ink' : 'text-ink'}`}>
            {item.title ?? 'Teavitus'}
          </p>
          {item.body !== null && item.body !== '' && (
            <p className="mt-2xs line-clamp-2 font-body text-bodySm text-inkMuted">{item.body}</p>
          )}
        </div>
        <time
          dateTime={item.createdAt}
          className="shrink-0 pt-0.5 font-mono text-[11px] text-inkMuted"
        >
          {formatEstonianDateTime(item.createdAt)}
        </time>
      </div>
    </>
  )

  return (
    <li>
      {href !== null ? (
        <Link href={href} onClick={markIfUnread} className={rowClasses(unread)}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={markIfUnread} className={rowClasses(unread)}>
          {inner}
        </button>
      )}
    </li>
  )
}

export function NotificationInbox({ streamEpoch }: { streamEpoch: number }) {
  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const handledEpochRef = useRef(streamEpoch)

  const fetchPage = useCallback(
    async (cursor: string | null): Promise<NotificationListResponse> => {
      const search = new URLSearchParams()
      if (category !== '') search.set('category', category)
      if (unreadOnly) search.set('unread', '1')
      if (cursor !== null) search.set('cursor', cursor)
      const qs = search.toString()
      return apiJson<NotificationListResponse>(
        qs === '' ? '/api/v1/my/notifications' : `/api/v1/my/notifications?${qs}`,
      )
    },
    [category, unreadOnly],
  )

  const loadFirstPage = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPage(null)
      setItems(data.items)
      setNextCursor(data.nextCursor)
      setUnreadCount(data.unreadCount)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Teavituste laadimine ebaõnnestus')
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  useEffect(() => {
    void loadFirstPage()
  }, [loadFirstPage])

  // Live bump from the SSE stream: merge a fresh first page in front of the
  // loaded list, deduped by id, so loaded pages survive a new notification.
  useEffect(() => {
    if (handledEpochRef.current === streamEpoch) return
    handledEpochRef.current = streamEpoch
    let cancelled = false
    void fetchPage(null)
      .then((data) => {
        if (cancelled) return
        setItems((prev) => {
          const seen = new Set(prev.map((item) => item.id))
          return [...data.items.filter((item) => !seen.has(item.id)), ...prev]
        })
        setNextCursor(data.nextCursor)
        setUnreadCount(data.unreadCount)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [streamEpoch, fetchPage])

  const loadMore = useCallback(async () => {
    if (nextCursor === null || loadingMore) return
    setLoadingMore(true)
    setError(null)
    try {
      const data = await fetchPage(nextCursor)
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id))
        return [...prev, ...data.items.filter((item) => !seen.has(item.id))]
      })
      setNextCursor(data.nextCursor)
      setUnreadCount(data.unreadCount)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Teavituste laadimine ebaõnnestus')
    } finally {
      setLoadingMore(false)
    }
  }, [fetchPage, nextCursor, loadingMore])

  const markRead = useCallback((id: string) => {
    // Optimistic; the server truth lands with the next refetch.
    setItems((prev) =>
      prev.map((item) =>
        item.id === id && item.readAt === null
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    )
    setUnreadCount((prev) => Math.max(0, prev - 1))
    void apiJson<NotificationItem>(
      `/api/v1/my/notifications/${encodeURIComponent(id)}/read`,
      { method: 'PATCH' },
    ).catch(() => undefined)
  }, [])

  const markAllRead = useCallback(async () => {
    setMarkingAll(true)
    setError(null)
    try {
      await apiJson<{ unreadCount: number }>('/api/v1/my/notifications/read-all', {
        method: 'PATCH',
      })
      const readAt = new Date().toISOString()
      setItems((prev) =>
        prev.map((item) => (item.readAt === null ? { ...item, readAt } : item)),
      )
      setUnreadCount(0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Märkimine ebaõnnestus')
    } finally {
      setMarkingAll(false)
    }
  }, [])

  const hasFilter = category !== '' || unreadOnly

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap items-center justify-between gap-sm">
        <p className="font-body text-body text-inkMuted" role="status">
          {unreadCount > 0 ? `Lugemata teavitusi: ${String(unreadCount)}` : 'Kõik teavitused on loetud'}
        </p>
        <Btn
          variant="outline"
          size="sm"
          onClick={() => void markAllRead()}
          isLoading={markingAll}
          disabled={unreadCount === 0}
        >
          Märgi kõik loetuks
        </Btn>
      </div>

      <div className="flex flex-wrap gap-xs" role="group" aria-label="Kategooriad">
        <CategoryChip label="Kõik" active={category === ''} onClick={() => { setCategory(''); }} />
        {NOTIFICATION_EVENTS.map((event) => (
          <CategoryChip
            key={event.value}
            label={event.chipLabel}
            active={category === event.value}
            onClick={() => { setCategory(event.value); }}
          />
        ))}
        <CategoryChip
          label="Ainult lugemata"
          active={unreadOnly}
          onClick={() => { setUnreadOnly((value) => !value); }}
        />
      </div>

      {error !== null && (
        <div className="flex flex-wrap items-center justify-between gap-sm rounded-card border border-danger bg-bgMist px-md py-sm">
          <p role="alert" className="font-body text-body text-danger">
            {error}
          </p>
          <Btn variant="outline" size="sm" onClick={() => void loadFirstPage()}>
            Proovi uuesti
          </Btn>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-xs" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-20 animate-pulse rounded-card border border-border bg-bgMist" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="Teavitusi ei ole"
          description={
            hasFilter
              ? 'Valitud filtritega teavitusi ei leitud.'
              : 'Siia ilmuvad teavitused pakkumuste, oksjonite ja lepingute kohta.'
          }
        />
      ) : (
        <ul className="flex flex-col gap-xs">
          {items.map((item) => (
            <InboxItemRow key={item.id} item={item} onMarkRead={markRead} />
          ))}
        </ul>
      )}

      {nextCursor !== null && !loading && (
        <div className="flex justify-center">
          <Btn variant="outline" onClick={() => void loadMore()} isLoading={loadingMore}>
            Koorma rohkem
          </Btn>
        </div>
      )}
    </div>
  )
}
