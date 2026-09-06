'use client'

import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { formatDateTime } from '../../../_lib/labels'
import { countdownText } from '../_lib/list-view'

const CRITICAL_MS = 5 * 60 * 1000

export interface CountdownProps {
  endsAt: string
  className?: string
  /**
   * Server-rendered initial text. Shown until the client clock starts so
   * hydration output matches the server and no layout shift occurs.
   */
  children: ReactNode
}

export function Countdown({
  endsAt,
  className = '',
  children,
}: CountdownProps) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
    }, 1000)
    return () => {
      clearInterval(timer)
    }
  }, [])

  const remaining = now === null ? null : Date.parse(endsAt) - now
  const critical =
    remaining !== null && remaining > 0 && remaining < CRITICAL_MS
  const ended = remaining !== null && remaining <= 0

  return (
    <time
      dateTime={endsAt}
      aria-label={`Lõpeb ${formatDateTime(endsAt)}`}
      title={formatDateTime(endsAt)}
      className={`font-mono text-bodySm font-medium tabular-nums ${className}${critical ? ' cd-crit' : ''}`}
    >
      {now === null
        ? children
        : ended
          ? 'lõppenud'
          : countdownText(endsAt, now)}
    </time>
  )
}
