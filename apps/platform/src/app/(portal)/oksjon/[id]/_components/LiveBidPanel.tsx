'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { BidPanel, type BidPanelProps } from './BidPanel'

import { useAuctionStream } from '@/app/(portal)/_lib/use-auction-stream'


// Client wrapper around the lot page bid panel (task 3.3). It consumes the
// auction stream events the panel itself knows nothing about:
// - auction:extended moves the panel's deadline ("Oksjon lõpeb") in place;
// - auction:ended locks the panel into its ended rendering immediately and
//   refreshes, so the server brings the authoritative outcome (final price,
//   status pill) without a reload.

export type LiveBidPanelProps = BidPanelProps

export function LiveBidPanel({
  auctionId,
  status,
  endsAt,
  ...rest
}: LiveBidPanelProps) {
  const router = useRouter()
  const { subscribe } = useAuctionStream()
  const [deadline, setDeadline] = useState(endsAt)
  const [lockEnded, setLockEnded] = useState(false)
  const [announcement, setAnnouncement] = useState('')

  // The server re-render (router.refresh, navigation) is authoritative;
  // adopt its deadline over the locally mutated one.
  useEffect(() => {
    setDeadline(endsAt)
  }, [endsAt])

  useEffect(() => {
    const offExtended = subscribe('auction:extended', (payload) => {
      if (payload.auctionId !== auctionId) return
      setDeadline(payload.endsAt)
    })

    const offEnded = subscribe('auction:ended', (payload) => {
      if (payload.auctionId !== auctionId) return
      // 'ended' is in BidPanel's ENDED_STATUSES, so the form locks at once;
      // the refresh then swaps in the server-rendered outcome panel.
      setLockEnded(true)
      setAnnouncement('Oksjon lõppes.')
      router.refresh()
    })

    return () => {
      offExtended()
      offEnded()
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
      />
    </>
  )
}
