import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { apiRateLimiter, authRateLimiter } from '@/lib/rate-limit'
import { normalizeHostname, resolveHostRedirect } from '@/lib/routing/host-areas'

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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  // 308 keeps method, path, and query across the host switch. Unmapped
  // hostnames fall through here untouched (D7: every branch except the
  // two mapped hosts is a no-op).
  const hostRedirect = resolveHostRedirect(
    normalizeHostname(request.headers.get('host')),
    pathname,
    search,
  )
  if (hostRedirect) {
    const redirect = NextResponse.redirect(hostRedirect, 308)
    applySecurityHeaders(redirect.headers)
    return redirect
  }

  const origin = request.headers.get('origin') ?? ''
  const isApiRoute = pathname.startsWith('/api')

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

  const response = NextResponse.next()
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