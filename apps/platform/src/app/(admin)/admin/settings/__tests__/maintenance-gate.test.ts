import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { middleware } from '@/middleware'

const DEFAULT_HOST = 'erametsad.ww0.dev'
const PORTAL_HOST = 'oksjonid.erametsad.ww0.dev'

const mocks = vi.hoisted(() => ({
  dbQuery: vi.fn(),
  verifyAdminAccessToken: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: { query: mocks.dbQuery },
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAdminAccessToken: mocks.verifyAdminAccessToken,
}))

interface RequestOptions {
  host?: string
  token?: string
}

function makeRequest(pathname: string, options: RequestOptions = {}): NextRequest {
  const host = options.host ?? DEFAULT_HOST
  const headers: Record<string, string> = { host }
  if (options.token !== undefined) {
    headers.cookie = `access_token=${options.token}`
  }
  return new NextRequest(`https://${host}${pathname}`, { headers })
}

// middleware() is synchronous and reads a module cache refreshed in the
// background. One throwaway pass schedules the refresh; draining the
// microtask queue settles the dynamic import and the promise chain so the
// cache holds the flag under test before the real assertions run.
async function drainMicrotasks(): Promise<void> {
  for (let tick = 0; tick < 50; tick += 1) {
    await Promise.resolve()
  }
}

async function applyMaintenanceFlag(enabled: boolean): Promise<void> {
  mocks.dbQuery.mockResolvedValue({
    results: [{ maintenance_enabled: enabled ? 1 : 0 }],
  })
  middleware(makeRequest('/avaleht'))
  await drainMicrotasks()
}

describe('maintenance gate (middleware)', () => {
  // One clock for the whole file: the gate's module cache carries a 2s TTL,
  // and reinstalling fake timers per test would reset it to real time and
  // never expire the previous test's cached flag.
  beforeAll(() => {
    vi.useFakeTimers()
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    mocks.dbQuery.mockResolvedValue({ results: [{ maintenance_enabled: 0 }] })
    mocks.verifyAdminAccessToken.mockImplementation((token: string) =>
      token === 'admin-token' ? { userId: 'admin-1', role: 'admin' } : null,
    )
    // Expire whatever the previous test left in the module cache so the
    // next background refresh reads the flag this test installed.
    vi.advanceTimersByTime(3000)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('blocks public pages with the maintenance response while maintenance is on', async () => {
    await applyMaintenanceFlag(true)

    const response = middleware(makeRequest('/avaleht'))

    expect(response.status).toBe(503)
    expect(response.headers.get('Retry-After')).toBe('300')
    expect(response.headers.get('Content-Type')).toContain('text/html')
    expect(await response.text()).toContain('Hooldusrežiim')
  })

  it('blocks public portal pages too while maintenance is on', async () => {
    await applyMaintenanceFlag(true)

    const response = middleware(makeRequest('/ajalugu', { host: PORTAL_HOST }))

    expect(response.status).toBe(503)
  })

  it('lets an admin session through while maintenance is on', async () => {
    await applyMaintenanceFlag(true)

    const response = middleware(makeRequest('/avaleht', { token: 'admin-token' }))

    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('Hooldusrežiim')
  })

  it('keeps blocking a token that does not verify as admin', async () => {
    await applyMaintenanceFlag(true)

    const response = middleware(makeRequest('/avaleht', { token: 'junk' }))

    expect(response.status).toBe(503)
  })

  it('treats a failing token check as an anonymous visit', async () => {
    await applyMaintenanceFlag(true)
    mocks.verifyAdminAccessToken.mockImplementation(() => {
      throw new Error('verify exploded')
    })

    const response = middleware(makeRequest('/avaleht', { token: 'admin-token' }))

    expect(response.status).toBe(503)
  })

  it('passes public pages through while maintenance is off', async () => {
    await applyMaintenanceFlag(false)

    const response = middleware(makeRequest('/avaleht'))

    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('Hooldusrežiim')
  })

  it('keeps the admin UI, shared statics, and API available while maintenance is on', async () => {
    await applyMaintenanceFlag(true)

    for (const pathname of ['/admin', '/admin/settings', '/favicon.ico', '/api/v1/auctions']) {
      const response = middleware(makeRequest(pathname))
      expect(response.status, pathname).toBe(200)
      expect(await response.text(), pathname).not.toContain('Hooldusrežiim')
    }
  })

  it('keeps the login flow reachable on the portal host while maintenance is on', async () => {
    await applyMaintenanceFlag(true)

    for (const pathname of ['/login', '/reset-password']) {
      const response = middleware(makeRequest(pathname, { host: PORTAL_HOST }))
      expect(response.status, pathname).toBe(200)
    }
  })

  it('never engages on unmapped hosts', async () => {
    await applyMaintenanceFlag(true)

    const response = middleware(
      makeRequest('/avaleht', { host: 'localhost:3000' }),
    )

    expect(response.status).toBe(200)
  })
})
