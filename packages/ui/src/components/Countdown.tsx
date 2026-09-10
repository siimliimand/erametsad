'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'

export type CountdownFormat = 'default' | 'portal'

export interface CountdownProps {
  endsAt: string | Date
  onEnd?: () => void
  /**
   * Epoch ms captured during SSR. When present, the tick computes
   * `serverNow + (Date.now() - mountTime)` instead of `Date.now()`, so a
   * drifted client clock cannot skew the countdown.
   */
  serverNow?: number
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  /**
   * 'default' renders `{d}p {h}h {m}m {s}s` (admin/marketing). 'portal'
   * renders `{d}p HH:MM:SS` and swaps to a "Lõpeb varsti" badge for the
   * final hour, matching the portal demo.
   */
  format?: CountdownFormat
  className?: string
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
} as const

function calcRemaining(endsAt: number, nowMs: number) {
  const total = endsAt - nowMs
  if (total <= 0) return { total: 0, days: 0, hours: 0, minutes: 0, seconds: 0 }
  const s = Math.floor(total / 1000)
  return {
    total,
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0')

interface Remaining {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function portalTimeStr({ days, hours, minutes, seconds }: Remaining) {
  const hms = `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`
  return days > 0 ? `${days}p ${hms}` : hms
}

export function Countdown({
  endsAt,
  onEnd,
  serverNow,
  showLabel = true,
  size = 'md',
  format = 'default',
  className,
}: CountdownProps) {
  const endMs = useMemo(
    () => (typeof endsAt === 'string' ? new Date(endsAt).getTime() : endsAt.getTime()),
    [endsAt],
  )

  // Frozen at first render; hydration keeps the server value, so the
  // elapsed offset measures real time even on a drifted client clock.
  const [mountTime] = useState(() => Date.now())
  const nowMs = useCallback(
    () =>
      serverNow === undefined
        ? Date.now()
        : serverNow + (Date.now() - mountTime),
    [serverNow, mountTime],
  )

  const [remaining, setRemaining] = useState(() => calcRemaining(endMs, nowMs()))
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd
  const firedRef = useRef(false)

  useEffect(() => {
    const now = nowMs()
    setRemaining(calcRemaining(endMs, now))
    // A new deadline may arrive after a previous zero (anti-snipe
    // extension), so the once-only guard resets per deadline.
    firedRef.current = false

    if (endMs <= now) return

    const id = setInterval(() => {
      const r = calcRemaining(endMs, nowMs())
      setRemaining(r)
      if (r.total <= 0 && !firedRef.current) {
        firedRef.current = true
        clearInterval(id)
        onEndRef.current?.()
      }
    }, 1000)

    return () => clearInterval(id)
  }, [endMs, nowMs])

  const isEnded = remaining.total <= 0

  if (isEnded) {
    return (
      <span className={`inline-flex items-center gap-1 font-mono tracking-tight ${sizeClasses[size]} text-ink-muted ${className ?? ''}`}>
        {showLabel && <span className="font-sans text-ink-muted">Lõppenud</span>}
      </span>
    )
  }

  const { days, hours, minutes, seconds } = remaining
  const totalMinutesLeft = days * 24 * 60 + hours * 60 + minutes

  let colorClass: string
  let animClass: string

  if (totalMinutesLeft < 5) {
    colorClass = 'text-status-critical'
    animClass = 'animate-pulse-countdown-fast'
  } else if (totalMinutesLeft < 60) {
    colorClass = 'text-status-ending-soon'
    animClass = 'animate-pulse-countdown'
  } else {
    colorClass = 'text-ink'
    animClass = ''
  }

  const ariaLabel = `Aega jäänud ${days} päeva ${hours} tundi ${minutes} minutit ${seconds} sekundit`

  // Portal demo: the final hour swaps the ticking text for a badge that
  // keeps the same warn/critical tiers through its colors.
  if (format === 'portal' && totalMinutesLeft < 60) {
    const critical = totalMinutesLeft < 5
    return (
      <span
        className={`inline-flex items-center rounded-pill px-2 py-0.5 text-xs font-semibold ${critical ? 'bg-statusCritical/10 text-statusCritical animate-pulse-countdown-fast' : 'bg-statusEndingSoon/10 text-statusEndingSoon animate-pulse-countdown'} ${className ?? ''}`}
        aria-live="polite"
        aria-label={ariaLabel}
      >
        Lõpeb varsti
      </span>
    )
  }

  const timeStr =
    format === 'portal'
      ? portalTimeStr(remaining)
      : days > 0
        ? `${days}p ${hours}h ${minutes}m ${seconds}s`
        : `${hours}h ${minutes}m ${seconds}s`

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tracking-tight ${animClass} ${sizeClasses[size]} ${colorClass} ${className ?? ''}`}
      style={{ fontFeatureSettings: '"tnum" 1' }}
      aria-live="polite"
      aria-label={ariaLabel}
    >
      {showLabel && <span className="font-sans">Aega jäänud</span>}
      {timeStr}
    </span>
  )
}