'use client'

import { Countdown } from '@erametsad/ui'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useAuctionStream } from '@/app/(portal)/_lib/use-auction-stream'

// Client wrapper for the lot page header countdown (task 3.3). The server
// render supplies the initial deadline; an SSE auction:extended event moves
// it in place, and the zero crossing (Countdown onEnd) triggers a bid-state
// refresh through router.refresh instead of a page reload.

export interface LiveCountdownProps {
  auctionId: string
  endsAt: string
  /** Epoch ms captured during SSR, forwarded to Countdown for drift correction. */
  serverNow?: number
  className?: string
}

export function LiveCountdown({
  auctionId,
  endsAt,
  serverNow,
  className,
}: LiveCountdownProps) {
  const router = useRouter()
  const { subscribe } = useAuctionStream()
  const [deadline, setDeadline] = useState(endsAt)

  // The server re-render (router.refresh, navigation) is authoritative;
  // adopt its deadline over the locally mutated one.
  useEffect(() => {
    setDeadline(endsAt)
  }, [endsAt])

  useEffect(() => {
    return subscribe('auction:extended', (payload) => {
      if (payload.auctionId !== auctionId) return
      setDeadline(payload.endsAt)
    })
  }, [auctionId, subscribe])

  return (
    <Countdown
      endsAt={deadline}
      {...(serverNow !== undefined ? { serverNow } : {})}
      {...(className !== undefined ? { className } : {})}
      onEnd={() => {
        router.refresh()
      }}
    />
  )
}
