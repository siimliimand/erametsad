import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createLeadAction, setLeadCountyAction } from '../ops'

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

interface FindArgs {
  collection: string
  where?: unknown
}

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  const finds: FindArgs[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: FindArgs) => {
      finds.push(args)
      return Promise.resolve({ docs: findDocsByCollection[args.collection] ?? [] })
    }),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: 'lead-new', ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    updates,
    finds,
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

describe('createLeadAction county derivation (task 8.1)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    useRepos(repos)
  })

  it('derives the county from the first cadastre at save time', async () => {
    repos.findDocsByCollection.counties = [{ id: 'county-hh', name: 'Harju', code: 'HH' }]

    const url = await redirectOf(() =>
      createLeadAction(
        form({
          contactName: 'Mari Maasikas',
          phone: '+37251110000',
          consent: 'on',
          cadastr: '78402:003:0210, 78904:101:0123',
        }),
      ),
    )

    expect(url.pathname).toBe('/admin/leads/lead-new')
    expect(repos.finds).toContainEqual({
      collection: 'counties',
      where: { code: { equals: 'HH' } },
      limit: 1,
    })
    const create = repos.creates.find((entry) => entry.collection === 'leads')
    expect(create?.collection).toBe('leads')
    expect(create?.data.countyId).toBe('county-hh')
    expect(create?.data.cadastr).toBe('78402:003:0210, 78904:101:0123')
  })

  it('leaves the county unset when there is no cadastre or no matching county row', async () => {
    await redirectOf(() =>
      createLeadAction(
        form({ contactName: 'Mari Maasikas', phone: '+37251110000', consent: 'on' }),
      ),
    )
    expect(repos.finds).toHaveLength(0)

    repos.findDocsByCollection.counties = []
    await redirectOf(() =>
      createLeadAction(
        form({
          contactName: 'Mari Maasikas',
          phone: '+37251110000',
          consent: 'on',
          cadastr: '99999:999:9999',
        }),
      ),
    )

    const leadCreates = repos.creates.filter((create) => create.collection === 'leads')
    expect(leadCreates).toHaveLength(2)
    expect(leadCreates[0]?.data.countyId).toBeNull()
    expect(leadCreates[1]?.data.countyId).toBeNull()
  })
})

describe('setLeadCountyAction (task 8.1)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsByCollection.leads = {
      id: 'lead-1',
      contactName: 'Mari Maasikas',
      assignedSpecialistId: null,
      countyId: null,
    }
    useRepos(repos)
  })

  it('stores the manual county override and audits it', async () => {
    repos.docsByCollection.counties = { id: 'county-ta', name: 'Tartu', code: 'TA' }

    const url = await redirectOf(() =>
      setLeadCountyAction(form({ id: 'lead-1', countyId: 'county-ta' })),
    )

    expect(url.pathname).toBe('/admin/leads/lead-1')
    expect(url.searchParams.get('teade')).toBe('Maakond määratud.')
    expect(repos.updates).toContainEqual({
      collection: 'leads',
      id: 'lead-1',
      data: { countyId: 'county-ta' },
    })
    const audit = repos.creates.find((create) => create.collection === 'audit-entry')
    expect(audit?.data.action).toBe('lead.county')
  })

  it('clears the county when the select is reset to Määramata', async () => {
    repos.docsByCollection.leads = {
      id: 'lead-1',
      contactName: 'Mari Maasikas',
      assignedSpecialistId: null,
      countyId: 'county-ta',
    }

    const url = await redirectOf(() => setLeadCountyAction(form({ id: 'lead-1', countyId: '' })))

    expect(url.searchParams.get('teade')).toBe('Maakond määratud.')
    expect(repos.updates).toContainEqual({
      collection: 'leads',
      id: 'lead-1',
      data: { countyId: null },
    })
  })

  it('rejects an unknown county id without updating the lead', async () => {
    const url = await redirectOf(() =>
      setLeadCountyAction(form({ id: 'lead-1', countyId: 'county-404' })),
    )

    expect(url.searchParams.get('viga')).toBe('Maakonda ei leitud.')
    expect(repos.updates).toHaveLength(0)
  })
})
