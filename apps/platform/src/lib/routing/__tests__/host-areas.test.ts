import { describe, expect, it } from 'vitest'

import { ADMIN_HOSTNAME, API_HOSTNAME, DEFAULT_HOSTNAME, PORTAL_HOSTNAME, normalizeHostname, resolveAdminHostRewrite, resolveApiHostRedirect, resolveDefaultHostRewrite, resolveHostArea, resolveHostRedirect, resolveLegacyPathRedirect, resolvePathArea } from '@/lib/routing/host-areas'

describe('normalizeHostname', () => {
  it('returns null for a missing header', () => {
    expect(normalizeHostname(null)).toBeNull()
    expect(normalizeHostname('')).toBeNull()
  })

  it('lowercases and trims the header', () => {
    expect(normalizeHostname('  OKSJONID.Erametsad.ww0.dev ')).toBe(PORTAL_HOSTNAME)
  })

  it('strips the port', () => {
    expect(normalizeHostname('localhost:3000')).toBe('localhost')
    expect(normalizeHostname('erametsad.ww0.dev:8443')).toBe(DEFAULT_HOSTNAME)
  })
})

describe('resolveHostArea', () => {
  it('maps the portal hostname to the portal area', () => {
    expect(resolveHostArea('oksjonid.erametsad.ww0.dev')).toBe('portal')
  })

  it('maps the default hostname to the default area', () => {
    expect(resolveHostArea('erametsad.ww0.dev')).toBe('default')
  })

  it('maps the admin hostname to the admin area', () => {
    expect(resolveHostArea(ADMIN_HOSTNAME)).toBe('admin')
  })

  it('returns null for every other hostname', () => {
    expect(resolveHostArea('api.erametsad.ww0.dev')).toBeNull()
    expect(resolveHostArea('erametsad-api.example.workers.dev')).toBeNull()
    expect(resolveHostArea('localhost')).toBeNull()
    expect(resolveHostArea(null)).toBeNull()
  })
})

describe('resolvePathArea', () => {
  it('classifies shared paths', () => {
    expect(resolvePathArea('/api')).toBe('shared')
    expect(resolvePathArea('/api/v1/auctions')).toBe('shared')
    expect(resolvePathArea('/api/auth/session')).toBe('shared')
    expect(resolvePathArea('/_next/static/chunk.js')).toBe('shared')
    expect(resolvePathArea('/favicon.ico')).toBe('shared')
    expect(resolvePathArea('/robots.txt')).toBe('shared')
  })

  it('classifies app paths', () => {
    expect(resolvePathArea('/admin')).toBe('app')
    expect(resolvePathArea('/admin/auctions')).toBe('app')
    expect(resolvePathArea('/styleguide')).toBe('app')
    expect(resolvePathArea('/styleguide/colors')).toBe('app')
  })

  it('classifies portal paths, including lookalike prefixes', () => {
    expect(resolvePathArea('/')).toBe('portal')
    expect(resolvePathArea('/login')).toBe('portal')
    expect(resolvePathArea('/oksjon/123')).toBe('portal')
    expect(resolvePathArea('/user/bids')).toBe('portal')
    expect(resolvePathArea('/lepingud/raamleping')).toBe('portal')
    expect(resolvePathArea('/administrator')).toBe('portal')
  })

  it('classifies marketing paths', () => {
    expect(resolvePathArea('/teenused')).toBe('marketing')
    expect(resolvePathArea('/teenused/hindamine')).toBe('marketing')
    expect(resolvePathArea('/kkk')).toBe('marketing')
    expect(resolvePathArea('/meist')).toBe('marketing')
    expect(resolvePathArea('/artiklid/metsandus')).toBe('marketing')
    expect(resolvePathArea('/metsateatis')).toBe('marketing')
    expect(resolvePathArea('/hindamisaktid')).toBe('marketing')
    expect(resolvePathArea('/kiiroksjon')).toBe('marketing')
    expect(resolvePathArea('/kontakt')).toBe('marketing')
    expect(resolvePathArea('/avaleht')).toBe('marketing')
    expect(resolvePathArea('/lepingud/dokumendid')).toBe('marketing')
    expect(resolvePathArea('/metsateatise-juhend')).toBe('marketing')
  })

  it('classifies unlisted paths by host', () => {
    expect(resolvePathArea('/suvaline', 'default')).toBe('marketing')
    expect(resolvePathArea('/', 'default')).toBe('marketing')
    expect(resolvePathArea('/lepingud', 'default')).toBe('marketing')
    expect(resolvePathArea('/suvaline', 'portal')).toBe('portal')
    expect(resolvePathArea('/lepingud', 'portal')).toBe('portal')
  })
})

