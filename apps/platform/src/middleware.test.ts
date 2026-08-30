import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { DEFAULT_HOSTNAME, PORTAL_HOSTNAME } from '@/lib/routing/host-areas'
import { middleware } from '@/middleware'

function requestFor(host: string, pathAndQuery: string): NextRequest {
  return new NextRequest(`http://localhost:3000${pathAndQuery}`, {
    headers: { host },
  })
}

describe('middleware host mapping', () => {
  it('serves the portal listing on the portal host without redirecting', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects portal paths from the default host with 308, preserving path and query', () => {
    const response = middleware(
      requestFor(DEFAULT_HOSTNAME, '/oksjon/9?foo=bar&tab=raieoigused'),
    )

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      `https://${PORTAL_HOSTNAME}/oksjon/9?foo=bar&tab=raieoigused`,
    )
  })

  it('redirects app paths from the portal host to the default host with 308', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/admin/auctions?tab=type'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      `https://${DEFAULT_HOSTNAME}/admin/auctions?tab=type`,
    )
  })

  it('does not redirect shared API paths on the portal host', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/api/v1/auctions'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })

  it('does not redirect shared build paths on the portal host', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/_next/static/chunk.js'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})
