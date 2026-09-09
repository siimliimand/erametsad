'use client'

import { useEffect, useState } from 'react'

import {
  impersonationStateAction,
  stopImpersonationAction,
} from '@/app/(admin)/_actions/users'
import type { PortalAuthState } from '@/app/(portal)/_lib/session'

function isRedirectSignal(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest
  return typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')
}

function remainingLabel(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Sticky amber view-session banner (demo 06-users .imp-banner): shown in the
 * portal while an admin impersonation session is active. Kirjutustegevused
 * on server-side blokeeritud; LÕPETA VAATLUS ends and audits the session.
 * The 30-minute TTL (spec delta admin-people) shows as a countdown fed by
 * the session row's expiresAt; at zero the stop action ends the session.
 */
export function ImpersonationBanner({ auth }: { auth: PortalAuthState | null }) {
  const [ending, setEnding] = useState(false)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState<number | null>(null)

  useEffect(() => {
    if (!auth?.impersonatedBy) return
    let cancelled = false
    impersonationStateAction()
      .then((state) => {
        if (!cancelled && state.active && state.expiresAt) {
          setExpiresAt(state.expiresAt)
        }
      })
      .catch(() => {
        // No expiry feed: the banner keeps its static form.
      })
    return () => {
      cancelled = true
    }
  }, [auth?.impersonatedBy])

  useEffect(() => {
    if (!expiresAt) return
    const target = new Date(expiresAt).getTime()
    const tick = () => {
      setRemainingMs(target - Date.now())
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => {
      clearInterval(interval)
    }
  }, [expiresAt])

  const endedByTimeout = remainingMs !== null && remainingMs <= 0

  useEffect(() => {
    if (!endedByTimeout || ending) return
    setEnding(true)
    stopImpersonationAction().catch((caught: unknown) => {
      if (isRedirectSignal(caught)) return
      setEnding(false)
    })
  }, [endedByTimeout, ending])

  if (!auth?.impersonatedBy) return null

  const endImpersonation = () => {
    setEnding(true)
    stopImpersonationAction().catch((caught: unknown) => {
      if (isRedirectSignal(caught)) return
      setEnding(false)
    })
  }

  return (
    <section
      role="status"
      className="sticky top-0 z-40 flex min-h-10 items-center gap-2.5 bg-cta px-4 py-1.5 font-heading text-bodySm font-semibold text-primary md:px-6"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4 shrink-0">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <span className="min-w-0 flex-1">
        Vaatled keskkonda kasutajana: <strong>{auth.profileName ?? auth.userId}</strong> —
        Kirjutustegevused on blokeeritud
        {remainingMs !== null && !endedByTimeout ? (
          <span className="ml-2 font-mono">· {remainingLabel(remainingMs)}</span>
        ) : null}
        {endedByTimeout ? <span className="ml-2">· Vaatlus on lõppemas…</span> : null}
      </span>
      <button
        type="button"
        onClick={endImpersonation}
        disabled={ending}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-pill bg-bgPage px-3 py-1 text-label font-bold text-ink transition-transform duration-hover ease-hover hover:-translate-y-px hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3">
          <path d="M18 6 6 18" />
          <path d="m6 6 12 12" />
        </svg>
        LÕPETA VAATLUS
      </button>
    </section>
  )
}
