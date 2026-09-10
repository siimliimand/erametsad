import { beforeEach, describe, expect, it, vi } from 'vitest'

import { startImpersonationAction, stopImpersonationAction, impersonationStateAction } from '../users'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { can, userContext } from '@/lib/data/guards'
import { createCoreRepositories, nodeIsikukoodCodec } from '@/lib/data/repositories'
import { GuardAccessError } from '@/lib/data/repositories/errors'
import { getRepositories } from '@/lib/data/runtime'

const dbMocks = vi.hoisted(() => ({
  query: vi.fn(),
  batch: vi.fn(),
}))
vi.mock('@/lib/db', () => ({
  db: dbMocks,
}))

const { RedirectError, state, cookieJar, cookieStores } = vi.hoisted(() => {
  class RedirectError extends Error {
    constructor(
      readonly url: string,
    ) {
      super(`NEXT_REDIRECT:${url}`)
      this.name = 'RedirectError'
    }
  }
  const state: {
    session: { userId: string; role: 'admin' | 'specialist' }
    repositories: unknown
  } = {
    session: { userId: 'admin-1', role: 'admin' },
    repositories: null,
  }
  return {
    RedirectError,
    state,
    cookieJar: new Map<string, string>(),
    cookieStores: [] as {
      get(name: string): { name: string; value: string } | undefined
      set(name: string, value: string): unknown
    }[],
  }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  headers: vi.fn(() => ({ get: () => null })),
  cookies: vi.fn(() => {
    const jar = cookieJar
    const store = {
      get: (name: string) => {
        const value = jar.get(name)
        return value === undefined ? undefined : { name, value }
      },
      set: (name: string, value: string) => {
        jar.set(name, value)
        return store
      },
    }
    cookieStores.push(store)
    return Promise.resolve(store)
  }),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
  sessionGuardContext: (payload: unknown) => payload,
}))

const verifyAccessTokenMock = vi.hoisted(() => vi.fn())
vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: verifyAccessTokenMock,
}))

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getUserSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeUserSessions: vi.fn(),
  writeSessionCookies: vi.fn(),
  clearSessionCookiesOnStore: vi.fn(),
  sessionCookieDomainFromHost: vi.fn(() => ''),
}))
vi.mock('@/lib/auth/session', () => sessionMocks)

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

const getRepositoriesMock = vi.mocked(getRepositories)

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const updates: { collection: string; id: string; data: Record<string, unknown> }[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  const order: string[] = []
  return {
    find: vi.fn((args: { collection: string }) =>
      Promise.resolve({ docs: findDocsByCollection[args.collection] ?? [] }),
    ),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      order.push(`create:${String(args.data.action)}`)
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((args: { collection: string; id: string; data: Record<string, unknown> }) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    updates,
    docsByCollection,
    findDocsByCollection,
    order,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as never)
}

async function redirectOf(run: () => Promise<unknown>): Promise<URL> {
  try {
    await run()
  } catch (error) {
    if (error instanceof RedirectError) return new URL(`http://test.local${error.url}`)
    throw error
  }
  throw new Error('expected the action to redirect')
}

const form = (entries: Record<string, string>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value)
  }
  return formData
}

const VIEW_REASON = 'kliendi probleemi uurimine'

// Shared order recorder so tests can assert the clamp runs between the
// session creation and the audit write; the start suite re-points it at the
// current suite's repos order array.
const reposRef: { order: string[] } = { order: [] }

beforeEach(() => {
  vi.clearAllMocks()
  cookieJar.clear()
  cookieStores.length = 0
  state.session = { userId: 'admin-1', role: 'admin' }
  dbMocks.query.mockImplementation((sql: string) => {
    reposRef.order.push(`clamp:${sql.slice(0, 30)}`)
    return Promise.resolve({ results: [], meta: { changes: 1 } })
  })
  sessionMocks.createSession.mockResolvedValue({
    accessToken: 'view-access-token',
    refreshToken: 'view-refresh-token',
    sessionId: 'view-session-1',
  })
})

