'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchSealedCeremonyAuditAction } from './fetch-sealed-audit'
import type { SealedAuditFeedState, SealedAuditLineView } from './sealed-audit-view'

/**
 * Live feed for the sealed-opening audit strip. Follows the bid-monitor
 * SSE conventions (same AuctionDO stream, exponential reconnect backoff,
 * auctionId-checked frames): only sealed/ceremony-relevant events —
 * `bid:created` (sealed bids still arriving) and `auction:ended` (the
 * transition that opens the ceremony) — trigger a debounced server refetch;
 * a reconnect also backfills lines missed while offline. No polling.
 */
export function useSealedAuditFeed(auctionId: string): {
  lines: SealedAuditLineView[]
  state: SealedAuditFeedState
  permitted: boolean
} {
  const [lines, setLines] = useState<SealedAuditLineView[]>([])
  const [state, setState] = useState<SealedAuditFeedState>('connecting')
  const [permitted, setPermitted] = useState(true)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const auctionIdRef = useRef(auctionId)

  const refetch = useCallback(async (): Promise<boolean> => {
    try {
      const result = await fetchSealedCeremonyAuditAction(auctionIdRef.current)
      if (result.ok) {
        setLines(result.lines)
        setPermitted(true)
        return true
      }
      setPermitted(false)
    } catch {
      // Transient failure: keep the previous lines; SSE state shows the link.
    }
    return false
  }, [])

  useEffect(() => {
    auctionIdRef.current = auctionId
    let disposed = false
    let source: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0

    const refreshSoon = (): void => {
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null
        void refetch()
      }, 400)
    }

    const frameOf = (raw: string): boolean => {
      try {
        const data: unknown = JSON.parse(raw)
        return (
          typeof data === 'object' &&
          data !== null &&
          (data as Record<string, unknown>).auctionId === auctionId
        )
      } catch {
        return false
      }
    }

    const connect = (): void => {
      if (disposed) return
      setState('connecting')
      const next = new EventSource(
        `/api/v1/auctions/stream?auction=${encodeURIComponent(auctionId)}`,
      )
      source = next

      next.onopen = () => {
        const reconnected = attempt > 0
        attempt = 0
        setState('live')
        if (reconnected) void refetch()
      }
      next.onerror = () => {
        next.close()
        source = null
        if (disposed) return
        setState('offline')
        attempt += 1
        const delay = Math.min(30000, 1000 * 2 ** (attempt - 1))
        reconnectTimer = setTimeout(connect, delay)
      }

      const onSealedRelevantEvent = (event: MessageEvent<string>): void => {
        if (frameOf(event.data)) refreshSoon()
      }
      next.addEventListener('bid:created', onSealedRelevantEvent)
      next.addEventListener('auction:ended', onSealedRelevantEvent)
    }

    void refetch()
    connect()

    return () => {
      disposed = true
      if (reconnectTimer !== null) clearTimeout(reconnectTimer)
      if (refreshTimerRef.current !== null) clearTimeout(refreshTimerRef.current)
      source?.close()
    }
  }, [auctionId, refetch])

  return { lines, state, permitted }
}
