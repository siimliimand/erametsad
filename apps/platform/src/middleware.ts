import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { verifyAdminAccessToken } from '@/lib/auth/jwt'
import { apiRateLimiter, authRateLimiter } from '@/lib/rate-limit'
import {
  normalizeHostname,
  resolveDefaultHostRewrite,
  resolveHostRedirect,
  resolveLegacyPathRedirect,
  resolveHostArea,
} from '@/lib/routing/host-areas'

const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const SECURITY_HEADERS: Record<string, string> = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

function applySecurityHeaders(headers: Headers) {
  headers.set('Content-Security-Policy', CSP)
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value)
  }
}

function applyCorsHeaders(headers: Headers, origin: string) {
  headers.set('Access-Control-Allow-Origin', origin)
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  headers.set('Access-Control-Max-Age', '86400')
}

function applyRateLimitHeaders(headers: Headers, result: ReturnType<typeof apiRateLimiter.check>) {
  headers.set('X-RateLimit-Limit', String(result.limit))
  headers.set('X-RateLimit-Remaining', String(result.remaining))
  headers.set('X-RateLimit-Reset', String(result.reset))
}

// Maintenance gate (settings.maintenance_enabled, demo 13-settings).
// middleware() must stay synchronous, so the flag lives in a module cache
// refreshed in the background with a short TTL: enabling maintenance starts
// blocking within ~one TTL on mapped hosts, and any read failure (no
// Cloudflare context, no D1 binding, no settings row) fails open.
const MAINTENANCE_TTL_MS = 2000

const maintenanceCache: { enabled: boolean; expiresAt: number } = {
  enabled: false,
  expiresAt: 0,
}

async function readMaintenanceEnabled(): Promise<boolean> {
  const { db } = await import('@/lib/db')
  const result = await db.query<{ maintenance_enabled: number }>(
    'SELECT maintenance_enabled FROM settings LIMIT 1',
  )
  return result.results[0]?.maintenance_enabled === 1
}

function scheduleMaintenanceRefresh(): void {
  const now = Date.now()
  if (now < maintenanceCache.expiresAt) return
  maintenanceCache.expiresAt = now + MAINTENANCE_TTL_MS
  readMaintenanceEnabled()
    .then((enabled) => {
      maintenanceCache.enabled = enabled
    })
    .catch(() => {
      maintenanceCache.enabled = false
    })
}

// Admin keeps access during maintenance; the gate must never lock the
// operator out of the login flow or the admin UI itself. API routes stay
// available by design: auction timing is server-authoritative and the
// auction flow (REST + SSE) must keep working for in-flight auctions.
const MAINTENANCE_EXEMPT_PREFIXES = ['/api/', '/_next/', '/_vercel/', '/admin/', '/styleguide/']
const MAINTENANCE_EXEMPT_PATHS = [
  '/api',
  '/admin',
  '/styleguide',
  '/login',
  '/reset-password',
  '/update-password',
  '/select-profile',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/manifest.webmanifest',
]

function isMaintenanceExempt(pathname: string): boolean {
  return (
    MAINTENANCE_EXEMPT_PATHS.includes(pathname) ||
    MAINTENANCE_EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  )
}

function isAdminRequest(request: NextRequest): boolean {
  try {
    const token = request.cookies.get('access_token')?.value
    return typeof token === 'string' && verifyAdminAccessToken(token) !== null
  } catch {
    return false
  }
}

const MAINTENANCE_HTML = `<!doctype html>
<html lang="et">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hooldusrežiim | Erametsad</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#fbf8ff;color:#181a2e;font:400 15px/22px system-ui,-apple-system,sans-serif;text-align:center;padding:24px">
<main>
<h1 style="font-size:22px;margin:0 0 8px">Hooldusrežiim</h1>
<p style="margin:0">Portaal on ajutiselt hooldustööde tõttu suletud. Palun tule hiljem tagasi.</p>
</main>
</body>
</html>`

function maintenanceResponse(): NextResponse {
  const response = new NextResponse(MAINTENANCE_HTML, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Retry-After': '300' },
  })
  applySecurityHeaders(response.headers)
  return response
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const hostname = normalizeHostname(request.headers.get('host'))

  // Static 301 first: legacy links reach the canonical default-host path in
  // one hop, ahead of any cross-host 308, on both mapped hosts.
  const legacyRedirect = resolveLegacyPathRedirect(hostname, pathname, search)
  if (legacyRedirect) {
    const redirect = NextResponse.redirect(legacyRedirect, 301)
    applySecurityHeaders(redirect.headers)
    return redirect
  }

  // 308 keeps method, path, and query across the host switch. Unmapped
  // hostnames fall through here untouched (D7: every branch except the
  // two mapped hosts is a no-op).
  const hostRedirect = resolveHostRedirect(hostname, pathname, search)
  if (hostRedirect) {
    const redirect = NextResponse.redirect(hostRedirect, 308)
    applySecurityHeaders(redirect.headers)
    return redirect
  }

  const origin = request.headers.get('origin') ?? ''
  const isApiRoute = pathname.startsWith('/api')

  // Maintenance gate (mapped hosts only, D7): blocks public page routes
  // while settings.maintenance_enabled is on. Admin sessions pass, the
  // admin UI, login flow, shared statics, and every /api route stay up.
  if (resolveHostArea(hostname) !== null) {
    scheduleMaintenanceRefresh()
    if (
      maintenanceCache.enabled &&
      !isMaintenanceExempt(pathname) &&
      !isAdminRequest(request)
    ) {
      return maintenanceResponse()
    }
  }

  if (isApiRoute) {
    const isAuthRoute = pathname === '/api/auth' || pathname.startsWith('/api/auth/')
    const limiter = isAuthRoute ? authRateLimiter : apiRateLimiter
    const key = request.headers.get('x-forwarded-for') ?? 'global'
    const result = limiter.check(key)

    if (!result.allowed) {
      const response = NextResponse.json({ error: 'Too many requests' }, { status: 429 })
      if (origin) applyCorsHeaders(response.headers, origin)
      applyRateLimitHeaders(response.headers, result)
      applySecurityHeaders(response.headers)
      return response
    }

    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 })
      if (origin) applyCorsHeaders(response.headers, origin)
      applySecurityHeaders(response.headers)
      return response
    }

    const response = NextResponse.next()
    if (origin) applyCorsHeaders(response.headers, origin)
    applyRateLimitHeaders(response.headers, result)
    applySecurityHeaders(response.headers)
    return response
  }

  // Default host only: `/` and `/lepingud` render the (marketing) routes
  // through a rewrite while the URL stays unchanged (D1).
  const rewritePath = resolveDefaultHostRewrite(hostname, pathname)
  const response = rewritePath
    ? NextResponse.rewrite(new URL(`${rewritePath}${search}`, request.url))
    : NextResponse.next()
  applySecurityHeaders(response.headers)
  return response
}

// Node runtime: this middleware needs no Edge APIs, and an Edge middleware
// entry forces Next to also compile instrumentation.ts for the Edge
// runtime, where payload/nodemailer cannot resolve node builtins.
export const config = {
  runtime: 'nodejs',
  matcher: '/:path*',
}