describe('startImpersonationAction (audited view session)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    reposRef.order = repos.order
  })

  it('rejects a reason shorter than 5 characters without creating a session or audit entry', async () => {
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }

    const url = await redirectOf(() =>
      startImpersonationAction(form({ userId: 'user-9', reason: 'ei' })),
    )

    expect(url.pathname).toBe('/admin/users/user-9')
    expect(url.searchParams.get('viga')).toBe(
      'Vaatluse alustamise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    )
    expect(sessionMocks.createSession).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
  })

  it('refuses a staff target without creating a session', async () => {
    repos.docsByCollection.users = { id: 'staff-1', role: 'admin', status: 'active' }

    const url = await redirectOf(() =>
      startImpersonationAction(form({ userId: 'staff-1', reason: VIEW_REASON })),
    )

    expect(url.searchParams.get('viga')).toBe('Töötaja konto vaatlemine ei ole lubatud.')
    expect(sessionMocks.createSession).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
  })

  it('refuses a target whose account is not active', async () => {
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'suspended' }

    const url = await redirectOf(() =>
      startImpersonationAction(form({ userId: 'user-9', reason: VIEW_REASON })),
    )

    expect(url.searchParams.get('viga')).toBe('Kasutaja konto ei ole aktiivne.')
    expect(sessionMocks.createSession).not.toHaveBeenCalled()
  })

  it('creates a session bound to the operator, clamps the TTL, audits the start, then writes the cookies', async () => {
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
    sessionMocks.createSession.mockImplementation(() => {
      repos.order.push('createSession')
      return Promise.resolve({
        accessToken: 'view-access-token',
        refreshToken: 'view-refresh-token',
        sessionId: 'view-session-1',
      })
    })
    sessionMocks.writeSessionCookies.mockImplementation(() => {
      repos.order.push('cookies')
    })

    const url = await redirectOf(() =>
      startImpersonationAction(form({ userId: 'user-9', reason: VIEW_REASON })),
    )

    // Session binding: the target's identity with impersonatedBy = operator.
    expect(sessionMocks.createSession).toHaveBeenCalledWith(
      'user-9',
      'private',
      undefined,
      'admin-1',
    )

    // The 30-minute clamp runs on the session row before anything else
    // trusts the session, and the audit entry carries the clamped expiry.
    expect(repos.order).toEqual([
      'createSession',
      'clamp:UPDATE sessions SET expires_at',
      'create:user.impersonate',
      'cookies',
    ])
    expect(dbMocks.query).toHaveBeenCalledTimes(1)
    const [sql, params] = dbMocks.query.mock.calls[0] as [string, string[]]
    const [expiresAt = '', , sessionId = ''] = params
    expect(sql).toContain('WHERE id = ? AND impersonated_by IS NOT NULL')
    expect(sessionId).toBe('view-session-1')
    const clampDeltaMs = new Date(expiresAt).getTime() - Date.now()
    expect(clampDeltaMs).toBeGreaterThan(29 * 60 * 1000)
    expect(clampDeltaMs).toBeLessThanOrEqual(30 * 60 * 1000)

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.impersonate',
      entityType: 'user',
      entityId: 'user-9',
      after: { phase: 'start', reason: VIEW_REASON, sessionId: 'view-session-1', ttlMinutes: 30 },
    })
    expect((audit?.data.after as { expiresAt?: string }).expiresAt).toBe(expiresAt)

    expect(sessionMocks.writeSessionCookies).toHaveBeenCalledTimes(1)
    // one store for the audit request context, one for the session write
    expect(cookieStores).toHaveLength(2)
    expect(url.pathname).toBe('/user')
  })

  it('fails closed when the TTL clamp fails: no audit, no cookies', async () => {
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
    dbMocks.query.mockRejectedValueOnce(new Error('clamp failed'))

    const url = await redirectOf(() =>
      startImpersonationAction(form({ userId: 'user-9', reason: VIEW_REASON })),
    )

    expect(url.pathname).toBe('/admin/users/user-9')
    expect(url.searchParams.get('viga')).toContain('Vaatluse ajalimiidi seadmine ebaõnnestus')
    expect(repos.creates).toEqual([])
    expect(sessionMocks.writeSessionCookies).not.toHaveBeenCalled()
  })

  it('fails closed when the start audit write fails: no cookies, error redirect', async () => {
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))

    const url = await redirectOf(() =>
      startImpersonationAction(form({ userId: 'user-9', reason: VIEW_REASON })),
    )

    expect(url.pathname).toBe('/admin/users/user-9')
    expect(url.searchParams.get('viga')).toContain('Vaatluse alustamise logimine ebaõnnestus')
    expect(sessionMocks.writeSessionCookies).not.toHaveBeenCalled()
  })
})

