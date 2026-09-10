'use client'

import { Bell, BellOff, Check, CheckCheck, Clock, FileText, Gavel, TreePine, TrendingUp, Trophy, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  apiJson,
  deepLinkFor,
  formatEstonianDateTime,
  formatRelativeEstonian,
  mergeCategoryPages,
  NOTIFICATION_FILTERS,
  notificationBadgeLabel,
  notificationChannelLabel,
  notificationFilter,
  notificationGroup,
  type NotificationFilterId,
  type NotificationGroupId,
  type NotificationItem,
  type NotificationListResponse,
} from './notifications-data'

const EVENT_ICONS: Record<string, typeof Bell> = {
  'auction.published': TreePine,
  'auction.ended': Clock,
  'auction.won': Trophy,
  'bid.created': Gavel,
  'bid.approved': Gavel,
  'bid.rejected': Gavel,
  outbid: TrendingUp,
  'contract.ready': FileText,
}

// Demo type badges (11-user-notifications.html): Pakkumine outlined green,
// Oksjon outlined info blue, Leping on primary-light.
const GROUP_BADGE_CLASSES: Record<NotificationGroupId, string> = {
  bids: 'border border-statusActive bg-bgPage text-statusActive',
  auctions: 'border border-info bg-bgPage text-info',
  contracts: 'border border-primaryLight bg-primaryLight text-primaryHover',
}

interface ToastState {
  message: string
  key: number
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-pill border px-3 py-1 font-body text-bodySm font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
        active
          ? 'border-primary bg-primary text-inkInverse'
          : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
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

// Exported for tests: the row is rendered directly in renderToString tests.
export function InboxItemRow({ item, onMarkRead }: RowProps) {
  const unread = item.readAt === null
  const href = deepLinkFor(item.payload)
  const group = notificationGroup(item.category)
  const Icon = EVENT_ICONS[item.category] ?? Bell
  const badgeClass = group !== null ? GROUP_BADGE_CLASSES[group] : 'border border-border bg-bgPage text-inkMuted'
  const actionLabel = group === 'contracts' ? 'Vaata lepingut' : 'Vaata oksjonit'
  const channelLabel = item.channel !== null ? notificationChannelLabel(item.channel) : null
  const relative = formatRelativeEstonian(item.createdAt)

  const markIfUnread = () => {
    if (unread) onMarkRead(item.id)
  }

  const inner = (
    <>
      <span className="sr-only">{unread ? 'Lugemata teavitus. ' : ''}</span>
      <span
        aria-hidden="true"
        className={`row-span-3 flex h-11 w-11 flex-none items-center justify-center rounded-pill border max-md:row-span-1 max-md:h-9 max-md:w-9 ${
          unread ? 'border-primaryLight bg-primaryLight text-primary' : 'border-border bg-bgPage text-primary'
        }`}
      >
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2.5">
          <span className="font-heading text-[17px] font-bold leading-tight text-ink">
            {item.title ?? 'Teavitus'}
          </span>
          <span
            className={`inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${badgeClass}`}
          >
            {notificationBadgeLabel(item.category)}
          </span>
        </span>
        {item.body !== null && item.body !== '' && (
          <span className="mt-1 block text-[15px] leading-snug text-ink">{item.body}</span>
        )}
        <span className="mt-1 block text-bodySm text-inkMuted">
          {channelLabel !== null && <>{channelLabel} · </>}
          <time dateTime={item.createdAt} title={formatEstonianDateTime(item.createdAt)}>
            {relative}
          </time>
        </span>
      </span>
      <span className="row-span-3 flex flex-col items-end justify-between gap-2.5 max-md:col-span-full max-md:row-span-1 max-md:flex-row max-md:items-center max-md:justify-between max-md:border-t max-md:border-dashed max-md:border-border max-md:pt-2.5">
        {href !== null && (
          <span
            className={`inline-flex h-8 items-center justify-center whitespace-nowrap rounded-button px-3.5 text-label font-semibold transition-colors duration-hover ease-hover motion-reduce:transition-none ${
              unread ? 'bg-primary text-inkInverse hover:bg-primaryHover' : 'border border-primary bg-transparent text-primary hover:bg-primaryLight'
            }`}
          >
            {actionLabel}
          </span>
        )}
        {unread ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-ctaHover">
            <span className="h-2 w-2 flex-none rounded-pill bg-cta" aria-hidden="true" />
            Lugemata
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-inkMuted">
            <Check size={11} className="text-statusActive" aria-hidden="true" />
            Loetud
          </span>
        )}
      </span>
    </>
  )

  const rowClasses = `grid w-full cursor-pointer grid-cols-[44px_minmax(0,1fr)_auto] items-start gap-x-4 gap-y-0.5 border-b border-border px-3 py-4 text-left transition-colors duration-hover ease-hover motion-reduce:transition-none max-md:grid-cols-[36px_minmax(0,1fr)] ${
    unread ? 'bg-bgMist max-md:hover:bg-bgMist' : 'bg-transparent hover:bg-bgMist'
  }`

