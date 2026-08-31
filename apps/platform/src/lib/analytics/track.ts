const CONSENT_COOKIE = 'eametsad_consent'

// Same value shape the events route reads: URL-encoded JSON per the shell
// spec, written by the CookieBanner (task 2.4). Necessary is always granted
// and not represented here; only statistics gates event sending.
function readConsent(): { statistics?: unknown } | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    if (part.slice(0, separator).trim() !== CONSENT_COOKIE) continue
    try {
      const parsed: unknown = JSON.parse(decodeURIComponent(part.slice(separator + 1).trim()))
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return null
      }
      return parsed
    } catch {
      return null
    }
  }
  return null
}

/**
 * Fire-and-forget analytics event. Safe to call during SSR (no-op) and
 * never throws. Gated on statistics consent client-side, per the
 * marketing-support-api spec; `cookie_consent` always sends (design D4).
 */
export function track(name: string, props?: Record<string, unknown>): void {
  try {
    if (typeof document === 'undefined') return
    if (name !== 'cookie_consent') {
      if (readConsent()?.statistics !== true) return
    }
    void fetch('/api/v1/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, props }),
      keepalive: true,
    }).catch(() => {
      // Network failures are not user-facing.
    })
  } catch {
    // Analytics must never break the page.
  }
}
