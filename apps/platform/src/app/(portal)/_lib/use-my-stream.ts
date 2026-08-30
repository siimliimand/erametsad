'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// Payload shapes mirror src/lib/realtime/my-stream.ts; the server's
// JSON.stringify drops keys whose value is undefined, so those keys are
// optional here. Consumers must still narrow values before use.
export interface MyStreamBidPayload {
  auctionId: string
  bidId?: string
  amount: number
  status?: string
  placedAt: string
}

export interface MyStreamOutbidPayload {
  auctionId: string
  auctionTitle?: string
  previousAmount?: number
  newAmount: number
  placedAt: string
}

export interface MyStreamAuctionEndPayload {
  auctionId: string
  auctionTitle?: string
  outcome: 'won' | 'lost' | 'unsold' | 'ended'
  finalPrice?: number
  endedAt: string
}

export interface MyStreamNotificationPayload {
  notificationId?: string
  event: string
  title: string
  body?: string
  sentAt: string
}

export interface MyStreamCountdownSyncPayload {
  auctionId: string
  endsAt: string
  serverTime: string
}

export interface MyStreamEventMap {
  bid: MyStreamBidPayload
  outbid: MyStreamOutbidPayload
  auction_end: MyStreamAuctionEndPayload
  notification: MyStreamNotificationPayload
  countdown_sync: MyStreamCountdownSyncPayload
}

export type MyStreamEventName = keyof MyStreamEventMap

export type MyStreamEventHandler<E extends MyStreamEventName> = (
  payload: MyStreamEventMap[E],
) => void

export type MyStreamStatus = 'connecting' | 'live' | 'offline'

export interface MyStreamApi {
  status: MyStreamStatus
  subscribe: <E extends MyStreamEventName>(
    event: E,
    handler: MyStreamEventHandler<E>,
  ) => () => void
  onReconnect: (handler: () => void) => () => void
}

const MyStreamContext = createContext<MyStreamApi | null>(null)

const STREAM_URL = '/api/v1/my/stream'
const BASE_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const EVENT_NAMES: readonly MyStreamEventName[] = [
  'bid',
  'outbid',
  'auction_end',
  'notification',
  'countdown_sync',
]

export function MyStreamProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<MyStreamStatus>('connecting')
  const eventHandlersRef = useRef(
    new Map<MyStreamEventName, Set<(payload: unknown) => void>>(),
  )
  const reconnectHandlersRef = useRef(new Set<() => void>())

  const subscribe = useCallback(
    <E extends MyStreamEventName>(
      event: E,
      handler: MyStreamEventHandler<E>,
    ): (() => void) => {
      const handlers = eventHandlersRef.current
      const existing = handlers.get(event)
      const set = existing ?? new Set<(payload: unknown) => void>()
      if (!existing) handlers.set(event, set)
      const entry = handler as unknown as (payload: unknown) => void
      set.add(entry)
      return () => {
        set.delete(entry)
      }
    },
    [],
  )

  const onReconnect = useCallback((handler: () => void): (() => void) => {
    reconnectHandlersRef.current.add(handler)
    return () => {
      reconnectHandlersRef.current.delete(handler)
    }
  }, [])

  useEffect(() => {
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let disposed = false

    const dispatch = (name: MyStreamEventName, raw: string): void => {
      let payload: unknown
      try {
        payload = JSON.parse(raw)
      } catch {
        return
      }
      const set = eventHandlersRef.current.get(name)
      if (!set) return
      for (const handler of set) handler(payload)
    }

    const connect = (): void => {
      if (disposed) return
      setStatus('connecting')
      const next = new EventSource(STREAM_URL)
      source = next
      next.onopen = () => {
        const reconnected = attempt > 0
        attempt = 0
        setStatus('live')
        if (reconnected) {
          router.refresh()
          for (const handler of reconnectHandlersRef.current) handler()
        }
      }
      next.onerror = () => {
        next.close()
        source = null
        setStatus('offline')
        if (disposed) return
        attempt += 1
        const delay = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** (attempt - 1))
        reconnectTimer = setTimeout(connect, delay)
      }
      for (const name of EVENT_NAMES) {
        next.addEventListener(name, (event) => {
          dispatch(name, (event as MessageEvent<string>).data)
        })
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      source?.close()
    }
  }, [router])

  const value = useMemo<MyStreamApi>(
    () => ({ status, subscribe, onReconnect }),
    [status, subscribe, onReconnect],
  )

  return createElement(MyStreamContext.Provider, { value }, children)
}

export function useMyStream(): MyStreamApi {
  const api = useContext(MyStreamContext)
  if (!api) {
    throw new Error('useMyStream must be used inside MyStreamProvider')
  }
  return api
}
