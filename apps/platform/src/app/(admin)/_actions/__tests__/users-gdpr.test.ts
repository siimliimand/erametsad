import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  anonymizeUserAction,
  exportUserGdprAction,
} from '../users'

import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

const mediaMocks = vi.hoisted(() => ({
  getMediaBucket: vi.fn(),
}))
vi.mock('../../admin/media/_lib/media-upload', () => mediaMocks)

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
  sessionGuardContext: (payload: unknown) => payload,
}))

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getUserSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeUserSessions: vi.fn(),
  writeSessionCookies: vi.fn(),
  clearSessionCookiesOnStore: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => sessionMocks)

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

const getRepositoriesMock = vi.mocked(getRepositories)
const getMediaBucketMock = vi.mocked(mediaMocks.getMediaBucket)

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

interface FindArgs {
  collection: string
  where?: unknown
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: FindArgs) =>
      Promise.resolve({ docs: findDocsByCollection[args.collection] ?? [] }),
    ),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    updates,
    docsByCollection,
    findDocsByCollection,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as never)
}

const ANONYMIZE_REASON = 'GDPR taotlus täidetud'
const ANONYMIZE_OK_MESSAGE = 'Kasutaja anonüümiseeritud; arvestuslikud andmed säilitatakse 7 aastat.'

function userDoc(): Record<string, unknown> {
  return {
    id: 'user-9',
    email: 'mari@example.ee',
    name: 'Mari Mets',
    phone: '+37251234567',
    role: 'private',
    status: 'active',
    authMethod: 'eid',
    passwordHash: 'secret-hash',
    passwordSalt: 'secret-salt',
    isikukoodEncrypted: 'encrypted-blob',
    isikukoodIv: 'iv-blob',
    isikukoodAuthTag: 'tag-blob',
    isikukoodHash: 'hash-blob',
    isikukood: '32708100019',
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  getMediaBucketMock.mockResolvedValue(null)
  state.session = { userId: 'admin-1', role: 'admin' }
})

describe('anonymizeUserAction (GDPR anonymize with retention)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = userDoc()
    repos.findDocsByCollection['audit-entry'] = []
    repos.findDocsByCollection.profile = [
      { id: 'profile-1', userId: 'user-9', displayName: 'Mari Mets', phone: '+37251234567' },
      { id: 'profile-2', userId: 'user-9', displayName: 'Mari too', phone: null },
    ]
  })

  it('denies a role without users:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('rejects a reason shorter than 5 characters', async () => {
    const result = await anonymizeUserAction('user-9', 'ei')

    expect(result).toEqual({
      ok: false,
      error: 'Anonüümiseerimise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
    expect(repos.updates).toEqual([])
  })

  it('refuses a staff target', async () => {
    repos.docsByCollection.users = { id: 'staff-1', role: 'admin', status: 'active' }

    const result = await anonymizeUserAction('staff-1', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Töötaja konto anonüümiseerimine ei ole lubatud.' })
    expect(repos.updates).toEqual([])
  })

  it('refuses a user that is already anonymized', async () => {
    repos.findDocsByCollection['audit-entry'] = [{ id: 'audit-1', action: 'user.gdpr_delete' }]

    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Kasutaja konto on juba anonüümiseeritud.' })
    expect(repos.updates).toEqual([])
  })

  it('keeps the users row, nulls every personal field and masks the address', async () => {
    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: true, message: ANONYMIZE_OK_MESSAGE })
    expect(sessionMocks.revokeUserSessions).toHaveBeenCalledWith('user-9')

    // Retention rule: no row is removed, so contract and billing references
    // stay intact for the 7-year accounting retention.
    expect(repos.delete).not.toHaveBeenCalled()
    expect(repos.updates).toEqual([
      {
        collection: 'users',
        id: 'user-9',
        data: {
          email: 'anonymized-user-9@gdpr.invalid',
          name: null,
          phone: null,
          status: 'suspended',
          passwordHash: null,
          passwordSalt: null,
          isikukoodEncrypted: null,
          isikukoodIv: null,
          isikukoodAuthTag: null,
          isikukoodHash: null,
        },
      },
      {
        collection: 'profile',
        id: 'profile-1',
        data: { displayName: 'Anonümiseeritud', phone: null },
      },
      {
        collection: 'profile',
        id: 'profile-2',
        data: { displayName: 'Anonümiseeritud', phone: null },
      },
    ])
  })

  it('audits the anonymize with the 7-year retention deadline and notifies nobody', async () => {
    await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    if (!audit) throw new Error('audit entry not created')
    expect(audit.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.gdpr_delete',
      entityType: 'user',
      entityId: 'user-9',
      before: { status: 'active', personalData: true },
      after: {
        status: 'suspended',
        personalData: false,
        reason: ANONYMIZE_REASON,
        profilesAnonymized: 2,
      },
    })

    const after = audit.data.after as { anonymizedAt: string; retentionUntil: string }
    const anonymizedAt = new Date(after.anonymizedAt)
    const expectedRetention = new Date(anonymizedAt)
    expectedRetention.setFullYear(expectedRetention.getFullYear() + 7)
    expect(after.retentionUntil).toBe(expectedRetention.toISOString())

    // The account is unusable and the address masked: no notification.
    expect(repos.creates.some((entry) => entry.collection === 'notifications')).toBe(false)
  })

  it('returns a failure and leaves the account untouched when the write fails', async () => {
    repos.update.mockRejectedValueOnce(new Error('db down'))

    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Anonüümiseerimine ebaõnnestus: db down' })
    expect(repos.creates).toEqual([])
  })
})

