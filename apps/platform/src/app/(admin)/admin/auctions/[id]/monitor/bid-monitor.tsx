'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { formatEurAmount, formatRelativeTime } from '../../../../_lib/labels'

export interface MonitorBidRow {
  key: string
  amountEur: number
  placedAt: string
  live: boolean
}

type ConnectionState = 'connecting' | 'live' | 'offline'

interface StreamBidEvent {
  auctionId?: string
  amount?: number
  placedAt?: string
}

interface StreamExtendedEvent {
  auctionId?: string
  previousEndsAt?: string
  endsAt?: string
}

interface StreamEndedEvent {
  auctionId?: string
  type?: string
  hasWinner?: boolean
  sealedOpeningPending?: boolean
}

interface StreamPublishedEvent {
  auctionId?: string
  endsAt?: string
}

const liveDotClass: Record<ConnectionState, string> = {
  connecting: 'bg-info',
  live: 'bg-primary animate-pulse',
  offline: 'bg-danger',
}

const liveLabel: Record<ConnectionState, string> = {
  connecting: 'Ühendub…',
  live: 'Otseülekanne',
  offline: 'Ühendus katkes (taasühendab)',
}

function parseData(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Live bid monitor. Subscribes to the same public AuctionDO stream as the
 * portal (`/api/v1/auctions/stream?auction=<id>`) and renders incoming
 * events as amounts and relative times only — never bidder identities.
 */
export function BidMonitor({
  auctionId,
  title,
  initialRows,
  initialPriceEur,
  endsAt,
  initialEnded,
}: {
  auctionId: string
  title: string
  initialRows: MonitorBidRow[]
  initialPriceEur: number
  endsAt: string | null
  initialEnded: boolean
}) {
  const [rows, setRows] = useState<MonitorBidRow[]>(initialRows)
  const [currentPriceEur, setCurrentPriceEur] = useState(initialPriceEur)
  const [streamEndsAt, setStreamEndsAt] = useState(endsAt)
  const [ended, setEnded] = useState(initialEnded)
  const [connection, setConnection] = useState<ConnectionState>('connecting')
  const [notices, setNotices] = useState<{ id: number; message: string }[]>([])
  const [tick, setTick] = useState(0)
  const noticeCounter = useRef(0)
  const liveRowCounter = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((value) => value + 1)
    }, 15000)
    return () => {
      clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const source = new EventSource(`/api/v1/auctions/stream?auction=${encodeURIComponent(auctionId)}`)

    const pushNotice = (message: string): void => {
      noticeCounter.current += 1
      const id = noticeCounter.current
      setNotices((current) => [...current, { id, message }])
      setTimeout(() => {
        setNotices((current) => current.filter((notice) => notice.id !== id))
      }, 10000)
    }

    source.onopen = () => {
      setConnection('live')
    }
    source.onerror = () => {
      setConnection('offline')
    }

    source.addEventListener('bid:created', (event) => {
      const data = parseData((event as MessageEvent<string>).data) as StreamBidEvent | null
      if (data?.auctionId !== auctionId) return
      const amount = data.amount
      const placedAt = data.placedAt
      if (typeof amount !== 'number' || typeof placedAt !== 'string') return
      liveRowCounter.current += 1
      const key = `live-${String(liveRowCounter.current)}`
      setRows((current) => [{ key, amountEur: amount, placedAt, live: true }, ...current])
      setCurrentPriceEur(amount)
    })

    source.addEventListener('auction:extended', (event) => {
      const data = parseData((event as MessageEvent<string>).data) as StreamExtendedEvent | null
      if (data?.auctionId !== auctionId) return
      if (typeof data.endsAt === 'string') setStreamEndsAt(data.endsAt)
      pushNotice('Lõppaega pikendati (snipe-kaitse).')
    })

    source.addEventListener('auction:ended', (event) => {
      const data = parseData((event as MessageEvent<string>).data) as StreamEndedEvent | null
      if (data?.auctionId !== auctionId) return
      setEnded(true)
      pushNotice(
        data.sealedOpeningPending === true
          ? 'Oksjon lõppes; pitsertpakkumused ootavad avamist.'
          : 'Oksjon lõppes.',
      )
    })

    source.addEventListener('auction:published', (event) => {
      const data = parseData((event as MessageEvent<string>).data) as StreamPublishedEvent | null
      if (data?.auctionId !== auctionId) return
      if (typeof data.endsAt === 'string') setStreamEndsAt(data.endsAt)
      pushNotice('Oksjon avalikustati.')
    })

    return () => {
      source.close()
    }
  }, [auctionId])

  const endsAtLabel = useMemo(() => {
    void tick
    if (!streamEndsAt) return '—'
    return new Date(streamEndsAt).toLocaleString('et-EE', {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  }, [streamEndsAt, tick])

  return (
    <div>
      <div className="mb-md grid grid-cols-1 gap-xs sm:grid-cols-3">
        <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
          <span className="text-label font-semibold text-ink-muted">Hetkehind</span>
          <span className="font-heading text-h3 font-bold text-ink">
            {formatEurAmount(currentPriceEur)}
          </span>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
          <span className="text-label font-semibold text-ink-muted">Lõppaeg</span>
          <span className="text-bodySm font-semibold text-ink">{endsAtLabel}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-card border border-border bg-bgPage px-md py-sm">
          <span className="text-label font-semibold text-ink-muted">Ülekanne</span>
          <span className="flex items-center gap-xs text-bodySm font-semibold text-ink">
            <span className={`inline-block h-2 w-2 rounded-full ${ended ? 'bg-danger' : liveDotClass[connection]}`} />
            {ended ? 'Lõppenud' : liveLabel[connection]}
          </span>
        </div>
      </div>

      {notices.length > 0 ? (
        <ul className="mb-md space-y-xs">
          {notices.map((notice) => (
            <li
              key={String(notice.id)}
              className="rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
            >
              {notice.message}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="sr-only">Jälgitav oksjon: {title}</p>
      <div className="overflow-x-auto rounded-card border border-border bg-bgPage">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-bg-mist">
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                Summa
              </th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                Aeg
              </th>
              <th scope="col" className="h-10 px-3 text-label font-semibold text-ink-muted">
                Tüüp
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-md py-lg text-center text-bodySm text-ink-muted">
                  Ootan pakkumusi…
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-b border-border last:border-b-0 hover:bg-bg-mist transition-colors duration-hover ease-hover"
                >
                  <td className="h-10 px-3 text-bodySm font-semibold text-ink">
                    {formatEurAmount(row.amountEur)}
                  </td>
                  <td className="h-10 px-3 text-bodySm text-ink">
                    {formatRelativeTime(row.placedAt)}
                  </td>
                  <td className="h-10 px-3 text-bodySm text-ink-muted">
                    {row.live ? 'Otse' : 'Ajalugu'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-xs text-bodySm text-ink-muted">
        Näidatakse ainult summasid ja aegu; pakkujate identiteeti ei avaldata.
      </p>
    </div>
  )
}
