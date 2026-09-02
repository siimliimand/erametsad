'use client'

import { useEffect, useState } from 'react'

import { track } from '@/lib/analytics/track'

export const CONSENT_COOKIE = 'erametsad_consent'
export const CONSENT_CHANGE_EVENT = 'erametsad:consent-change'

// 12 months, per the marketing-shell spec.
const CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 365

export interface ConsentState {
  necessary: boolean
  statistics: boolean
  marketing: boolean
}

// The exact values POST /api/v1/consent validates.
export type ConsentChoice = 'accepted' | 'rejected' | 'custom'

export const ACCEPT_ALL: ConsentState = {
  necessary: true,
  statistics: true,
  marketing: true,
}

export const NECESSARY_ONLY: ConsentState = {
  necessary: true,
  statistics: false,
  marketing: false,
}

// Analytics provider gating point: a provider script (GA4/Plausible) loads
// only when consent.statistics is true. Until a provider is chosen
// (deferred), the gate lives inside lib/analytics/track.ts, which sends
// every event except `cookie_consent` only with statistics consent.
export function readConsentCookie(): ConsentState | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== CONSENT_COOKIE) continue
    try {
      const parsed: unknown = JSON.parse(
        decodeURIComponent(part.slice(separator + 1).trim()),
      )
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null
      }
      const record = parsed as Record<string, unknown>
      return {
        necessary: record.necessary === true,
        statistics: record.statistics === true,
        marketing: record.marketing === true,
      }
    } catch {
      return null
    }
  }
  return null
}

export function deriveChoice(consent: ConsentState): ConsentChoice {
  if (consent.statistics && consent.marketing) return 'accepted'
  if (!consent.statistics && !consent.marketing) return 'rejected'
  return 'custom'
}

function writeConsentCookie(consent: ConsentState): void {
  // Session cookies in this app use Secure + SameSite=Lax; the consent
  // cookie is client-written, so Secure is only set on https pages.
  const secure =
    typeof location !== 'undefined' && location.protocol === 'https:'
      ? '; secure'
      : ''
  document.cookie =
    `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(consent))}` +
    `; path=/; max-age=${String(CONSENT_MAX_AGE_SECONDS)}; samesite=lax${secure}`
}

function logConsent(choice: ConsentChoice, consent: ConsentState): void {
  void fetch('/api/v1/consent', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ choice, categories: consent }),
    keepalive: true,
  }).catch(() => {
    // Consent logging failures are not user-facing.
  })
}

// One decision: cookie write, server log, analytics ping, UI event.
export function saveConsent(consent: ConsentState): void {
  if (typeof document === 'undefined') return
  writeConsentCookie(consent)
  const choice = deriveChoice(consent)
  logConsent(choice, consent)
  track('cookie_consent', { choice, ...consent })
  document.dispatchEvent(new CustomEvent(CONSENT_CHANGE_EVENT))
}

export function useConsent(): { consent: ConsentState | null; ready: boolean } {
  const [consent, setConsent] = useState<ConsentState | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const sync = () => {
      setConsent(readConsentCookie())
    }
    setConsent(readConsentCookie())
    setReady(true)
    document.addEventListener(CONSENT_CHANGE_EVENT, sync)
    return () => {
      document.removeEventListener(CONSENT_CHANGE_EVENT, sync)
    }
  }, [])

  return { consent, ready }
}
