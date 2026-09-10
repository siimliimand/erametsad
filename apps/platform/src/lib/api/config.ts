// Browser-facing API origin. Empty string keeps every client call
// same-origin (local dev, workers.dev previews); deployments that serve the
// API from its own hostname set NEXT_PUBLIC_API_ORIGIN at build time so the
// client bundle and the middleware CSP agree on the same value.
export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? ''

// Registrable-domain suffixes whose subdomains may call the API with
// credentials. Same-site subdomain requests keep SameSite=Lax cookies, so
// the allowlist doubles as the CSRF boundary: any other origin gets no
// CORS headers and the browser blocks the response.
export const API_CORS_DOMAIN_SUFFIXES = ['ww0.dev'] as const

// Exact origins outside the suffix list that still may call the API with
// credentials: the workers.dev preview URL serves the same app, and its
// pages must keep working against the API host.
export const API_CORS_EXTRA_ORIGINS = [
  'https://erametsad-api.siim-liimand.workers.dev',
] as const

export function isAllowedApiOrigin(origin: string | null): boolean {
  if (!origin) return false
  let parsed: URL
  try {
    parsed = new URL(origin)
  } catch {
    return false
  }
  const hostname = parsed.hostname.toLowerCase()
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return parsed.protocol === 'http:'
  }
  if (
    API_CORS_EXTRA_ORIGINS.some(
      (allowed) => parsed.origin.toLowerCase() === allowed,
    )
  ) {
    return true
  }
  return API_CORS_DOMAIN_SUFFIXES.some(
    (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
  )
}
