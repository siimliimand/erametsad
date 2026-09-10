export const PORTAL_HOSTNAME = 'oksjonid.erametsad.ww0.dev'
export const DEFAULT_HOSTNAME = 'erametsad.ww0.dev'
export const ADMIN_HOSTNAME = 'admin.erametsad.ww0.dev'
export const API_HOSTNAME = 'api.erametsad.ww0.dev'

export type HostArea = 'portal' | 'default' | 'admin'
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

// Auth flow paths the admin host keeps same-host: session cookies are
// host-only, so a redirect to another hostname mid-login would land the
// fresh cookie on the wrong host and the admin session would never
// establish.
const AUTH_PREFIXES = ['/reset-password/', '/update-password/']
const AUTH_PATHS = [
  '/login',
  '/register',
  '/reset-password',
  '/select-profile',
  '/update-password',
]

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
  // host, admin-owned on the admin host (the prefix-free rewrite maps them
  // into the /admin route space), and portal pages or 404s on the portal
  // host.
  if (hostArea === 'default') return 'marketing'
  if (hostArea === 'admin') return 'app'
  return 'portal'
}

// Hostnames outside the table (workers.dev previews, localhost, api.)
// return null and the middleware no-ops, per design decision D7.
export function resolveHostArea(hostname: string | null): HostArea | null {
  if (hostname === PORTAL_HOSTNAME) return 'portal'
  if (hostname === DEFAULT_HOSTNAME) return 'default'
  if (hostname === ADMIN_HOSTNAME) return 'admin'
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

  if (hostArea === 'admin') {
    // Prefix-free URL space: on this host the admin UI lives at /, /auctions,
    // ... so a /admin-prefixed URL is a legacy entry point that 308s to the
    // clean form. Internal redirects to /admin/... (server actions, old
    // bookmarks) end up clean through this hop.
    if (pathname === '/admin') return `https://${ADMIN_HOSTNAME}/${search}`
    if (pathname.startsWith('/admin/')) {
      return `https://${ADMIN_HOSTNAME}${pathname.slice('/admin'.length)}${search}`
    }
    // Portal-owned short URL that stays unlisted (see PORTAL_* above): on
    // this host it belongs to the portal, not the admin 404 space.
    if (pathname === '/lepingud') return `https://${PORTAL_HOSTNAME}/lepingud${search}`
    // The login flow stays same-host so the host-only session cookie
    // lands on the hostname the operator is using. `/` itself is handled
    // by resolveAdminHostRewrite (rewrite, not redirect).
    if (matchesArea(pathname, AUTH_PATHS, AUTH_PREFIXES)) return null
    if (pathArea === 'portal') {
      return `https://${PORTAL_HOSTNAME}${pathname}${search}`
    }
    if (pathArea === 'marketing') {
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

// Prefix-free admin host: root paths that are not owned by another area
// render the admin app through an internal rewrite into its /admin route
// space, so the URL stays clean while the router sees the real route.
export function resolveAdminHostRewrite(hostname: string | null, pathname: string): string | null {
  if (resolveHostArea(hostname) !== 'admin') return null
  if (pathname === '/') return '/admin'
  // Portal-owned short URL handed to the portal host by the redirect step.
  if (pathname === '/lepingud') return null
  if (matchesArea(pathname, SHARED_PATHS, SHARED_PREFIXES)) return null
  if (matchesArea(pathname, AUTH_PATHS, AUTH_PREFIXES)) return null
  if (matchesArea(pathname, MARKETING_PATHS, MARKETING_PREFIXES)) return null
  if (matchesArea(pathname, PORTAL_PATHS, PORTAL_PREFIXES)) return null
  // Top-level dev tool with its own route space; it keeps its URL on every
  // mapped host.
  if (pathname === '/styleguide' || pathname.startsWith('/styleguide/')) return null
  return `/admin${pathname}`
}

// The API hostname serves only /api routes; anything else is a stray page
// URL that 308s to the default host so no page renders on the API origin.
// Returns the redirect target or null when the request passes through.
export function resolveApiHostRedirect(
  hostname: string | null,
  pathname: string,
  search = '',
): string | null {
  if (hostname !== API_HOSTNAME) return null
  if (pathname === '/api' || pathname.startsWith('/api/')) return null
  return `https://${DEFAULT_HOSTNAME}${pathname}${search}`
}