  return (
    <li>
      {href !== null ? (
        <Link href={href} onClick={markIfUnread} className={rowClasses}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={markIfUnread} className={rowClasses}>
          {inner}
        </button>
      )}
    </li>
  )
}

export function NotificationInbox({ streamEpoch }: { streamEpoch: number }) {
  const [filterId, setFilterId] = useState<NotificationFilterId>('all')
  const [items, setItems] = useState<NotificationItem[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastState | null>(null)
  const handledEpochRef = useRef(streamEpoch)

  const requestPage = useCallback(
    async (category: string | null, cursor: string | null): Promise<NotificationListResponse> => {
      const search = new URLSearchParams()
      if (category !== null) search.set('category', category)
      if (filterId === 'unread') search.set('unread', '1')
      if (cursor !== null) search.set('cursor', cursor)
      const qs = search.toString()
      return apiJson<NotificationListResponse>(
        qs === '' ? '/api/v1/my/notifications' : `/api/v1/my/notifications?${qs}`,
      )
    },
    [filterId],
  )

  // Group chips (Pakkumised, Oksjonid, Lepingud) merge one request per event;
  // the API filters a single event per request.
  const fetchPage = useCallback(
    async (cursor: string | null): Promise<NotificationListResponse> => {
      const events = notificationFilter(filterId).events
      if (events === null || events.length === 1) {
        return requestPage(events?.[0] ?? null, cursor)
      }
      const pages = await Promise.all(events.map((event) => requestPage(event, cursor)))
      const merged = mergeCategoryPages(pages.map((page) => page.items))
      return { ...merged, unreadCount: pages[0]?.unreadCount ?? 0 }
    },
    [filterId, requestPage],
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
      setToast({ message: 'Kõik teavitused märgitud loetuks.', key: Date.now() })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Märkimine ebaõnnestus')
    } finally {
      setMarkingAll(false)
    }
  }, [])

  return (
    <section
      aria-labelledby="notifications-inbox-title"
      className="rounded-card border border-border bg-white p-6 shadow-card max-md:p-[14px]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="notifications-inbox-title" className="font-heading text-[22px] font-bold text-ink">
          Saabunud teavitused
        </h2>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={markingAll || unreadCount === 0}
          className="inline-flex h-8 items-center justify-center gap-2 rounded-button border border-primary bg-transparent px-3.5 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCheck size={14} aria-hidden="true" />
          Märgi loetuks
        </button>
      </div>
      <p className="mt-1.5 text-[15px] text-inkMuted">
        Viimased sündmused sinu pakkumiste, objektide ja lepingute kohta. Klõps teavitusel märgib
        selle loetuks.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2.5" role="group" aria-label="Filtreeri teavitusi">
        <span className="text-bodySm font-semibold text-ink">Filtreeri:</span>
        <div className="flex flex-wrap gap-1.5">
          {NOTIFICATION_FILTERS.map((filter) => (
            <FilterChip
              key={filter.id}
              label={filter.label}
              active={filterId === filter.id}
              onClick={() => {
                setFilterId(filter.id)
              }}
            />
          ))}
        </div>
      </div>

      {error !== null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger bg-bgMist px-6 py-3">
          <p role="alert" className="font-body text-body text-danger">
            {error}
          </p>
          <button
            type="button"
            onClick={() => void loadFirstPage()}
            className="inline-flex h-8 items-center rounded-button border border-primary px-3.5 text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight"
          >
            Proovi uuesti
          </button>
        </div>
      )}

      {loading ? (
        <ul className="mt-3.5 flex flex-col border-t border-border" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <li key={index} className="border-b border-border px-3 py-4">
              <div className="h-14 animate-pulse rounded-card bg-bgMist" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center gap-2.5 rounded-card bg-primaryLight px-7 py-12 text-center">
          <BellOff size={32} className="text-primary" aria-hidden="true" />
          <h3 className="mt-1 font-heading text-[22px] font-bold text-ink">Teavitusi pole</h3>
          <p className="m-0 max-w-[34em] text-[15px] text-inkMuted">
            Selle filtriga ei ole hetkel ühtegi teavitust.
          </p>
        </div>
      ) : (
        <ul className="mt-3.5 flex flex-col border-t border-border">
          {items.map((item) => (
            <InboxItemRow key={item.id} item={item} onMarkRead={markRead} />
          ))}
        </ul>
      )}

      {nextCursor !== null && !loading && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-button border border-primary bg-transparent px-6 text-body font-semibold text-primary transition-colors duration-hover ease-hover hover:bg-primaryLight motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? 'Laadin…' : 'Laadi veel'}
          </button>
        </div>
      )}

      {toast !== null && (
        <div
          key={toast.key}
          role="alert"
          className="fixed bottom-4 right-4 z-50 flex max-w-sm items-start gap-3 rounded-button bg-primaryDark px-4 py-3 text-inkInverse shadow-modal"
        >
          <p className="text-bodySm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => {
              setToast(null)
            }}
            aria-label="Sulge teavitus"
            className="ml-auto flex h-6 w-6 flex-none items-center justify-center rounded-pill transition-opacity duration-hover hover:opacity-80"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  )
}
