import { describe, expect, it } from 'vitest'

import {
  DEFAULT_HOSTNAME,
  PORTAL_HOSTNAME,
  normalizeHostname,
  resolveHostArea,
  resolveHostRedirect,
  resolvePathArea,
} from '@/lib/routing/host-areas'

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

  it('returns null for every other hostname', () => {
    expect(resolveHostArea('api.erametsad.ww0.dev')).toBeNull()
    expect(resolveHostArea('admin.erametsad.ww0.dev')).toBeNull()
    expect(resolveHostArea('eametsad-api.example.workers.dev')).toBeNull()
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
})

describe('resolveHostRedirect', () => {
  it('no-ops for every unmapped hostname', () => {
    expect(resolveHostRedirect('api.erametsad.ww0.dev', '/login')).toBeNull()
    expect(resolveHostRedirect('admin.erametsad.ww0.dev', '/admin')).toBeNull()
    expect(resolveHostRedirect('eametsad-api.example.workers.dev', '/')).toBeNull()
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

  it('redirects portal paths from the default host, preserving path and query', () => {
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/')).toBe(`https://${PORTAL_HOSTNAME}/`)
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/login')).toBe(
      `https://${PORTAL_HOSTNAME}/login`,
    )
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/oksjon/9', '?ref=list&page=2')).toBe(
      `https://${PORTAL_HOSTNAME}/oksjon/9?ref=list&page=2`,
    )
  })

  it('no-ops for default-host app and shared paths', () => {
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/admin')).toBeNull()
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/api/v1/auth/login')).toBeNull()
    expect(resolveHostRedirect(DEFAULT_HOSTNAME, '/_next/static/chunk.js')).toBeNull()
  })
})