describe('stopImpersonationAction (operator-bound stop)', () => {
  let repos: Repos

  const viewPayload = {
    userId: 'user-9',
    role: 'private',
    sessionId: 'view-session-1',
    impersonatedBy: 'admin-1',
  }

  function armViewSession(record = {
    userId: 'user-9',
    role: 'private',
    impersonatedBy: 'admin-1',
    profileId: undefined,
    tokenFamily: 'family-1',
    active: true,
    refreshTokenHash: 'hash-1',
    // Fresh row: elapsed-time TTL has not run out.
    createdAt: new Date(),
  }): void {
    cookieJar.set('access_token', 'view-token')
    verifyAccessTokenMock.mockReturnValue(viewPayload)
    sessionMocks.getUserSession.mockResolvedValue(record)
    repos.docsByCollection.users = { id: 'admin-1', role: 'admin', status: 'active' }
  }

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    sessionMocks.revokeSession.mockImplementation((sessionId: string) => {
      repos.order.push(`revoke:${sessionId}`)
      return Promise.resolve()
    })
  })

  it('redirects home without auditing or revoking when the token has no impersonation claim', async () => {
    cookieJar.set('access_token', 'plain-token')
    verifyAccessTokenMock.mockReturnValue({ userId: 'user-9', role: 'private', sessionId: 's-1' })

    const url = await redirectOf(() => stopImpersonationAction())

    expect(url.pathname).toBe('/')
    expect(sessionMocks.getUserSession).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
    expect(sessionMocks.revokeSession).not.toHaveBeenCalled()
  })

  it('redirects home when there is no access token at all', async () => {
    const url = await redirectOf(() => stopImpersonationAction())

    expect(url.pathname).toBe('/')
    expect(verifyAccessTokenMock).not.toHaveBeenCalled()
    expect(sessionMocks.revokeSession).not.toHaveBeenCalled()
  })

  it('refuses a session row whose impersonatedBy binding does not match the token claim', async () => {
    armViewSession({
      userId: 'user-9',
      role: 'private',
      impersonatedBy: 'admin-2',
      profileId: undefined,
      tokenFamily: 'family-1',
      active: true,
      refreshTokenHash: 'hash-1',
      createdAt: new Date('2026-09-01T10:00:00.000Z'),
    })

    const url = await redirectOf(() => stopImpersonationAction())

    expect(url.pathname).toBe('/')
    expect(repos.creates).toEqual([])
    expect(sessionMocks.revokeSession).not.toHaveBeenCalled()
  })

  it('audits the stop against the operator, revokes the view session and restores the operator', async () => {
    armViewSession()
    sessionMocks.createSession.mockResolvedValue({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
      sessionId: 'admin-session-2',
    })

    const url = await redirectOf(() => stopImpersonationAction())

    // The stop is audited against the real operator, not the view target.
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toEqual({
      actorId: 'admin-1',
      action: 'user.impersonate',
      entityType: 'user',
      entityId: 'user-9',
      after: { phase: 'stop', reason: null, sessionId: 'view-session-1' },
      sessionId: 'view-session-1',
    })

    expect(repos.order).toEqual(['create:user.impersonate', 'revoke:view-session-1'])
    expect(sessionMocks.revokeSession).toHaveBeenCalledWith('view-session-1')

    // Fresh operator session with their own role; view cookies are replaced.
    expect(sessionMocks.createSession).toHaveBeenCalledWith('admin-1', 'admin')
    expect(sessionMocks.writeSessionCookies).toHaveBeenCalledTimes(1)
    expect(sessionMocks.writeSessionCookies).toHaveBeenCalledWith(
      expect.anything(),
      'admin-access-token',
      'admin-refresh-token',
      '',
    )

    expect(url.pathname).toBe('/admin/users/user-9')
    expect(url.searchParams.get('teade')).toBe('Vaatlus lõpetatud.')
  })

  it('still revokes the view session when the stop audit write fails', async () => {
    armViewSession()
    sessionMocks.createSession.mockResolvedValue({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
      sessionId: 'admin-session-2',
    })
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))

    const url = await redirectOf(() => stopImpersonationAction())

    // Availability of the stop path wins over the stop audit entry.
    expect(sessionMocks.revokeSession).toHaveBeenCalledWith('view-session-1')
    expect(url.pathname).toBe('/admin/users/user-9')
  })

  it('ends an over-TTL view session with the expiry notice and marks the audit entry', async () => {
    armViewSession({
      userId: 'user-9',
      role: 'private',
      impersonatedBy: 'admin-1',
      profileId: undefined,
      tokenFamily: 'family-1',
      active: true,
      refreshTokenHash: 'hash-1',
      // Rotation refreshes expires_at, but created_at is stable: 31 min old.
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
    })
    sessionMocks.createSession.mockResolvedValue({
      accessToken: 'admin-access-token',
      refreshToken: 'admin-refresh-token',
      sessionId: 'admin-session-2',
    })

    const url = await redirectOf(() => stopImpersonationAction())

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect((audit?.data.after as { expired?: boolean }).expired).toBe(true)
    expect(sessionMocks.revokeSession).toHaveBeenCalledWith('view-session-1')
    expect(sessionMocks.createSession).toHaveBeenCalledWith('admin-1', 'admin')
    expect(url.pathname).toBe('/admin/users/user-9')
    expect(url.searchParams.get('teade')).toBe('Vaatlus aegus (30 minutit).')
  })
})