describe('resolveHostRedirect', () => {
  it('no-ops for every unmapped hostname', () => {
    expect(resolveHostRedirect('api.erametsad.ww0.dev', '/login')).toBeNull()
    expect(resolveHostRedirect('erametsad-api.example.workers.dev', '/')).toBeNull()
    expect(resolveHostRedirect('localhost:3000', '/oksjon/1')).toBeNull()
    expect(resolveHostRedirect(null, '/login')).toBeNull()
  })

  it('serves portal paths on the portal host without redirecting', () => {
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/')).toBeNull()
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/oksjon/9', '?ref=list')).toBeNull()
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/api/v1/auctions')).toBeNull()
  })

  it('redirects app paths from the portal host to the default host', () => {
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/admin/auctions')).toBe(
      `https://${DEFAULT_HOSTNAME}/admin/auctions`,
    )
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/styleguide', '?tab=type')).toBe(
      `https://${DEFAULT_HOSTNAME}/styleguide?tab=type`,
    )
  })

  it('redirects marketing paths from the portal host to the default host', () => {
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/teenused/hindamine', '?kee=info')).toBe(
      `https://${DEFAULT_HOSTNAME}/teenused/hindamine?kee=info`,
    )
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/kkk')).toBe(`https://${DEFAULT_HOSTNAME}/kkk`)
  })

  it('normalizes the rewrite targets on the portal host', () => {
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/avaleht', '?kampaania=kevad')).toBe(
      `https://${DEFAULT_HOSTNAME}/?kampaania=kevad`,
    )
    expect(resolveHostRedirect(PORTAL_HOSTNAME, '/lepingud/dokumendid', '?leht=2')).toBe(
      `https://${DEFAULT_HOSTNAME}/lepingud?leht=2`,
    )
  })

  it('redirects portal paths from the default host, preserving path and query', () => {
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/login')).toBe(
      `https://${PORTAL_HOSTNAME}/login`,
    )
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/oksjon/9', '?ref=list&page=2')).toBe(
      `https://${PORTAL_HOSTNAME}/oksjon/9?ref=list&page=2`,
    )
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/lepingud/raamleping')).toBe(
      `https://${PORTAL_HOSTNAME}/lepingud/raamleping`,
    )
  })

  it('leaves the rewrite sources unredirected on the default host', () => {
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/')).toBeNull()
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/lepingud', '?sort=uus')).toBeNull()
  })

  it('no-ops for default-host app and shared paths', () => {
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/admin')).toBeNull()
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/api/v1/auth/login')).toBeNull()
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/_next/static/chunk.js')).toBeNull()
  })

  it('canonicalizes /admin URLs on the admin host to the prefix-free form', () => {
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/admin')).toBe(`https://${ADMIN_HOSTNAME}/`)
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/admin/auctions', '?tab=type')).toBe(
      `https://${ADMIN_HOSTNAME}/auctions?tab=type`,
    )
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/admin/users/u-1')).toBe(
      `https://${ADMIN_HOSTNAME}/users/u-1`,
    )
  })

  it('keeps the auth flow same-host on the admin host', () => {
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/login', '?next=%2Fadmin')).toBeNull()
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/reset-password', '?token=abc')).toBeNull()
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/reset-password/steps')).toBeNull()
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/select-profile')).toBeNull()
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/update-password')).toBeNull()
  })

  it('keeps shared paths same-host on the admin host', () => {
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/api/v1/auctions')).toBeNull()
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/_next/static/chunk.js')).toBeNull()
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/styleguide')).toBeNull()
  })

  it('redirects portal paths from the admin host to the portal host', () => {
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/oksjon/9', '?ref=list')).toBe(
      `https://${PORTAL_HOSTNAME}/oksjon/9?ref=list`,
    )
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/lepingud')).toBe(
      `https://${PORTAL_HOSTNAME}/lepingud`,
    )
  })

  it('redirects marketing paths from the admin host to the default host', () => {
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/teenused/hindamine', '?kee=info')).toBe(
      `https://${DEFAULT_HOSTNAME}/teenused/hindamine?kee=info`,
    )
    expect(resolveHostRedirect(ADMIN_HOSTNAME, '/kkk')).toBe(`https://${DEFAULT_HOSTNAME}/kkk`)
  })
})

