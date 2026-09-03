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

// Payload shapes mirror the AuctionDO broadcasts (src/do/auction.ts) that
// src/lib/realtime/auction-stream.ts pipes verbatim through
// /api/v1/auctions/stream. The server's JSON.stringify drops keys whose
// value is undefined, so those keys are optional here. Consumers must
// still narrow values before use.
export interface AuctionStreamBidCreatedPayload {
  auctionId: string
  placedAt: string
}

export interface AuctionStreamExtendedPayload {
  auctionId: string
  previousEndsAt: string
  endsAt: string
}

export interface AuctionStreamEndedPayload {
  auctionId: string
  type: 'open' | 'sealed'
  auctionTitle?: string
  hasWinner?: boolean
  winningBidId?: string
  reserveNotMet?: boolean
  sealedOpeningPending?: boolean
}

export interface AuctionStreamPublishedPayload {
  auctionId: string
  endsAt?: string
  objectType?: string
}

export interface AuctionStreamEventMap {
  'bid:created': AuctionStreamBidCreatedPayload
  'auction:extended': AuctionStreamExtendedPayload
  'auction:ended': AuctionStreamEndedPayload
  'auction:published': AuctionStreamPublishedPayload
}

export type AuctionStreamEventName = keyof AuctionStreamEventMap

export type AuctionStreamEventHandler<E extends AuctionStreamEventName> = (
  payload: AuctionStreamEventMap[E],
) => void

export type AuctionStreamStatus = 'connecting' | 'live' | 'offline'

export interface AuctionStreamApi {
  status: AuctionStreamStatus
  subscribe: <E extends AuctionStreamEventName>(
    event: E,
    handler: AuctionStreamEventHandler<E>,
  ) => () => void
  onReconnect: (handler: () => void) => () => void
}

const AuctionStreamContext = createContext<AuctionStreamApi | null>(null)

const STREAM_URL = '/api/v1/auctions/stream'
const BASE_BACKOFF_MS = 1_000
const MAX_BACKOFF_MS = 30_000
const EVENT_NAMES: readonly AuctionStreamEventName[] = [
  'bid:created',
  'auction:extended',
  'auction:ended',
  'auction:published',
]

export function AuctionStreamProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [status, setStatus] = useState<AuctionStreamStatus>('connecting')
  const eventHandlersRef = useRef(
    new Map<AuctionStreamEventName, Set<(payload: unknown) => void>>(),
  )
  const reconnectHandlersRef = useRef(new Set<() => void>())

  const subscribe = useCallback(
    <E extends AuctionStreamEventName>(
      event: E,
      handler: AuctionStreamEventHandler<E>,
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

    const dispatch = (name: AuctionStreamEventName, raw: string): void => {
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
          // A dropped SSE connection can miss events, so the current view
          // refetches fully before buffered handlers run.
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

  const value = useMemo<AuctionStreamApi>(
    () => ({ status, subscribe, onReconnect }),
    [status, subscribe, onReconnect],
  )

  return createElement(AuctionStreamContext.Provider, { value }, children)
}

export function useAuctionStream(): AuctionStreamApi {
  const api = useContext(AuctionStreamContext)
  if (!api) {
    throw new Error('useAuctionStream must be used inside AuctionStreamProvider')
  }
  return api
}
