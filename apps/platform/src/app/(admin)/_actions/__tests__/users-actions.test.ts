import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  grantAuctionRightAction,
  revealIsikukoodAction,
  revokeAuctionRightAction,
} from '../users'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

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
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

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

vi.mock('@/lib/auth/session', () => ({
  getUserSession: vi.fn(),
  revokeSession: vi.fn(),
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
  where?: unknown
}

interface FindByIDArgs {
  collection: string
  id: string
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
    findByID: vi.fn((args: FindByIDArgs): Promise<unknown> =>
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
  getRepositoriesMock.mockResolvedValue(repos as unknown as CoreRepositories)
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

describe('grantAuctionRightAction (reason enforcement)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsByCollection.users = { id: 'user-9', name: 'Test Testov' }
    useRepos(repos)
  })

  it('rejects a reason shorter than 5 characters without creating a right', async () => {
    const url = await redirectOf(() =>
      grantAuctionRightAction(form({ userId: 'user-9', objectType: 'raieoigus', reason: 'ei' })),
    )
    expect(url.pathname).toBe('/admin/users/user-9')
    expect(url.searchParams.get('viga')).toBe('Õiguse andmise põhjus on kohustuslik (vähemalt 5 tähemärki).')
    expect(repos.creates).toEqual([])
  })

  it('rejects an unknown object type', async () => {
    const url = await redirectOf(() =>
      grantAuctionRightAction(form({ userId: 'user-9', objectType: 'maja', reason: 'õigus antud' })),
    )
    expect(url.searchParams.get('viga')).toBe('Vali sobiv objekti tüüp.')
  })

  it('denies a role without users:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const url = await redirectOf(() =>
      grantAuctionRightAction(form({ userId: 'user-9', objectType: 'raieoigus', reason: 'õigus antud' })),
    )
    expect(url.searchParams.get('viga')).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
    expect(repos.creates).toEqual([])
  })

  it('refuses a duplicate active right', async () => {
    repos.findDocsByCollection['auction-rights'] = [{ id: 'right-1', objectType: 'raieoigus' }]
    const url = await redirectOf(() =>
      grantAuctionRightAction(form({ userId: 'user-9', objectType: 'raieoigus', reason: 'topelt taotlus' })),
    )
    expect(url.searchParams.get('viga')).toBe('See oksjoniõigus on juba antud.')
  })

  it('creates the right, the user.right_grant audit entry and the notification', async () => {
    const url = await redirectOf(() =>
      grantAuctionRightAction(
        form({ userId: 'user-9', objectType: 'raieoigus', reason: 'pakkumise õigus antud', notify: 'on' }),
      ),
    )

    const rightCreate = repos.creates.find((entry) => entry.collection === 'auction-rights')
    expect(rightCreate?.data).toMatchObject({ user: 'user-9', objectType: 'raieoigus', grantedBy: 'admin-1' })

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.right_grant',
      entityType: 'user',
      entityId: 'user-9',
      after: { objectType: 'raieoigus', reason: 'pakkumise õigus antud', notified: true },
    })

    const notification = repos.creates.find((entry) => entry.collection === 'notifications')
    expect(notification?.data).toMatchObject({ userId: 'user-9', event: 'user.right_grant', title: 'Uus pakkumisõigus' })
    expect(String(notification?.data.body)).toContain('pakkumise õigus antud')

    expect(url.searchParams.get('teade')).toBe('Õigus antud ja kasutajat teavitatud.')
  })
})

