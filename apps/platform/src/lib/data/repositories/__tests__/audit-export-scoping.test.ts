import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GET as csvExportRoute } from '@/app/api/v1/admin/audit/export/csv/route'
import { GET as jsonExportRoute } from '@/app/api/v1/admin/audit/export/json/route'
import type { CoreRepositories } from '@/lib/data/repositories'

/**
 * Route guard tests for the audit CSV/JSON export routes (task 15.4): the
 * routes must enforce audit:read exactly like the list reads and scope an
 * admin to its own entries (the self-view rule), while a superadmin may
 * filter by any actor. requireAdminRepositories is mocked; permissions and
 * the export filtering helpers run for real.
 */

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

vi.mock('@/app/(admin)/_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

interface FindArgs {
  collection: string
}

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface ExportRepos {
  repositories: CoreRepositories
  creates: CreateArgs[]
  findCalls: string[]
}

function auditDoc(id: string, actorId: string, createdAt: string): Record<string, unknown> {
  return {
    id,
    actorId,
    action: 'auction.publish',
    entityType: 'auction',
    entityId: 'a-1',
    before: null,
    after: { auctionId: 'a-1' },
    createdAt,
    updatedAt: createdAt,
    prevHash: null,
    hash: `hash-${id}`,
  }
}

const AUDIT_DOCS: Record<string, unknown>[] = [
  auditDoc('entry-a1', 'admin-1', '2026-09-01T10:00:00.000Z'),
  auditDoc('entry-a2', 'admin-2', '2026-09-02T10:00:00.000Z'),
  auditDoc('entry-s1', 'superadmin-1', '2026-09-03T10:00:00.000Z'),
]

const STAFF_DOCS: Record<string, unknown>[] = [
  { id: 'admin-1', email: 'admin1@example.ee', name: 'Admin Üks', role: 'admin' },
  { id: 'admin-2', email: 'admin2@example.ee', name: 'Admin Kaks', role: 'admin' },
  { id: 'superadmin-1', email: 'super@example.ee', name: 'Super Admin', role: 'superadmin' },
]

function makeExportRepos(
  auditDocs: Record<string, unknown>[],
  staffDocs: Record<string, unknown>[],
): ExportRepos {
  const creates: CreateArgs[] = []
  const findCalls: string[] = []
  const repositories = {
    find: vi.fn((args: FindArgs) => {
      findCalls.push(args.collection)
      if (args.collection === 'users') {
        return Promise.resolve({ docs: staffDocs })
      }
      return Promise.resolve({ docs: auditDocs })
    }),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
  }
  return {
    repositories: repositories as unknown as CoreRepositories,
    creates,
    findCalls,
  }
}

function useSession(
  userId: string,
  role: string,
  auditDocs: Record<string, unknown>[] = AUDIT_DOCS,
): ExportRepos {
  state.session = { userId, role }
  const exported = makeExportRepos(auditDocs, STAFF_DOCS)
  state.repositories = exported.repositories
  return exported
}

const CSV_URL = 'http://localhost:3000/api/v1/admin/audit/export/csv'
const JSON_URL = 'http://localhost:3000/api/v1/admin/audit/export/json'

function exportRequest(url: string, query: string): Request {
  return new Request(query ? `${url}?${query}` : url)
}

beforeEach(() => {
  state.session = { userId: 'admin-1', role: 'admin' }
  state.repositories = null
})

describe('audit CSV export scoping', () => {
  it('answers 403 to a specialist and reads nothing', async () => {
    const exported = useSession('specialist-1', 'specialist')

    const response = await csvExportRoute(exportRequest(CSV_URL, ''))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Ainult superadmin ja administraator.' })
    expect(exported.findCalls).toEqual([])
    expect(exported.creates).toEqual([])
  })

  it('answers 403 to a seller and reads nothing', async () => {
    const exported = useSession('seller-1', 'seller')

    const response = await csvExportRoute(exportRequest(CSV_URL, ''))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Ainult superadmin ja administraator.' })
    expect(exported.findCalls).toEqual([])
    expect(exported.creates).toEqual([])
  })

  it('scopes an admin to its own entries even with an actor param', async () => {
    useSession('admin-1', 'admin')

    const response = await csvExportRoute(exportRequest(CSV_URL, 'actor=admin-2'))

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('entry-a1')
    expect(text).not.toContain('entry-a2')
    expect(text).not.toContain('entry-s1')
  })

  it('lets a superadmin filter by any actor', async () => {
    useSession('superadmin-1', 'superadmin')

    const response = await csvExportRoute(exportRequest(CSV_URL, 'actor=admin-2'))

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('entry-a2')
    expect(text).not.toContain('entry-a1')
    expect(text).not.toContain('entry-s1')
  })

  it('returns every entry for a superadmin without an actor param', async () => {
    useSession('superadmin-1', 'superadmin')

    const response = await csvExportRoute(exportRequest(CSV_URL, ''))

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('entry-a1')
    expect(text).toContain('entry-a2')
    expect(text).toContain('entry-s1')
  })

  it('audits the export before the file is returned', async () => {
    const exported = useSession('admin-1', 'admin')

    const response = await csvExportRoute(exportRequest(CSV_URL, 'actor=admin-2'))

    expect(response.status).toBe(200)
    expect(exported.creates).toHaveLength(1)
    expect(exported.creates[0]?.collection).toBe('audit-entry')
    expect(exported.creates[0]?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'audit.export',
      entityType: 'audit-entry',
      entityId: 'bulk',
      after: { format: 'csv', rowCount: 1, filters: { actor: 'admin-1' } },
    })
  })
})

describe('audit JSON export scoping', () => {
  it('answers 403 to a role without audit:read and reads nothing', async () => {
    const exported = useSession('specialist-1', 'specialist')

    const response = await jsonExportRoute(exportRequest(JSON_URL, ''))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Ainult superadmin ja administraator.' })
    expect(exported.findCalls).toEqual([])
    expect(exported.creates).toEqual([])
  })

  it('scopes an admin to its own entries even with an actor param', async () => {
    useSession('admin-1', 'admin')

    const response = await jsonExportRoute(exportRequest(JSON_URL, 'actor=admin-2'))

    expect(response.status).toBe(200)
    const body = (await response.json()) as { id: string }[]
    expect(body.map((row) => row.id)).toEqual(['entry-a1'])
  })

  it('lets a superadmin filter by any actor', async () => {
    useSession('superadmin-1', 'superadmin')

    const response = await jsonExportRoute(exportRequest(JSON_URL, 'actor=admin-2'))

    expect(response.status).toBe(200)
    const body = (await response.json()) as { id: string }[]
    expect(body.map((row) => row.id)).toEqual(['entry-a2'])
  })

  it('returns every entry for a superadmin without an actor param', async () => {
    useSession('superadmin-1', 'superadmin')

    const response = await jsonExportRoute(exportRequest(JSON_URL, ''))

    expect(response.status).toBe(200)
    const body = (await response.json()) as { id: string }[]
    expect(body.map((row) => row.id)).toEqual(['entry-a1', 'entry-a2', 'entry-s1'])
  })

  it('audits the export before the file is returned', async () => {
    const exported = useSession('superadmin-1', 'superadmin')

    const response = await jsonExportRoute(exportRequest(JSON_URL, 'actor=admin-2'))

    expect(response.status).toBe(200)
    expect(exported.creates).toHaveLength(1)
    expect(exported.creates[0]?.data).toMatchObject({
      actorId: 'superadmin-1',
      action: 'audit.export',
      after: { format: 'json', rowCount: 1, filters: { actor: 'admin-2' } },
    })
  })
})