describe('impersonationStateAction (banner expiry feed)', () => {
  it('reports no active view session without a token', async () => {
    const result = await impersonationStateAction()

    expect(result).toEqual({ active: false, expiresAt: null })
    expect(dbMocks.query).not.toHaveBeenCalled()
  })

  it('reports the clamped expiry for a live impersonation row', async () => {
    cookieJar.set('access_token', 'view-token')
    verifyAccessTokenMock.mockReturnValue({ userId: 'user-9', role: 'private', sessionId: 'view-session-1' })
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
    dbMocks.query.mockResolvedValue({
      results: [{ expires_at: expiresAt, impersonated_by: 'admin-1', revoked_at: null }],
      meta: {},
    })

    const result = await impersonationStateAction()

    expect(result).toEqual({ active: true, expiresAt })
    expect(dbMocks.query).toHaveBeenCalledTimes(1)
  })

  it('ignores plain (non-impersonation) and revoked rows', async () => {
    cookieJar.set('access_token', 'plain-token')
    verifyAccessTokenMock.mockReturnValue({ userId: 'user-9', role: 'private', sessionId: 's-1' })
    dbMocks.query.mockResolvedValue({
      results: [{ expires_at: '2099-01-01T00:00:00.000Z', impersonated_by: null, revoked_at: null }],
      meta: {},
    })

    expect(await impersonationStateAction()).toEqual({ active: false, expiresAt: null })

    dbMocks.query.mockResolvedValue({
      results: [{ expires_at: '2099-01-01T00:00:00.000Z', impersonated_by: 'admin-1', revoked_at: '2026-09-01T00:00:00.000Z' }],
      meta: {},
    })
    expect(await impersonationStateAction()).toEqual({ active: false, expiresAt: null })
  })
})

describe('impersonation write veto (view sessions are read-only)', () => {
  it('denies guarded writes and allows reads for an impersonating context', () => {
    const viewer = userContext('u-1', 'private', 'admin-1')
    expect(can(viewer, 'bids', 'create').allowed).toBe(false)
    expect(can(viewer, 'profile', 'create').allowed).toBe(false)
    expect(can(viewer, 'bids', 'read').allowed).toBe(true)

    // The same context without the claim keeps the normal write rights.
    expect(can(userContext('u-1', 'private'), 'bids', 'create').allowed).toBe(true)
  })

  it('rejects a portal write with GuardAccessError only while impersonating', async () => {
    const testDb: SqliteTestDb = createSqliteTestDb()
    try {
      const systemRepos = createCoreRepositories(testDb.database, {
        isikukoodCodec: nodeIsikukoodCodec,
        batch: sqliteBatchRunner(testDb.raw),
      })
      const user = await systemRepos.create({
        collection: 'users',
        data: { email: 'u1@example.ee', role: 'private', status: 'active' },
      })
      const userId = user.id

      const impersonated = createCoreRepositories(testDb.database, {
        isikukoodCodec: nodeIsikukoodCodec,
        batch: sqliteBatchRunner(testDb.raw),
        guardContext: userContext(userId, 'private', 'admin-1'),
      })
      await expect(
        impersonated.create({
          collection: 'profile',
          data: { type: 'private', userId, displayName: 'Uurija', approvalStatus: 'approved' },
        }),
      ).rejects.toThrow(GuardAccessError)

      const profileCount = () =>
        (testDb.raw.prepare('SELECT COUNT(*) AS n FROM profiles').get() as { n: number }).n
      expect(profileCount()).toBe(0)

      // Control: the same write without the impersonation claim succeeds.
      const portalUser = createCoreRepositories(testDb.database, {
        isikukoodCodec: nodeIsikukoodCodec,
        batch: sqliteBatchRunner(testDb.raw),
        guardContext: userContext(userId, 'private'),
      })
      await portalUser.create({
        collection: 'profile',
        data: { type: 'private', userId, displayName: 'Uurija', approvalStatus: 'approved' },
      })
      expect(profileCount()).toBe(1)
    } finally {
      testDb.close()
    }
  })
})
