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

describe('middleware default-host marketing rewrites', () => {
  it('rewrites / to the homepage route while the URL stays /', () => {
    const response = middleware(requestFor(DEFAULT_HOSTNAME, '/'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBe('http://localhost:3000/avaleht')
  })

  it('rewrites /lepingud to the marketing document list, preserving query', () => {
    const response = middleware(requestFor(DEFAULT_HOSTNAME, '/lepingud?sort=uus'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3000/lepingud/dokumendid?sort=uus',
    )
  })

  it('passes real marketing routes and unknown paths through untouched', () => {
    for (const path of ['/avaleht', '/lepingud/dokumendid', '/teenused/hindamine', '/puudub']) {
      const response = middleware(requestFor(DEFAULT_HOSTNAME, path))

      expect(response.status).toBe(200)
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
      expect(response.headers.get('location')).toBeNull()
    }
  })

  it('serves /paringud on the default host as a marketing route without redirecting', () => {
    const response = middleware(requestFor(DEFAULT_HOSTNAME, '/paringud?piirkond=harju'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.headers.get('location')).toBeNull()
  })

  it('never rewrites on the portal host', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/lepingud'))

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('middleware marketing paths on the portal host', () => {
  it('redirects marketing paths to the default host with 308, preserving path and query', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/teenused/hindamine?kee=info'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      `https://${DEFAULT_HOSTNAME}/teenused/hindamine?kee=info`,
    )
  })

  it('redirects /paringud to the default host with 308, preserving path and query', () => {
    for (const pathAndQuery of ['/paringud?piirkond=harju', '/paringud/hooldusraie?teenus=raie']) {
      const response = middleware(requestFor(PORTAL_HOSTNAME, pathAndQuery))

      expect(response.status).toBe(308)
      expect(response.headers.get('location')).toBe(`https://${DEFAULT_HOSTNAME}${pathAndQuery}`)
    }
  })

  it('normalizes /avaleht to / on the default host', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/avaleht?kampaania=kevad'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`https://${DEFAULT_HOSTNAME}/?kampaania=kevad`)
  })

  it('normalizes /lepingud/dokumendid to /lepingud on the default host', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/lepingud/dokumendid?leht=2'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`https://${DEFAULT_HOSTNAME}/lepingud?leht=2`)
  })

  it('serves unknown paths on the portal host without redirecting', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/puuduv-leht'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('middleware legacy guide redirect', () => {
  it('301s /metsateatise-juhend to /metsateatis on the default host', () => {
    const response = middleware(requestFor(DEFAULT_HOSTNAME, '/metsateatise-juhend?allikas=vana'))

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(
      `https://${DEFAULT_HOSTNAME}/metsateatis?allikas=vana`,
    )
  })

  it('301s /metsateatise-juhend straight to the default host from the portal host', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/metsateatise-juhend'))

    expect(response.status).toBe(301)
    expect(response.headers.get('location')).toBe(`https://${DEFAULT_HOSTNAME}/metsateatis`)
  })

  it('leaves the canonical marketing path untouched', () => {
    const response = middleware(requestFor(DEFAULT_HOSTNAME, '/metsateatis'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('middleware unmapped-host no-op', () => {
  it('passes marketing paths through on unmapped hostnames untouched', () => {
    for (const host of ['api.erametsad.ww0.dev', 'admin.erametsad.ww0.dev', 'localhost:3000']) {
      const response = middleware(requestFor(host, '/teenused/hindamine?kee=info'))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    }
  })

  it('does not fire the legacy 301 on an unmapped host', () => {
    const response = middleware(requestFor('erametsad-preview.example.workers.dev', '/metsateatise-juhend'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('serves portal-style paths on unmapped hostnames without redirecting', () => {
    const response = middleware(requestFor('erametsad-preview.example.workers.dev', '/oksjon/9?foo=bar'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })

  it('treats a missing host header as unmapped and passes through', () => {
    const request = new NextRequest('http://localhost:3000/avaleht')
    const response = middleware(request)

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })
})

describe('middleware portal paths on the default host', () => {
  it('keeps redirecting portal contract and auth pages to the portal host', () => {
    const response = middleware(requestFor(DEFAULT_HOSTNAME, '/lepingud/raamleping?kehtiv=1'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      `https://${PORTAL_HOSTNAME}/lepingud/raamleping?kehtiv=1`,
    )
  })

  it('serves the portal contract list on the portal host untouched', () => {
    const response = middleware(requestFor(PORTAL_HOSTNAME, '/lepingud'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })
})
