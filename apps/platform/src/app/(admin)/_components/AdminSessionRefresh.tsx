'use client'

import { useEffect } from 'react'

import { apiFetch } from '@/lib/api/client'

// The access-token cookie lives 5 minutes; the server guard redirects to
// /login the moment it lapses. The refresh endpoint exists but nothing
// called it, so every reload after 5 idle minutes bounced the operator to
// the login page. This keepalive rotates the session while the tab is open.
const REFRESH_INTERVAL_MS = 4 * 60 * 1000

/**
 * Refreshes the admin session on mount and every ~4 minutes while the tab
 * is visible. The jitter spreads tabs firing at once: the refresh endpoint
 * rotates the token family with a compare-and-swap, and two simultaneous
 * rotations from one browser would trip reuse detection and kill the
 * session. On 401 it stays quiet — the server guard handles the redirect
 * on the next navigation.
 */
export function AdminSessionRefresh() {
  useEffect(() => {
    let inFlight = false

    const refresh = (): void => {
      if (inFlight || document.visibilityState !== 'visible') return
      inFlight = true
      apiFetch('/api/v1/auth/refresh', {
        method: 'POST',
        credentials: 'same-origin',
      })
        .catch(() => undefined)
        .finally(() => {
          inFlight = false
        })
    }

    refresh()
    const tick = setInterval(
      refresh,
      REFRESH_INTERVAL_MS + Math.floor(Math.random() * 20_000),
    )
    const wake = (): void => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(tick)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [])

  return null
}
