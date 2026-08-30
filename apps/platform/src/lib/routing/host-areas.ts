export const PORTAL_HOSTNAME = 'oksjonid.erametsad.ww0.dev'
export const DEFAULT_HOSTNAME = 'erametsad.ww0.dev'

export type HostArea = 'portal' | 'default'
export type PathArea = 'portal' | 'app' | 'shared'

// Served identically on every mapped host so same-origin fetches, build
// output, and root metadata files never bounce between hostnames.
const SHARED_PREFIXES = ['/api/', '/_next/', '/_vercel/']
const SHARED_PATHS = [
  '/api',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/manifest.webmanifest',
]

// The default host's own surface: admin UI and the styleguide dev tool.
const APP_PREFIXES = ['/admin/', '/styleguide/']
const APP_PATHS = ['/admin', '/styleguide']

function matchesArea(pathname: string, exact: string[], prefixes: string[]): boolean {
  return exact.includes(pathname) || prefixes.some((prefix) => pathname.startsWith(prefix))
}

export function resolvePathArea(pathname: string): PathArea {
  if (matchesArea(pathname, SHARED_PATHS, SHARED_PREFIXES)) return 'shared'
  if (matchesArea(pathname, APP_PATHS, APP_PREFIXES)) return 'app'
  return 'portal'
}

// Unknown hostnames (workers.dev previews, localhost, api., admin.) return
// null and the middleware no-ops, per design decision D7.
export function resolveHostArea(hostname: string | null): HostArea | null {
  if (hostname === PORTAL_HOSTNAME) return 'portal'
  if (hostname === DEFAULT_HOSTNAME) return 'default'
  return null
}

export function normalizeHostname(hostHeader: string | null): string | null {
  if (!hostHeader) return null
  const host = hostHeader.trim().toLowerCase().replace(/:\d+$/, '')
  return host === '' ? null : host
}

// Returns the redirect target when the path belongs to the other mapped
// host, or null when the request passes through unchanged. Preserving the
// query is the caller's job via the search argument.
export function resolveHostRedirect(
  hostname: string | null,
  pathname: string,
  search = '',
): string | null {
  const hostArea = resolveHostArea(hostname)
  if (!hostArea) return null

  const pathArea = resolvePathArea(pathname)
  if (hostArea === 'portal' && pathArea === 'app') {
    return `https://${DEFAULT_HOSTNAME}${pathname}${search}`
  }
  if (hostArea === 'default' && pathArea === 'portal') {
    return `https://${PORTAL_HOSTNAME}${pathname}${search}`
  }
  return null
}