describe('revokeAuctionRightAction (reason enforcement)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    useRepos(repos)
  })

  it('rejects a reason shorter than 5 characters without revoking', async () => {
    const url = await redirectOf(() =>
      revokeAuctionRightAction(form({ rightId: 'right-1', userId: 'user-9', reason: 'ei' })),
    )
    expect(url.searchParams.get('viga')).toBe('Õiguse tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).')
    expect(repos.updates).toEqual([])
  })

  it('refuses a right that belongs to another user', async () => {
    repos.docsByCollection['auction-rights'] = { id: 'right-1', userId: 'user-8', objectType: 'raieoigus', revokedAt: null }
    const url = await redirectOf(() =>
      revokeAuctionRightAction(form({ rightId: 'right-1', userId: 'user-9', reason: 'õigus tühistatud' })),
    )
    expect(url.searchParams.get('viga')).toBe('Oksjoniõigust ei leitud või see ei kuulu sellele kasutajale.')
  })

  it('refuses an already revoked right', async () => {
    repos.docsByCollection['auction-rights'] = {
      id: 'right-1',
      userId: 'user-9',
      objectType: 'raieoigus',
      revokedAt: '2026-08-01T10:00:00.000Z',
    }
    const url = await redirectOf(() =>
      revokeAuctionRightAction(form({ rightId: 'right-1', userId: 'user-9', reason: 'õigus tühistatud' })),
    )
    expect(url.searchParams.get('viga')).toBe('See oksjoniõigus on juba tühistatud.')
  })

  it('revokes with a before/after audit entry and records the reason', async () => {
    repos.docsByCollection['auction-rights'] = { id: 'right-1', userId: 'user-9', objectType: 'raieoigus', revokedAt: null }

    const url = await redirectOf(() =>
      revokeAuctionRightAction(
        form({ rightId: 'right-1', userId: 'user-9', reason: 'õigus tühistatud', notify: 'on' }),
      ),
    )

    expect(repos.updates[0]).toMatchObject({ collection: 'auction-rights', id: 'right-1' })
    expect(typeof repos.updates[0]?.data.revokedAt).toBe('string')

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.right_revoke',
      entityType: 'user',
      entityId: 'user-9',
      before: { objectType: 'raieoigus', revokedAt: null },
      after: { objectType: 'raieoigus', reason: 'õigus tühistatud', notified: true },
    })
    expect(audit?.data.before).toMatchObject({ revokedAt: null })

    const notification = repos.creates.find((entry) => entry.collection === 'notifications')
    expect(notification?.data).toMatchObject({ event: 'user.right_revoke', title: 'Pakkumisõigus tühistatud' })

    expect(url.searchParams.get('teade')).toBe('Õigus tühistatud ja kasutajat teavitatud.')
  })
})

describe('revealIsikukoodAction (audited reveal)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    useRepos(repos)
  })

  it('denies a role without users:read', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const result = await revealIsikukoodAction('user-9')
    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.creates).toEqual([])
  })

  it('reports a user without an isikukood', async () => {
    repos.docsByCollection.users = { id: 'user-9', isikukood: null }
    const result = await revealIsikukoodAction('user-9')
    expect(result).toEqual({ ok: false, error: 'Isikukood puudub.' })
  })

  it('writes the user.identity_view audit entry before the plaintext is returned', async () => {
    repos.docsByCollection.users = { id: 'user-9', isikukood: '39101010000' }
    const auditCalls: string[] = []
    repos.findByID.mockImplementation(() => {
      auditCalls.push('find:users')
      return Promise.resolve(repos.docsByCollection.users ?? null)
    })
    repos.create.mockImplementation((args: CreateArgs) => {
      auditCalls.push(`create:${String(args.data.action)}`)
      repos.creates.push(args)
      return Promise.resolve({ id: `new-${String(repos.creates.length)}`, ...args.data })
    })

    const result = await revealIsikukoodAction('user-9')

    expect(result).toEqual({ ok: true, value: '39101010000' })
    expect(auditCalls).toEqual(['find:users', 'create:user.identity_view'])
    expect(repos.creates[0]?.data).toEqual({
      actorId: 'admin-1',
      action: 'user.identity_view',
      entityType: 'user',
      entityId: 'user-9',
      after: { field: 'isikukood' },
    })
  })

  it('never returns the value when the audit write fails', async () => {
    repos.docsByCollection.users = { id: 'user-9', isikukood: '39101010000' }
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))

    const result = await revealIsikukoodAction('user-9')

    expect(result).toEqual({ ok: false, error: 'Paljastamise logimine ebaõnnestus; väärtust ei näidatud.' })
  })
})
