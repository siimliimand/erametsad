export const PORTAL_HOSTNAME = 'oksjonid.erametsad.ww0.dev'
export const DEFAULT_HOSTNAME = 'erametsad.ww0.dev'

export type HostArea = 'portal' | 'default'
export type PathArea = 'portal' | 'app' | 'shared' | 'marketing'

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

// The (marketing) route group's real routes. They belong on the default
// host; the portal host hands them over, normalizing the homepage and
// document list back to their shared short URLs.
const MARKETING_PREFIXES = [
  '/teenused/',
  '/paringud/',
  '/kkk/',
  '/meist/',
  '/artiklid/',
  '/metsateatis/',
  '/hindamisaktid/',
  '/kiiroksjon/',
  '/kontakt/',
  '/lepingud/dokumendid/',
]
const MARKETING_PATHS = [
  '/teenused',
  '/paringud',
  '/kkk',
  '/meist',
  '/artiklid',
  '/metsateatis',
  '/hindamisaktid',
  '/kiiroksjon',
  '/kontakt',
  '/avaleht',
  '/lepingud/dokumendid',
  '/metsateatise-juhend',
]

// Explicit portal surface that must still 308 to the portal host when
// requested on the default host. `/` and `/lepingud` are portal-owned too
// (D1) but deliberately unlisted: on the default host the marketing
// homepage and document list take them over via rewrite, and on the portal
// host the unlisted fallback already keeps them there.
const PORTAL_PREFIXES = [
  '/oksjon/',
  '/user/',
  '/login/',
  '/register/',
  '/reset-password/',
  '/select-profile/',
  '/update-password/',
  '/lepingud/raamleping',
  '/lepingud/oksjonileping/',
]
const PORTAL_PATHS = [
  '/ajalugu',
  '/user',
  '/login',
  '/register',
  '/reset-password',
  '/select-profile',
  '/update-password',
]

// Legacy URLs mapped to their canonical default-host path.
const LEGACY_PATH_REDIRECTS: Record<string, string> = {
  '/metsateatise-juhend': '/metsateatis',
}

function matchesArea(pathname: string, exact: string[], prefixes: string[]): boolean {
  return exact.includes(pathname) || prefixes.some((prefix) => pathname.startsWith(prefix))
}

export function resolvePathArea(pathname: string, hostArea: HostArea | null = null): PathArea {
  if (matchesArea(pathname, SHARED_PATHS, SHARED_PREFIXES)) return 'shared'
  if (matchesArea(pathname, APP_PATHS, APP_PREFIXES)) return 'app'
  if (matchesArea(pathname, MARKETING_PATHS, MARKETING_PREFIXES)) return 'marketing'
  if (matchesArea(pathname, PORTAL_PATHS, PORTAL_PREFIXES)) return 'portal'
  // Unlisted paths are marketing pages or the branded 404 on the default
  // host; the portal host keeps serving them (portal 404s included).
  return hostArea === 'default' ? 'marketing' : 'portal'
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

  const pathArea = resolvePathArea(pathname, hostArea)

  if (hostArea === 'portal') {
    // Rewrite targets normalize to their shared short URLs instead of
    // carrying the long marketing pathname across hosts.
    if (pathname === '/avaleht') return `https://${DEFAULT_HOSTNAME}/${search}`
    if (pathname === '/lepingud/dokumendid') return `https://${DEFAULT_HOSTNAME}/lepingud${search}`
    if (pathArea === 'marketing' || pathArea === 'app') {
      return `https://${DEFAULT_HOSTNAME}${pathname}${search}`
    }
    return null
  }

  if (pathArea === 'portal') {
    return `https://${PORTAL_HOSTNAME}${pathname}${search}`
  }
  return null
}

// Static 301 for legacy paths. Always absolute to the default host so a
// portal-host request lands on the canonical URL in one hop, with no
// 308-then-301 chain. Mapped hosts only (D7).
export function resolveLegacyPathRedirect(
  hostname: string | null,
  pathname: string,
  search = '',
): string | null {
  const target = LEGACY_PATH_REDIRECTS[pathname]
  if (!target) return null
  if (!resolveHostArea(hostname)) return null
  return `https://${DEFAULT_HOSTNAME}${target}${search}`
}

// Portal-owned paths the marketing site takes over on the default host
// (D1): middleware rewrites them to the (marketing) routes while the URL
// stays unchanged. Returns the internal rewrite target or null.
export function resolveDefaultHostRewrite(hostname: string | null, pathname: string): string | null {
  if (resolveHostArea(hostname) !== 'default') return null
  if (pathname === '/') return '/avaleht'
  if (pathname === '/lepingud') return '/lepingud/dokumendid'
  return null
}
