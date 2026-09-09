import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { flagUserForShillAction, unflagUserForShillAction } from '../users'

import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: 'admin' | 'specialist' }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
  sessionGuardContext: (payload: unknown) => payload,
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

interface FindArgs {
  collection: string
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: FindArgs) =>
      Promise.resolve({ docs: findDocsByCollection[args.collection] ?? [] }),
    ),
    findByID: vi.fn((args: { collection: string }): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn(() => Promise.resolve({})),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    docsByCollection,
    findDocsByCollection,
  }
}

type Repos = ReturnType<typeof makeRepos>

const REASON = 'kahtlane pakkumiste vahetus'

beforeEach(() => {
  vi.clearAllMocks()
  state.session = { userId: 'admin-1', role: 'admin' }
})

afterEach(() => {
  state.repositories = null
})

describe('flagUserForShillAction (shill flag marker)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
    state.repositories = repos
    getRepositoriesMock.mockResolvedValue(repos as never)
  })

  it('denies a role without users:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await flagUserForShillAction('user-9', REASON)

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.find).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
  })

  it('rejects a missing user and a reason shorter than 5 characters', async () => {
    expect(await flagUserForShillAction('', REASON)).toEqual({
      ok: false,
      error: 'Kasutaja identifikaator puudub.',
    })
    expect(await flagUserForShillAction('user-9', 'ei')).toEqual({
      ok: false,
      error: 'Märkimise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
    expect(repos.creates).toEqual([])
  })

  it('refuses staff targets and unknown users', async () => {
    repos.docsByCollection.users = { id: 'staff-1', role: 'specialist', status: 'active' }
    expect(await flagUserForShillAction('staff-1', REASON)).toEqual({
      ok: false,
      error: 'Töötaja konto märkimine ei ole lubatud.',
    })

    repos.docsByCollection.users = null
    expect(await flagUserForShillAction('ghost', REASON)).toEqual({
      ok: false,
      error: 'Kasutajat ei leitud.',
    })
    expect(repos.creates).toEqual([])
  })

  it('refuses a user that is already flagged', async () => {
    repos.findDocsByCollection['audit-entry'] = [
      { id: 'audit-1', action: 'user.shill_flag', after: { phase: 'flagged', reason: 'ealrier' } },
    ]

    const result = await flagUserForShillAction('user-9', REASON)

    expect(result).toEqual({ ok: false, error: 'Kasutaja on juba märgitud shill-uurimiseks.' })
    expect(repos.creates).toEqual([])
  })

  it('writes the audited user.shill_flag marker without notifying the user', async () => {
    const result = await flagUserForShillAction('user-9', REASON)

    expect(result).toEqual({ ok: true, message: 'Kasutaja märgitud shill-uurimiseks.' })
    expect(repos.creates).toHaveLength(1)
    expect(repos.creates[0]).toEqual({
      collection: 'audit-entry',
      data: {
        actorId: 'admin-1',
        action: 'user.shill_flag',
        entityType: 'user',
        entityId: 'user-9',
        after: { phase: 'flagged', reason: REASON },
        // Task 4.7: the reason rides the dedicated era column as well.
        reason: REASON,
      },
    })
  })

  it('returns a failure when the audit write fails', async () => {
    repos.create.mockRejectedValueOnce(new Error('db down'))

    const result = await flagUserForShillAction('user-9', REASON)

    expect(result).toEqual({ ok: false, error: 'Märkimine ebaõnnestus: db down' })
  })
})

describe('unflagUserForShillAction (clear marker)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
    state.repositories = repos
    getRepositoriesMock.mockResolvedValue(repos as never)
  })

  it('refuses when no active flag exists', async () => {
    expect(await unflagUserForShillAction('user-9', REASON)).toEqual({
      ok: false,
      error: 'Aktiivset märget ei leitud.',
    })

    repos.findDocsByCollection['audit-entry'] = [
      { id: 'audit-2', action: 'user.shill_flag', after: { phase: 'cleared', reason: 'puhas' } },
    ]
    expect(await unflagUserForShillAction('user-9', REASON)).toEqual({
      ok: false,
      error: 'Aktiivset märget ei leitud.',
    })
    expect(repos.creates).toEqual([])
  })

  it('writes the cleared phase entry on the same audit key', async () => {
    repos.findDocsByCollection['audit-entry'] = [
      { id: 'audit-1', action: 'user.shill_flag', after: { phase: 'flagged', reason: 'ealrier' } },
    ]

    const result = await unflagUserForShillAction('user-9', 'märge ei kinnitunud')

    expect(result).toEqual({ ok: true, message: 'Märge eemaldatud.' })
    expect(repos.creates).toEqual([
      {
        collection: 'audit-entry',
        data: {
          actorId: 'admin-1',
          action: 'user.shill_flag',
          entityType: 'user',
          entityId: 'user-9',
          after: { phase: 'cleared', reason: 'märge ei kinnitunud' },
          // Task 4.7: the reason rides the dedicated era column as well.
          reason: 'märge ei kinnitunud',
        },
      },
    ])
  })

  it('rejects a reason shorter than 5 characters', async () => {
    expect(await unflagUserForShillAction('user-9', 'ei')).toEqual({
      ok: false,
      error: 'Märkimise eemaldamise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
  })
})
