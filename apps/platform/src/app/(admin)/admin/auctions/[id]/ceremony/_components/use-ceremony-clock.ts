'use client'

import { useEffect, useState } from 'react'

/**
 * Ticking client clock for ceremony countdowns. Returns `null` until
 * mounted so server and client renders stay identical (no hydration
 * mismatch); countdown text renders a placeholder until the first tick.
 */
export function useCeremonyClock(intervalMs = 1000): number | null {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => {
      setNow(Date.now())
    }, intervalMs)
    return () => {
      clearInterval(timer)
    }
  }, [intervalMs])
  return now
}

/** Mirrors CEREMONY_SIGNATURE_TTL_SECONDS in _actions/auctions.ts (display only). */
export const SIGNATURE_TTL_MS = 30 * 60 * 1000

/** Mirrors CEREMONY_REVEAL_GRACE_MS in _actions/auctions.ts (display only). */
export const REVEAL_GRACE_MS = 60_000

export function formatCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return '0:00'
  const totalSeconds = Math.floor(remainingMs / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}
