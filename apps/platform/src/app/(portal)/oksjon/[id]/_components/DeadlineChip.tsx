'use client'

import { Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

export interface DeadlineChipProps {
  endsAt: string
  /** Epoch ms captured during SSR for clock-skew correction. */
  serverNow?: number
  className?: string
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function formatRemaining(remaining: number): string {
  const days = Math.floor(remaining / DAY)
  const hours = Math.floor((remaining % DAY) / HOUR)
  const minutes = Math.floor((remaining % HOUR) / MINUTE)
  const seconds = Math.floor((remaining % MINUTE) / SECOND)
  return `${String(days)}p ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

// Demo "Tähtaeg" chip in the sealed lot-head band
// (docs/design/demo/portal/03-lot-detail-sealed.html .head-deadline):
// clock icon, label and a mono countdown with the demo warn (<1h) and
// critical (<5min) tiers; flips to the ended state at zero.
export function DeadlineChip({ endsAt, serverNow, className }: DeadlineChipProps) {
  const endMs = new Date(endsAt).getTime()
  // Frozen at first render; hydration keeps the server value, so a drifted
  // client clock cannot skew the countdown (same scheme as ui Countdown).
  const [mountTime] = useState(() => Date.now())
  const [now, setNow] = useState(() => serverNow ?? Date.now())
  const serverNowRef = useRef(serverNow)
  serverNowRef.current = serverNow

  useEffect(() => {
    const tick = () => {
      const base = serverNowRef.current
      // Drift correction: recompute from the SSR epoch anchor so a skewed
      // client clock cannot skew the countdown (same scheme as ui Countdown).
      setNow(base === undefined ? Date.now() : base + (Date.now() - mountTime))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => {
      clearInterval(id)
    }
  }, [mountTime])

  const remaining = endMs - now
  const isEnded = remaining <= 0
  const timeLabel = isEnded ? '00:00:00' : formatRemaining(remaining)
  const timeColor = isEnded
    ? 'text-inkMuted'
    : remaining < 5 * MINUTE
      ? 'text-statusCritical'
      : remaining < HOUR
        ? 'text-statusEndingSoon'
        : 'text-ink'

  return (
    <p
      role="timer"
      aria-label="Aega pakkumise esitamiseks"
      className={`m-0 flex items-center gap-2 rounded-button border border-border bg-bgPage px-4 py-2.5 ${
        className ?? ''
      }`}
    >
      <Clock className="h-4 w-4 text-inkMuted" aria-hidden="true" />
      <span className="text-xs text-inkMuted">
        {isEnded ? 'Oksjon lõppenud' : 'Tähtaeg'}
      </span>
      <span className={`font-mono text-bodySm font-medium ${timeColor}`}>
        {timeLabel}
      </span>
    </p>
  )
}
