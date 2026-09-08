import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { banUserAction } from '../users'

import {
  BANNED_ISIKUKOOD_ERROR,
  isikukoodBanError,
} from '@/app/(portal)/_actions/register/ban-guard'
import { POST as registerRoute } from '@/app/api/v1/auth/register/route'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { createCoreRepositories, nodeIsikukoodCodec, type CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

const { RedirectError, state } = vi.hoisted(() => {
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
  return { RedirectError, state }
})

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url)
  },
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

const BAN_REASON = 'korduv petturlus'
const OK_MESSAGE = 'Konto keelatud; sama isikukoodiga registreerimine on blokeeritud.'

beforeEach(() => {
  vi.clearAllMocks()
  state.session = { userId: 'admin-1', role: 'admin' }
})

describe('banUserAction (permanent ban marker)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
  })

  it('denies a role without users:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await banUserAction('user-9', BAN_REASON)

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.find).not.toHaveBeenCalled()
    expect(repos.updates).toEqual([])
    expect(sessionMocks.revokeUserSessions).not.toHaveBeenCalled()
  })

  it('rejects a reason shorter than 5 characters without touching the account', async () => {
    const result = await banUserAction('user-9', 'ei')

    expect(result).toEqual({ ok: false, error: 'Keelamise põhjus on kohustuslik (vähemalt 5 tähemärki).' })
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('refuses a staff target', async () => {
    repos.docsByCollection.users = { id: 'staff-1', role: 'specialist', status: 'active' }

    const result = await banUserAction('staff-1', BAN_REASON)

    expect(result).toEqual({ ok: false, error: 'Töötaja konto keelamine ei ole lubatud.' })
    expect(repos.updates).toEqual([])
  })

  it('refuses a user that is already banned', async () => {
    repos.findDocsByCollection['audit-entry'] = [{ id: 'audit-1', action: 'user.ban' }]

    const result = await banUserAction('user-9', BAN_REASON)

    expect(result).toEqual({ ok: false, error: 'Kasutaja konto on juba keelatud.' })
    expect(repos.updates).toEqual([])
    expect(sessionMocks.revokeUserSessions).not.toHaveBeenCalled()
  })

  it('suspends the account, pauses autobidders, revokes sessions and writes the user.ban marker', async () => {
    repos.findDocsByCollection['audit-entry'] = []
    repos.findDocsByCollection.autobidders = [
      { id: 'autobidder-1', status: 'active' },
      { id: 'autobidder-2', status: 'active' },
    ]

    const result = await banUserAction('user-9', BAN_REASON)

    expect(result).toEqual({ ok: true, message: OK_MESSAGE })
    expect(repos.updates).toEqual([
      { collection: 'users', id: 'user-9', data: { status: 'suspended' } },
      { collection: 'autobidders', id: 'autobidder-1', data: { status: 'paused' } },
      { collection: 'autobidders', id: 'autobidder-2', data: { status: 'paused' } },
    ])
    expect(sessionMocks.revokeUserSessions).toHaveBeenCalledWith('user-9')

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toEqual({
      actorId: 'admin-1',
      action: 'user.ban',
      entityType: 'user',
      entityId: 'user-9',
      before: { status: 'active', activeAutobidders: 2 },
      after: {
        status: 'suspended',
        banned: true,
        reason: BAN_REASON,
        autobiddersCancelled: 2,
        registrationBlocked: true,
      },
    })

    const notification = repos.creates.find((entry) => entry.collection === 'notifications')
    expect(notification?.data).toMatchObject({ userId: 'user-9', event: 'user.ban' })
    expect(String(notification?.data.body)).toContain('sama isikukoodiga')
    expect(String(notification?.data.body)).toContain(BAN_REASON)
  })

  it('returns a failure and writes no marker when the suspension write fails', async () => {
    repos.findDocsByCollection['audit-entry'] = []
    repos.update.mockRejectedValueOnce(new Error('db down'))

    const result = await banUserAction('user-9', BAN_REASON)

    expect(result).toEqual({ ok: false, error: 'Kasutaja keelamine ebaõnnestus: db down' })
    expect(repos.creates).toEqual([])
  })
})

