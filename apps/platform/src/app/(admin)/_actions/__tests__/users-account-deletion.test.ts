import { beforeEach, describe, expect, it, vi } from 'vitest'

import { accountDeletionStatusAction, cancelAccountDeletionAction } from '../users'

import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  repositories: unknown
} => ({
  repositories: null,
}))

const { cookieJar } = vi.hoisted(() => ({
  cookieJar: new Map<string, string>(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => {
    const store = {
      get: (name: string) => {
        const value = cookieJar.get(name)
        return value === undefined ? undefined : { name, value }
      },
      set: (name: string, value: string) => {
        cookieJar.set(name, value)
        return store
      },
    }
    return Promise.resolve(store)
  }),
}))

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
}))
vi.mock('@/lib/auth/session', () => sessionMocks)

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: { userId: 'admin-1', role: 'admin' }, repositories: state.repositories }),
  ),
}))

const getRepositoriesMock = vi.mocked(getRepositories)

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const findDocsByKey: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: { collection: string; where?: unknown }) => {
      let docs: Record<string, unknown>[] = []
      if (args.collection === 'audit-entry' && JSON.stringify(args.where).includes('user.gdpr_delete')) {
        docs = findDocsByKey['delete-markers'] ?? []
      }
      return Promise.resolve({ docs })
    }),
    findByID: vi.fn(() => Promise.resolve(null)),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn(() => Promise.resolve(undefined)),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    findDocsByKey,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as never)
}

function armPortalUser(userId = 'user-9'): void {
  cookieJar.set('access_token', 'portal-token')
  verifyAccessTokenMock.mockReturnValue({ userId, role: 'private', sessionId: 's-1' })
  sessionMocks.getUserSession.mockResolvedValue({
    userId,
    role: 'private',
    impersonatedBy: undefined,
    profileId: undefined,
    tokenFamily: 'family-1',
    active: true,
    refreshTokenHash: 'hash-1',
    createdAt: new Date(),
  })
}

const PENDING_MARKER = {
  id: 'marker-1',
  action: 'user.gdpr_delete',
  entityType: 'user',
  entityId: 'user-9',
  after: { phase: 'requested', reason: 'soovin kustutada', coolingOffUntil: '2099-01-01T00:00:00.000Z' },
  createdAt: '2026-09-01T09:00:00.000Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  cookieJar.clear()
})

describe('accountDeletionStatusAction (portal cooling-off feed)', () => {
  it('reports nothing for an anonymous caller', async () => {
    const result = await accountDeletionStatusAction()

    expect(result).toEqual({ pending: false, requestedAt: null, coolingOffUntil: null })
    expect(sessionMocks.getUserSession).not.toHaveBeenCalled()
  })

  it('reports a pending request inside the cooling-off window', async () => {
    armPortalUser()
    const repos = makeRepos()
    repos.findDocsByKey['delete-markers'] = [PENDING_MARKER]
    useRepos(repos)

    const result = await accountDeletionStatusAction()

    expect(result).toEqual({
      pending: true,
      requestedAt: '2026-09-01T09:00:00.000Z',
      coolingOffUntil: '2099-01-01T00:00:00.000Z',
    })
  })

  it('hides executed or elapsed requests', async () => {
    armPortalUser()
    const repos = makeRepos()
    repos.findDocsByKey['delete-markers'] = [
      { ...PENDING_MARKER, after: { phase: 'executed' } },
    ]
    useRepos(repos)
    expect(await accountDeletionStatusAction()).toMatchObject({ pending: false })

    repos.findDocsByKey['delete-markers'] = [
      { ...PENDING_MARKER, after: { phase: 'requested', coolingOffUntil: '2026-01-01T00:00:00.000Z' } },
    ]
    useRepos(repos)
    expect(await accountDeletionStatusAction()).toMatchObject({ pending: false })
  })
})

describe('cancelAccountDeletionAction (portal cancel during cooling-off)', () => {
  it('requires a signed-in user', async () => {
    const result = await cancelAccountDeletionAction()

    expect(result).toEqual({
      ok: false,
      error: 'Kustutustaotluse tühistamiseks peate olema sisse logitud.',
    })
    expect(getRepositoriesMock).not.toHaveBeenCalled()
  })

  it('refuses when there is no cancellable pending request', async () => {
    armPortalUser()
    const repos = makeRepos()
    repos.findDocsByKey['delete-markers'] = []
    useRepos(repos)

    const result = await cancelAccountDeletionAction()

    expect(result).toEqual({ ok: false, error: 'Aktiivset kustutustaotlust ei leitud.' })
    expect(repos.creates).toEqual([])
  })

  it('audits the cancel against the user and confirms with a notice', async () => {
    armPortalUser()
    const repos = makeRepos()
    repos.findDocsByKey['delete-markers'] = [PENDING_MARKER]
    useRepos(repos)

    const result = await cancelAccountDeletionAction()

    expect(result).toEqual({ ok: true, message: 'Kustutustaotlus tühistatud; konto jääb aktiivseks.' })

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'user-9',
      action: 'user.gdpr_delete',
      entityType: 'user',
      entityId: 'user-9',
      after: {
        phase: 'cancelled',
        cancelledBy: 'user',
        coolingOffUntil: '2099-01-01T00:00:00.000Z',
      },
    })

    const notification = repos.creates.find((entry) => entry.collection === 'notifications')
    expect(notification?.data).toMatchObject({ userId: 'user-9', event: 'user.gdpr_delete' })
  })

  it('returns a failure when the audit write fails', async () => {
    armPortalUser()
    const repos = makeRepos()
    repos.findDocsByKey['delete-markers'] = [PENDING_MARKER]
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))
    useRepos(repos)

    const result = await cancelAccountDeletionAction()

    expect(result).toEqual({
      ok: false,
      error: 'Kustutustaotluse tühistamine ebaõnnestus: audit write failed',
    })
  })
})
