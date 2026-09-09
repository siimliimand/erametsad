import { beforeEach, describe, expect, it, vi } from 'vitest'

import { closeRequestAction, markRequestDoneAction } from '../ops'

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

vi.mock('@/lib/notifications/email-sender', () => ({
  sendEmail: vi.fn(),
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

const getRepositoriesMock = vi.mocked(getRepositories)

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

function makeRepos(request: Record<string, unknown> | null) {
  const updates: UpdateArgs[] = []
  return {
    find: vi.fn(() => Promise.resolve({ docs: [] })),
    findByID: vi.fn((args: { collection: string }): Promise<unknown> =>
      Promise.resolve(
        args.collection === 'service-requests' ? request : null,
      ),
    ),
    create: vi.fn((args: { collection: string; data: Record<string, unknown> }) =>
      Promise.resolve({ id: 'audit-1', ...args.data }),
    ),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn(() => Promise.resolve(undefined)),
    updates,
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

const requestDoc = (status: string): Record<string, unknown> => ({
  id: 'req-1',
  type: 'kava',
  status,
  routedTo: ['p1'],
  payload: {},
  attachments: [],
})

describe('markRequestDoneAction (task 8.4)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
  })

  it('marks a routed request teostatud and audits the transition', async () => {
    repos = makeRepos(requestDoc('routed'))
    useRepos(repos)

    const url = await redirectOf(() => markRequestDoneAction(form({ id: 'req-1' })))

    expect(url.pathname).toBe('/admin/inquiries')
    expect(url.search).toContain('detail=req-1')
    expect(decodeURIComponent(url.search)).toContain('teade=Päring märgitud teostatuks.')
    expect(repos.updates).toContainEqual({
      collection: 'service-requests',
      id: 'req-1',
      data: { status: 'teostatud' },
    })
    const audit = await repos.create.mock.calls.find(
      (call) => call[0].collection === 'audit-entry',
    )
    expect(audit?.[0].data).toMatchObject({
      action: 'request.mark_done',
      after: { status: 'teostatud' },
    })
  })

  it('notices an already done request without rewriting it', async () => {
    repos = makeRepos(requestDoc('teostatud'))
    useRepos(repos)

    const url = await redirectOf(() => markRequestDoneAction(form({ id: 'req-1' })))

    expect(decodeURIComponent(url.search)).toContain('teade=Päring on juba teostatud.')
    expect(repos.updates).toHaveLength(0)
  })

  it('refuses to reopen a closed request', async () => {
    repos = makeRepos(requestDoc('suletud'))
    useRepos(repos)

    const url = await redirectOf(() => markRequestDoneAction(form({ id: 'req-1' })))

    expect(decodeURIComponent(url.search)).toContain(
      'viga=Päring on suletud — olekut ei saa enam muuta.',
    )
    expect(repos.updates).toHaveLength(0)
  })
})

describe('closeRequestAction (task 8.4)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
  })

  it('closes a done request and audits the transition', async () => {
    repos = makeRepos(requestDoc('teostatud'))
    useRepos(repos)

    const url = await redirectOf(() => closeRequestAction(form({ id: 'req-1' })))

    expect(decodeURIComponent(url.search)).toContain('teade=Päring suletud.')
    expect(repos.updates).toContainEqual({
      collection: 'service-requests',
      id: 'req-1',
      data: { status: 'suletud' },
    })
    const audit = await repos.create.mock.calls.find(
      (call) => call[0].collection === 'audit-entry',
    )
    expect(audit?.[0].data).toMatchObject({
      action: 'request.close',
      after: { status: 'suletud' },
    })
  })

  it('closes straight from a new request', async () => {
    repos = makeRepos(requestDoc('new'))
    useRepos(repos)

    const url = await redirectOf(() => closeRequestAction(form({ id: 'req-1' })))

    expect(decodeURIComponent(url.search)).toContain('teade=Päring suletud.')
    expect(repos.updates).toContainEqual({
      collection: 'service-requests',
      id: 'req-1',
      data: { status: 'suletud' },
    })
  })

  it('notices an already closed request without rewriting it', async () => {
    repos = makeRepos(requestDoc('suletud'))
    useRepos(repos)

    const url = await redirectOf(() => closeRequestAction(form({ id: 'req-1' })))

    expect(decodeURIComponent(url.search)).toContain('teade=Päring on juba suletud.')
    expect(repos.updates).toHaveLength(0)
  })
})