describe('exportUserGdprAction (audited ZIP export)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = userDoc()
    repos.findDocsByCollection['audit-entry'] = []
    repos.findDocsByCollection.profile = [
      { id: 'profile-1', userId: 'user-9', displayName: 'Mari Mets' },
    ]
    repos.findDocsByCollection.bids = [{ id: 'bid-1', amountCents: 1500 }]
    repos.findDocsByCollection.contracts = []
    repos.findDocsByCollection['auction-rights'] = []
    repos.findDocsByCollection.notifications = []
  })

  it('denies a role without users:read before any query runs', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await exportUserGdprAction('user-9')

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.find).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
  })

  it('reports a missing user', async () => {
    repos.docsByCollection.users = null

    const result = await exportUserGdprAction('user-9')

    expect(result).toEqual({ ok: false, error: 'Kasutajat ei leitud.' })
    expect(repos.creates).toEqual([])
  })

  it('scopes every collection query to the requested user', async () => {
    const result = await exportUserGdprAction('user-9')
    if (!result.ok) throw new Error('export failed')

    const whereByCollection = new Map(
      repos.find.mock.calls.map((call) => {
        const args = call[0]
        return [args.collection, args.where]
      }),
    )
    expect(whereByCollection.size).toBe(6)
    expect(whereByCollection.get('profile')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('bids')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('contracts')).toEqual({ signedBy: { equals: 'user-9' } })
    expect(whereByCollection.get('auction-rights')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('notifications')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('audit-entry')).toEqual({
      and: [{ entityType: { equals: 'user' } }, { entityId: { equals: 'user-9' } }],
    })
  })

  it('returns a ZIP carrying the personal data but no credential columns', async () => {
    const result = await exportUserGdprAction('user-9')
    if (!result.ok) throw new Error('export failed')

    expect(result.filename).toBe('isikuandmed-user-9.zip')
    const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0))
    const archive = new TextDecoder().decode(bytes)
    expect(archive.startsWith('PK')).toBe(true)
    expect(archive).toContain('kasutaja.json')
    expect(archive).toContain('32708100019')
    expect(archive).toContain('profile-1')
    // Credential columns never leave the server.
    expect(archive).not.toContain('secret-hash')
    expect(archive).not.toContain('secret-salt')
  })

  it('audits the export with the file list and byte size', async () => {
    const result = await exportUserGdprAction('user-9')
    if (!result.ok) throw new Error('export failed')

    const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0))
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.gdpr_export',
      entityType: 'user',
      entityId: 'user-9',
      after: {
        format: 'zip',
        files: [
          'kasutaja.json',
          'profiilid.json',
          'pakkumised.json',
          'lepingud.json',
          'oigused.json',
          'teavitused.json',
          'audit.json',
        ],
        bytes: bytes.length,
        archived: false,
      },
    })

    // No bucket binding (local dev): download-only, no R2 key on the audit.
    expect(getMediaBucketMock).toHaveBeenCalledTimes(1)
    expect((audit?.data.after as { r2Key?: unknown }).r2Key).toBeUndefined()
  })

  it('archives the ZIP under gdpr-exports/ when the media bucket exists', async () => {
    const putMock = vi.fn(
      (_key: string, _value: ArrayBuffer, _options?: { httpMetadata?: { contentType?: string } }) =>
        Promise.resolve(undefined),
    )
    getMediaBucketMock.mockResolvedValue({
      put: putMock,
      get: vi.fn(() => Promise.resolve(null)),
      delete: vi.fn(() => Promise.resolve(undefined)),
    })

    const result = await exportUserGdprAction('user-9')
    if (!result.ok) throw new Error('export failed')

    expect(putMock).toHaveBeenCalledTimes(1)
    const key = putMock.mock.calls[0]?.[0]
    expect(typeof key).toBe('string')
    expect(String(key)).toContain('gdpr-exports/user-9/')
    expect(String(key).endsWith('.zip')).toBe(true)

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      after: { archived: true, r2Key: key },
    })
  })

  it('fails closed when the audit write fails', async () => {
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))

    const result = await exportUserGdprAction('user-9')

    expect(result).toEqual({
      ok: false,
      error: 'Eksportimise logimine ebaõnnestus: audit write failed',
    })
  })
})