describe('resolveLegacyPathRedirect', () => {
  it('301s the legacy guide path to the canonical default-host path from every mapped host', () => {
    expect(resolveLegacyPathRedirect(DEFAULT_HOSTNAME, '/metsateatise-juhend', '?allikas=vana')).toBe(
      `https://${DEFAULT_HOSTNAME}/metsateatis?allikas=vana`,
    )
    expect(resolveLegacyPathRedirect(PORTAL_HOSTNAME, '/metsateatise-juhend')).toBe(
      `https://${DEFAULT_HOSTNAME}/metsateatis`,
    )
    expect(resolveLegacyPathRedirect(ADMIN_HOSTNAME, '/metsateatise-juhend')).toBe(
      `https://${DEFAULT_HOSTNAME}/metsateatis`,
    )
  })

  it('no-ops for other paths and unmapped hosts', () => {
    expect(resolveLegacyPathRedirect(DEFAULT_HOSTNAME, '/metsateatis')).toBeNull()
    expect(resolveLegacyPathRedirect(null, '/metsateatise-juhend')).toBeNull()
    expect(resolveLegacyPathRedirect('localhost', '/metsateatise-juhend')).toBeNull()
  })
})

describe('resolveApiHostRedirect', () => {
  it('sends stray page paths to the default host', () => {
    expect(resolveApiHostRedirect(API_HOSTNAME, '/admin/auctions', '?tab=type')).toBe(
      'https://erametsad.ww0.dev/admin/auctions?tab=type',
    )
    expect(resolveApiHostRedirect(API_HOSTNAME, '/oksjon/9')).toBe(
      'https://erametsad.ww0.dev/oksjon/9',
    )
  })

  it('lets api routes through untouched', () => {
    expect(resolveApiHostRedirect(API_HOSTNAME, '/api/v1/auctions')).toBeNull()
    expect(resolveApiHostRedirect(API_HOSTNAME, '/api/health')).toBeNull()
  })

  it('ignores other hosts', () => {
    expect(resolveApiHostRedirect(ADMIN_HOSTNAME, '/admin/auctions')).toBeNull()
    expect(resolveApiHostRedirect('example.com', '/x')).toBeNull()
    expect(resolveApiHostRedirect(null, '/x')).toBeNull()
  })
})

describe('resolveAdminHostRewrite', () => {
  it('rewrites / to the admin landing on the admin host', () => {
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/')).toBe('/admin')
  })

  it('rewrites unlisted root paths into the admin route space', () => {
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/auctions')).toBe('/admin/auctions')
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/users/u-1')).toBe('/admin/users/u-1')
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/styleguide/colors')).toBeNull()
  })

  it('keeps auth, portal, marketing, and shared paths unrewritten', () => {
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/login')).toBeNull()
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/reset-password/steps')).toBeNull()
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/oksjon/9')).toBeNull()
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/teenused')).toBeNull()
    expect(resolveAdminHostRewrite(ADMIN_HOSTNAME, '/api/v1/auctions')).toBeNull()
  })

  it('no-ops for other hosts and unmapped hosts', () => {
    expect(resolveAdminHostRewrite(DEFAULT_HOSTNAME, '/')).toBeNull()
    expect(resolveAdminHostRewrite(PORTAL_HOSTNAME, '/auctions')).toBeNull()
    expect(resolveAdminHostRewrite(null, '/auctions')).toBeNull()
  })
})

describe('resolveDefaultHostRewrite', () => {
  it('maps / and /lepingud to the marketing routes on the default host', () => {
    expect(resolveDefaultHostRewrite(DEFAULT_HOSTNAME, '/')).toBe('/avaleht')
    expect(resolveDefaultHostRewrite(DEFAULT_HOSTNAME, '/lepingud')).toBe('/lepingud/dokumendid')
  })

  it('no-ops for other paths, other hosts, and unmapped hosts', () => {
    expect(resolveDefaultHostRewrite(DEFAULT_HOSTNAME, '/avaleht')).toBeNull()
    expect(resolveDefaultHostRewrite(DEFAULT_HOSTNAME, '/lepingud/dokumendid')).toBeNull()
    expect(resolveDefaultHostRewrite(PORTAL_HOSTNAME, '/')).toBeNull()
    expect(resolveDefaultHostRewrite(PORTAL_HOSTNAME, '/lepingud')).toBeNull()
    expect(resolveDefaultHostRewrite(null, '/')).toBeNull()
  })
})
