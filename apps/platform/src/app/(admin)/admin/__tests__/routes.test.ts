import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { requireAdminRepositories } from '../../_lib/admin'
import {
  ADMIN_MODULES,
  can,
  isStaffRole,
  type AdminModuleId,
  type AdminPermission,
} from '../../_lib/permissions'
import ContentSettingsRedirectPage from '../content/settings/page'
import LeadsRequestsRedirectPage from '../leads/requests/page'
import RequestsRedirectPage from '../requests/page'
import PartnersRedirectPage from '../requests/partners/page'

const { RedirectError } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(
      readonly url: string,
    ) {
      super(`NEXT_REDIRECT:${url}`)
      this.name = 'RedirectError'
    }
  }
  return { RedirectError }
})

const state = vi.hoisted((): {
  cookies: Record<string, string | undefined>
  payload: { userId: string; role: string } | null
} => ({
  cookies: {},
  payload: null,
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url)
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (name: string) =>
      state.cookies[name] !== undefined ? { value: state.cookies[name] } : undefined,
  })),
  // No x-admin-base header: the admin base stays /admin in tests, matching
  // the default host URL space.
  headers: vi.fn(() => ({
    get: () => null,
  })),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn((token: string | undefined) =>
    token && state.payload ? state.payload : null,
  ),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn((context: unknown) => Promise.resolve({ guardContext: context })),
  sessionGuardContext: (payload: unknown) => payload,
}))

const ADMIN_ROUTE_ROOT = fileURLToPath(new URL('..', import.meta.url))
const ADMIN_TREE_ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Base-relative registry href -> page.tsx path under (admin)/admin. */
function pageFileFor(href: string): string {
  const segment = href === '/' ? '' : href.replace(/^\//, '')
  const parts = segment === '' ? [] : segment.split('/')
  return [...parts, 'page.tsx'].join('/')
}

// Task 13.3 landed the /admin/statistics page, so every registry href now
// resolves to a real page file and the gap set stays empty.
const KNOWN_ROUTE_GAPS: ReadonlySet<AdminModuleId> = new Set()

/** Mirror of the private MODULE_READ_PERMISSION map in _lib/permissions. */
const MODULE_READ_PERMISSION: Record<AdminModuleId, AdminPermission> = {
  workspace: 'workspace:view',
  auctions: 'auctions:read',
  bids: 'bids:read',
  'sealed-opening': 'sealed:read',
  users: 'users:read',
  companies: 'companies:read',
  contracts: 'contracts:read',
  leads: 'leads:read',
  inquiries: 'inquiries:read',
  content: 'content:read',
  statistics: 'statistics:read',
  settings: 'settings:read',
  'audit-log': 'audit:read',
}

function readableHrefs(role: Parameters<typeof can>[0]): string[] {
  return ADMIN_MODULES.filter((module) => can(role, MODULE_READ_PERMISSION[module.id])).map(
    (module) => module.href,
  )
}

async function redirectTarget(run: () => unknown): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof RedirectError) return error.url
    throw error
  }
  throw new Error('expected the component to redirect')
}

describe('admin module routes', () => {
  it('resolves every registry href to an existing page file', () => {
    const routable = ADMIN_MODULES.filter((module) => !KNOWN_ROUTE_GAPS.has(module.id))
    expect(routable).toHaveLength(13)

    for (const module of routable) {
      const file = pageFileFor(module.href)
      expect(
        existsSync(`${ADMIN_ROUTE_ROOT}${file}`),
        `${module.href} must resolve to (admin)/admin/${file}`,
      ).toBe(true)
    }
  })

  it('keeps the route gap set empty with statistics routed', () => {
    expect(KNOWN_ROUTE_GAPS.size).toBe(0)
    expect(ADMIN_MODULES.map((module) => module.id)).toContain('statistics')
  })

  it('gives the 13 modules unique admin-scoped hrefs', () => {
    expect(ADMIN_MODULES).toHaveLength(13)
    const hrefs = ADMIN_MODULES.map((module) => module.href)
    expect(new Set(hrefs).size).toBe(13)
    for (const href of hrefs) {
      expect(href === '/' || href.startsWith('/'), `${href} is base-relative`).toBe(true)
    }
  })
})

