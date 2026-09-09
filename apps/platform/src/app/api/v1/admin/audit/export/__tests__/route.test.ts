import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted((): {
  token: string | undefined
  payload: { userId: string; role: string } | null
  repositories: unknown
} => ({
  token: 'token.super',
  payload: { userId: 'super-1', role: 'superadmin' },
  repositories: null,
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url)
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (): { value: string | undefined } => ({ value: state.token }),
  })),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(() => state.payload),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(() => state.repositories),
  sessionGuardContext: (payload: unknown) => payload,
}))

class RedirectError extends Error {
  constructor(
    readonly url: string,
  ) {
    super(`NEXT_REDIRECT:${url}`)
    this.name = 'RedirectError'
  }
}

import { GET as csvExportRoute } from '../csv/route'
import { GET as jsonExportRoute } from '../json/route'

import type { CoreRepositories } from '@/lib/data/repositories'

const AUDIT_DOC = {
  id: 'audit-1',
  createdAt: '2026-09-08T09:30:00.000Z',
  actorId: 'admin-1',
  action: 'lead.status',
  entityType: 'lead',
  entityId: 'lead-1',
  before: { status: 'new' },
  after: { status: 'kontakteeritud' },
  prevHash: 'prev-hash',
  hash: 'entry-hash',
}

const STAFF_USER = { id: 'admin-1', name: 'Asta Admin', email: 'asta@naide.ee' }

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const find = vi.fn((args: { collection: string }) => {
    if (args.collection === 'audit-entry') return Promise.resolve({ docs: [AUDIT_DOC] })
    if (args.collection === 'users') return Promise.resolve({ docs: [STAFF_USER] })
    return Promise.resolve({ docs: [] })
  })
  const repositories = {
    find,
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: 'audit-new', ...args.data })
    }),
  }
  return { repositories: repositories as unknown as CoreRepositories, creates, find }
}

function useSession(
  payload: { userId: string; role: string } | null,
  token: string | undefined = 'token.x',
) {
  state.payload = payload
  state.token = token
  const exported = makeRepos()
  state.repositories = exported.repositories
  return exported
}

function exportRequest(query = ''): Request {
  return new Request(
    query === ''
      ? 'http://localhost:3000/api/v1/admin/audit/export/csv'
      : `http://localhost:3000/api/v1/admin/audit/export/csv?${query}`,
  )
}

async function redirectTarget(run: () => unknown): Promise<string> {
  try {
    await run()
  } catch (error) {
    if (error instanceof RedirectError) return error.url
    throw error
  }
  throw new Error('expected the route to redirect')
}

const EXPORT_ROUTES = [
  { format: 'csv', GET: csvExportRoute, contentType: 'text/csv; charset=utf-8' },
  { format: 'json', GET: jsonExportRoute, contentType: 'application/json; charset=utf-8' },
] as const

beforeEach(() => {
  state.token = 'token.super'
  state.payload = { userId: 'super-1', role: 'superadmin' }
  state.repositories = null
})

describe('GET /api/v1/admin/audit/export/[format] (superadmin gate)', () => {
  for (const route of EXPORT_ROUTES) {
    it(`[${route.format}] serves a superadmin export and writes the audit entry`, async () => {
      const exported = useSession({ userId: 'super-1', role: 'superadmin' })

      const response = await route.GET(exportRequest())

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe(route.contentType)
      expect(response.headers.get('content-disposition')).toContain(`auditlogi-`)
      expect(exported.creates).toHaveLength(1)
      expect(exported.creates[0]?.collection).toBe('audit-entry')
      expect(exported.creates[0]?.data).toMatchObject({
        actorId: 'super-1',
        action: 'audit.export',
        entityType: 'audit-entry',
        entityId: 'bulk',
        after: { format: route.format, rowCount: 1 },
      })
    })

    it(`[${route.format}] answers 403 to an admin and reads nothing`, async () => {
      const exported = useSession({ userId: 'admin-1', role: 'admin' })

      const response = await route.GET(exportRequest())

      expect(response.status).toBe(403)
      expect(exported.creates).toEqual([])
      expect(exported.find).not.toHaveBeenCalled()
    })

    it(`[${route.format}] answers 403 to a specialist`, async () => {
      const exported = useSession({ userId: 'spec-1', role: 'specialist' })

      const response = await route.GET(exportRequest())

      expect(response.status).toBe(403)
      expect(exported.creates).toEqual([])
    })

    it(`[${route.format}] answers 403 to a seller`, async () => {
      const exported = useSession({ userId: 'seller-1', role: 'seller' })

      const response = await route.GET(exportRequest())

      expect(response.status).toBe(403)
      expect(exported.creates).toEqual([])
    })

    it(`[${route.format}] sends an anonymous visitor to the login page`, async () => {
      useSession(null, undefined)

      await expect(redirectTarget(() => route.GET(exportRequest()))).resolves.toBe('/login')
    })

    it(`[${route.format}] carries the filter query into the audit entry`, async () => {
      const exported = useSession({ userId: 'super-1', role: 'superadmin' })

      const response = await route.GET(
        exportRequest('group=lead&from=2026-09-01&to=2026-09-09'),
      )

      expect(response.status).toBe(200)
      expect(exported.creates[0]?.data).toMatchObject({
        after: {
          format: route.format,
          filters: {
            group: 'lead',
            from: '2026-08-31T22:00:00.000Z',
            to: '2026-09-09T20:59:59.000Z',
          },
        },
      })
    })
  }

  it('exports the csv body with the documented header row', async () => {
    useSession({ userId: 'super-1', role: 'superadmin' })

    const response = await csvExportRoute(exportRequest())

    const text = await response.text()
    const header = text.split('\r\n')[0] ?? ''
    expect(header.split(';')).toEqual([
      'ID',
      'Aeg',
      'Tegija',
      'Roll',
      'Tegevus',
      'Rühm',
      'Olem',
      'Olemi ID',
      'Enne/Järel',
    ])
  })
})
