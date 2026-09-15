import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { ADMIN_HOSTNAME, API_HOSTNAME, DEFAULT_HOSTNAME, PORTAL_HOSTNAME } from '@/lib/routing/host-areas'
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
    for (const host of ['stats.erametsad.ww0.dev', 'erametsad-api.example.workers.dev', 'localhost:3000']) {
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

describe('middleware admin host routing', () => {
  it('rewrites / to the admin landing, preserving query, with the empty base header', () => {
    const response = middleware(requestFor(ADMIN_HOSTNAME, '/?kampaania=x'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3000/admin?kampaania=x',
    )
    // x-admin-base rides the rewritten REQUEST to the app (empty base on
    // this host), so it never appears as a response header.
  })

  it('rewrites clean admin paths into the /admin route space', () => {
    const response = middleware(requestFor(ADMIN_HOSTNAME, '/auctions?tab=type'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBe(
      'http://localhost:3000/admin/auctions?tab=type',
    )
  })

  it('canonicalizes /admin URLs to the prefix-free form with 308', () => {
    const response = middleware(requestFor(ADMIN_HOSTNAME, '/admin/auctions?tab=type'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`https://${ADMIN_HOSTNAME}/auctions?tab=type`)
  })

  it('keeps the auth flow same-host without redirecting or rewriting', () => {
    for (const pathAndQuery of ['/login?next=%2Fadmin', '/reset-password?token=abc']) {
      const response = middleware(requestFor(ADMIN_HOSTNAME, pathAndQuery))

      expect(response.status).toBe(200)
      expect(response.headers.get('location')).toBeNull()
      expect(response.headers.get('x-middleware-rewrite')).toBeNull()
    }
  })

  it('redirects portal paths to the portal host with 308', () => {
    const response = middleware(requestFor(ADMIN_HOSTNAME, '/oksjon/9?ref=list'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`https://${PORTAL_HOSTNAME}/oksjon/9?ref=list`)
  })

  it('redirects marketing paths to the default host with 308', () => {
    const response = middleware(requestFor(ADMIN_HOSTNAME, '/teenused/hindamine?kee=info'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(
      `https://${DEFAULT_HOSTNAME}/teenused/hindamine?kee=info`,
    )
  })

  it('keeps shared API paths same-host', () => {
    const response = middleware(requestFor(ADMIN_HOSTNAME, '/api/v1/auctions'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('middleware api host routing', () => {
  it('redirects stray page paths to the default host with 308', () => {
    const response = middleware(requestFor(API_HOSTNAME, '/admin/auctions?tab=type'))

    expect(response.status).toBe(308)
    expect(response.headers.get('location')).toBe(`https://${DEFAULT_HOSTNAME}/admin/auctions?tab=type`)
  })

  it('serves api routes same-host without rewriting', () => {
    const response = middleware(requestFor(API_HOSTNAME, '/api/v1/auctions'))

    expect(response.status).toBe(200)
    expect(response.headers.get('location')).toBeNull()
    expect(response.headers.get('x-middleware-rewrite')).toBeNull()
  })
})

describe('middleware api cors allowlist', () => {
  it('answers same-site subdomain origins with credentialed CORS', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auctions', {
      headers: {
        host: API_HOSTNAME,
        origin: `https://${ADMIN_HOSTNAME}`,
      },
    })
    const response = middleware(request)

    expect(response.headers.get('access-control-allow-origin')).toBe(`https://${ADMIN_HOSTNAME}`)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('vary')).toContain('Origin')
  })

  it('answers localhost origins (local dev)', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auctions', {
      headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
    })
    const response = middleware(request)

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000')
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('allows the workers.dev preview origin as an exact entry', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auctions', {
      headers: {
        host: API_HOSTNAME,
        origin: 'https://erametsad-api.siim-liimand.workers.dev',
      },
    })
    const response = middleware(request)

    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://erametsad-api.siim-liimand.workers.dev',
    )
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
  })

  it('gives foreign origins no CORS headers at all', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auctions', {
      headers: { host: API_HOSTNAME, origin: 'https://evil.example.com' },
    })
    const response = middleware(request)

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
    expect(response.headers.get('access-control-allow-credentials')).toBeNull()
  })

  it('answers credentialed preflights with 204 and the allowed methods', () => {
    const request = new NextRequest('http://localhost:3000/api/v1/auth/login', {
      method: 'OPTIONS',
      headers: {
        host: API_HOSTNAME,
        origin: `https://${DEFAULT_HOSTNAME}`,
        'access-control-request-method': 'POST',
      },
    })
    const response = middleware(request)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(`https://${DEFAULT_HOSTNAME}`)
    expect(response.headers.get('access-control-allow-credentials')).toBe('true')
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
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

  it('serves the submission wizard on the portal host and 308s it from the default host', () => {
    const portalResponse = middleware(requestFor(PORTAL_HOSTNAME, '/user/objects/paku'))

    expect(portalResponse.status).toBe(200)
    expect(portalResponse.headers.get('location')).toBeNull()
    expect(portalResponse.headers.get('x-middleware-rewrite')).toBeNull()

    const defaultResponse = middleware(requestFor(DEFAULT_HOSTNAME, '/user/objects/paku?ref=cta'))

    expect(defaultResponse.status).toBe(308)
    expect(defaultResponse.headers.get('location')).toBe(
      `https://${PORTAL_HOSTNAME}/user/objects/paku?ref=cta`,
    )
  })
})