describe('base-relative href convention', () => {
  it('keeps every href in the (admin) tree free of the /admin prefix', () => {
    // Links inside the admin tree carry base-relative paths; the admin base
    // provider joins the /admin prefix on hosts that serve it there. A
    // hard-coded /admin href would double the prefix on the admin host.
    const violations: string[] = []
    const visit = (dir: string): void => {
      for (const entry of existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []) {
        const full = `${dir}/${entry.name}`
        if (entry.isDirectory()) {
          if (entry.name === '__tests__' || entry.name === 'node_modules') continue
          visit(full)
          continue
        }
        if (!entry.name.endsWith('.tsx')) continue
        const content = readFileSync(full, 'utf8')
        if (/href=\{?["'`]\/admin(\/|["'`])/.test(content) || /location\.href = ["'`]\/admin/.test(content)) {
          violations.push(full)
        }
      }
    }
    visit(ADMIN_TREE_ROOT)
    expect(violations, `hard-coded /admin hrefs in: ${violations.join(', ')}`).toEqual([])
  })
})

describe('legacy admin path redirects', () => {
  const noParams = Promise.resolve<Record<string, string | string[] | undefined>>({})

  it('sends /admin/leads/requests to /admin/companies', async () => {
    await expect(redirectTarget(() => LeadsRequestsRedirectPage())).resolves.toBe('/admin/companies')
  })

  it('sends /admin/requests to /admin/inquiries', async () => {
    await expect(
      redirectTarget(() => RequestsRedirectPage({ searchParams: noParams })),
    ).resolves.toBe('/admin/inquiries')
  })

  it('keeps the error and detail queries when redirecting /admin/requests', async () => {
    await expect(
      redirectTarget(() =>
        RequestsRedirectPage({
          searchParams: Promise.resolve({ viga: 'Päringut ei leitud.', detail: 'req-1' }),
        }),
      ),
    ).resolves.toBe('/admin/inquiries?viga=P%C3%A4ringut+ei+leitud.&detail=req-1')
  })

  it('sends /admin/requests/partners to /admin/inquiries/partners', async () => {
    await expect(
      redirectTarget(() => PartnersRedirectPage({ searchParams: noParams })),
    ).resolves.toBe('/admin/inquiries/partners')
  })

  it('keeps the notice and edit queries when redirecting /admin/requests/partners', async () => {
    await expect(
      redirectTarget(() =>
        PartnersRedirectPage({
          searchParams: Promise.resolve({ teade: 'Partner loodud.', muuda: 'p-1' }),
        }),
      ),
    ).resolves.toBe('/admin/inquiries/partners?teade=Partner+loodud.&muuda=p-1')
  })

  it('sends /admin/content/settings to /admin/settings', async () => {
    await expect(redirectTarget(() => ContentSettingsRedirectPage())).resolves.toBe('/admin/settings')
  })
})

describe('per-module role gating', () => {
  it('maps every module id to a read permission', () => {
    for (const module of ADMIN_MODULES) {
      expect(MODULE_READ_PERMISSION[module.id], `${module.id} read permission`).toBeDefined()
    }
  })

  it('admits admin and superadmin to all 13 module routes', () => {
    const allHrefs = ADMIN_MODULES.map((module) => module.href)
    for (const role of ['admin', 'superadmin'] as const) {
      expect(readableHrefs(role)).toEqual(allHrefs)
    }
  })

  it('gates governance module routes away from the specialist', () => {
    expect(readableHrefs('specialist')).toEqual([
      '/',
      '/auctions',
      '/bids',
      '/leads',
      '/inquiries',
      '/statistics',
    ])
  })

  it('gates every read-write module route away from the seller', () => {
    expect(readableHrefs('seller')).toEqual(['/', '/auctions', '/bids'])
  })
})

describe('requireAdminRepositories entry gate', () => {
  beforeEach(() => {
    state.cookies.access_token = undefined
    state.payload = null
  })

  it('redirects anonymous visitors to /login', async () => {
    await expect(redirectTarget(() => requireAdminRepositories())).resolves.toBe('/login')
  })

  it('redirects non-staff token roles to /login', async () => {
    state.cookies.access_token = 'token-1'
    state.payload = { userId: 'user-1', role: 'company' }
    await expect(redirectTarget(() => requireAdminRepositories())).resolves.toBe('/login')
  })

  it('binds the session and guard context for a staff role', async () => {
    state.cookies.access_token = 'token-1'
    state.payload = { userId: 'admin-1', role: 'specialist' }

    const { session, repositories } = await requireAdminRepositories()

    expect(session).toEqual({ userId: 'admin-1', role: 'specialist' })
    expect(isStaffRole(session.role)).toBe(true)
    expect(repositories).toEqual({
      guardContext: { userId: 'admin-1', role: 'specialist' },
    })
  })
})
