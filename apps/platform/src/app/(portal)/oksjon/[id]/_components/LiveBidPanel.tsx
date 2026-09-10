'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { BidPanel, type BidPanelProps } from './BidPanel'

import { useAuctionStream } from '@/app/(portal)/_lib/use-auction-stream'


// Client wrapper around the lot page bid panel (task 3.3). It consumes the
// auction stream events the panel itself knows nothing about:
// - auction:extended moves the panel's deadline in place and raises the demo
//   snipe banner ("Oksjoni lõppu pikendati ... minuti võrra.") for a while;
// - auction:ended locks the panel into its ended rendering immediately and
//   refreshes, so the server brings the authoritative outcome (final price,
//   status pill) without a reload;
// - bid:created refreshes so "Hetke hind" and the next-bid box track new
//   leading bids, with an optimistic count bump until the refresh lands.

const SNIPE_NOTICE_MS = 8000

export type LiveBidPanelProps = BidPanelProps

export function LiveBidPanel({
  auctionId,
  status,
  endsAt,
  bidCount = null,
  ...rest
}: LiveBidPanelProps) {
  const router = useRouter()
  const { subscribe } = useAuctionStream()
  const [deadline, setDeadline] = useState(endsAt)
  const [lockEnded, setLockEnded] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [localBidCount, setLocalBidCount] = useState<number | null>(bidCount)
  const [extendedNotice, setExtendedNotice] = useState(false)
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The server re-render (router.refresh, navigation) is authoritative;
  // adopt its deadline and count over the locally mutated ones.
  useEffect(() => {
    setDeadline(endsAt)
  }, [endsAt])

  useEffect(() => {
    setLocalBidCount(bidCount)
  }, [bidCount])

  useEffect(() => {
    const offExtended = subscribe('auction:extended', (payload) => {
      if (payload.auctionId !== auctionId) return
      setDeadline(payload.endsAt)
      setExtendedNotice(true)
      if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current)
      noticeTimerRef.current = setTimeout(() => {
        setExtendedNotice(false)
      }, SNIPE_NOTICE_MS)
    })

    const offEnded = subscribe('auction:ended', (payload) => {
      if (payload.auctionId !== auctionId) return
      // 'ended' is in BidPanel's ENDED_STATUSES, so the form locks at once;
      // the refresh then swaps in the server-rendered outcome panel.
      setLockEnded(true)
      setAnnouncement('Oksjon lõppes.')
      router.refresh()
    })

    const offBidCreated = subscribe('bid:created', (payload) => {
      if (payload.auctionId !== auctionId) return
      setLocalBidCount((current) => (current === null ? current : current + 1))
      // The refresh brings the authoritative leading amount so the price row
      // and the next-bid box track the new leading bid without a reload.
      router.refresh()
    })

    return () => {
      offExtended()
      offEnded()
      offBidCreated()
      if (noticeTimerRef.current !== null) clearTimeout(noticeTimerRef.current)
    }
  }, [auctionId, subscribe, router])

  return (
    <>
      {announcement !== '' && (
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
      )}
      <BidPanel
        {...rest}
        auctionId={auctionId}
        status={lockEnded ? 'ended' : status}
        endsAt={deadline}
        bidCount={localBidCount}
        extendedNotice={extendedNotice}
      />
    </>
  )
}