describe('isikukood-level registration block (admin ban → portal register)', () => {
  // Checksum-valid code reused from the register route contract tests.
  const ISIKUKOOD = '32708100019'
  const OTHER_ISIKUKOOD = '48001010000'

  let testDb: SqliteTestDb
  let repos: CoreRepositories
  let ipCounter: number
  const isikukoodKeyBackup = process.env.ISIKUKOOD_ENCRYPTION_KEY

  function registerRequest(isikukood: string): NextRequest {
    ipCounter += 1
    const consentAt = new Date().toISOString()
    return new NextRequest('http://localhost:3000/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        identifier: 'uuskonto@example.ee',
        isikukood,
        profileType: 'private',
        consents: { terms: consentAt, privacy: consentAt, marketing: consentAt },
      }),
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.9.${String(Math.floor(ipCounter / 250))}.${String(ipCounter % 250)}`,
      },
    })
  }

  function userCount(): number {
    return (testDb.raw.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
  }

  function banMarkerCount(userId: string): number {
    return (
      testDb.raw
        .prepare("SELECT COUNT(*) AS n FROM audit_entries WHERE entity_id = ? AND action = 'user.ban'")
        .get(userId) as { n: number }
    ).n
  }

  beforeEach(async () => {
    ipCounter = 0
    process.env.ISIKUKOOD_ENCRYPTION_KEY = isikukoodKeyBackup ?? 'users-ban-test-key'
    testDb = createSqliteTestDb()
    repos = createCoreRepositories(testDb.database, {
      isikukoodCodec: nodeIsikukoodCodec,
      batch: sqliteBatchRunner(testDb.raw),
    })
    state.repositories = repos
    getRepositoriesMock.mockResolvedValue(repos)
    // The audit actor references the users table, so the acting admin needs
    // a real row for the ban marker write to succeed.
    const admin = await repos.create({
      collection: 'users',
      data: { email: 'admin@example.ee', role: 'admin', status: 'active' },
    })
    state.session = { userId: admin.id, role: 'admin' }
  })

  afterEach(() => {
    if (isikukoodKeyBackup === undefined) {
      delete process.env.ISIKUKOOD_ENCRYPTION_KEY
    } else {
      process.env.ISIKUKOOD_ENCRYPTION_KEY = isikukoodKeyBackup
    }
    testDb.close()
  })

  it('does not block registration for a suspended account without the ban marker', async () => {
    const target = await repos.create({
      collection: 'users',
      data: { email: 'peatatud@example.ee', role: 'private', status: 'active', isikukood: ISIKUKOOD },
    })
    await repos.update({ collection: 'users', id: target.id, data: { status: 'suspended' } })

    expect(await isikukoodBanError(repos, ISIKUKOOD)).toBeNull()
  })

  it('the ban marker from the admin action makes the portal register route reject the identity', async () => {
    const target = await repos.create({
      collection: 'users',
      data: { email: 'keelatud@example.ee', role: 'private', status: 'active', isikukood: ISIKUKOOD },
    })
    expect(await isikukoodBanError(repos, ISIKUKOOD)).toBeNull()

    const result = await banUserAction(target.id, BAN_REASON)
    expect(result).toEqual({ ok: true, message: OK_MESSAGE })
    expect(banMarkerCount(target.id)).toBe(1)

    // The guard matches by isikukood hash and returns the neutral rejection.
    expect(await isikukoodBanError(repos, ISIKUKOOD)).toBe(BANNED_ISIKUKOOD_ERROR)

    const response = await registerRoute(registerRequest(ISIKUKOOD))
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: BANNED_ISIKUKOOD_ERROR })

    // No account row was created for the banned identity.
    expect(userCount()).toBe(2)

    // A different identity is unaffected.
    expect(await isikukoodBanError(repos, OTHER_ISIKUKOOD)).toBeNull()
  })
})
