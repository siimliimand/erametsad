'use client'

import { useEffect, useState, useMemo, useRef } from 'react'

export interface CountdownProps {
  endsAt: string | Date
  onEnd?: () => void
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
} as const

function calcRemaining(endsAt: number) {
  const total = endsAt - Date.now()
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

export function Countdown({
  endsAt,
  onEnd,
  showLabel = true,
  size = 'md',
  className,
}: CountdownProps) {
  const endMs = useMemo(
    () => (typeof endsAt === 'string' ? new Date(endsAt).getTime() : endsAt.getTime()),
    [endsAt],
  )

  const initial = useMemo(() => calcRemaining(endMs), [endMs])
  const [remaining, setRemaining] = useState(initial)
  const onEndRef = useRef(onEnd)
  onEndRef.current = onEnd

  useEffect(() => {
    setRemaining(calcRemaining(endMs))

    if (endMs <= Date.now()) return

    const id = setInterval(() => {
      const r = calcRemaining(endMs)
      setRemaining(r)
      if (r.total <= 0) {
        onEndRef.current?.()
      }
    }, 1000)

    return () => clearInterval(id)
  }, [endMs])

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

  const timeStr =
    days > 0
      ? `${days}p ${hours}h ${minutes}m ${seconds}s`
      : `${hours}h ${minutes}m ${seconds}s`

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono tracking-tight ${animClass} ${sizeClasses[size]} ${colorClass} ${className ?? ''}`}
      style={{ fontFeatureSettings: '"tnum" 1' }}
      aria-live="polite"
      aria-label={`Aega jäänud ${days} päeva ${hours} tundi ${minutes} minutit ${seconds} sekundit`}
    >
      {showLabel && <span className="font-sans">Aega jäänud</span>}
      {timeStr}
    </span>
  )
}