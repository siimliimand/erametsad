import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createLeadAction,
  mergeLeadAction,
  moveLeadStatusFormAction,
  softDeleteLeadAction,
} from '../ops'

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
  const finds: FindArgs[] = []
  const docsById: Record<string, Record<string, unknown>> = {}
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: FindArgs) => {
      finds.push(args)
      return Promise.resolve({ docs: findDocsByCollection[args.collection] ?? [] })
    }),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(docsById[args.id] ?? null),
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
    docsById,
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

const leadDoc = (overrides: Record<string, unknown>): Record<string, unknown> => ({
  id: 'lead-1',
  contactName: 'Mari Maasikas',
  phone: '+37251110000',
  email: 'mari@meil.ee',
  cadastr: null,
  countyId: null,
  status: 'new',
  assignedSpecialistId: 'spec-1',
  internalComment: null,
  ...overrides,
})

describe('lead exit guards in moveLeadStatusFormAction (task 8.2)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsById['lead-1'] = leadDoc({})
    useRepos(repos)
  })

  it('blocks moving to Võetud ühendust without the first note', async () => {
    const url = await redirectOf(() =>
      moveLeadStatusFormAction(form({ id: 'lead-1', status: 'contacted' })),
    )

    expect(url.searchParams.get('viga')).toBe('Esimene märkus on kohustuslik (vähemalt 5 tähemärki).')
    expect(repos.updates).toHaveLength(0)
  })

  it('persists the first note as a lead note when the guard passes', async () => {
    const url = await redirectOf(() =>
      moveLeadStatusFormAction(
        form({ id: 'lead-1', status: 'contacted', note: 'Helistasin, klient huvitatud' }),
      ),
    )

    expect(url.searchParams.get('teade')).toBe('Olek uuendatud.')
    expect(repos.updates).toContainEqual({
      collection: 'leads',
      id: 'lead-1',
      data: { status: 'contacted' },
    })
    const noteAudit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'lead.note',
    )
    expect(noteAudit?.data.after).toEqual({ text: 'Helistasin, klient huvitatud' })
  })

  it('blocks Leping without a reference or a note', async () => {
    repos.docsById['lead-1'] = leadDoc({ status: 'contacted' })

    const url = await redirectOf(() =>
      moveLeadStatusFormAction(form({ id: 'lead-1', status: 'contract' })),
    )

    expect(url.searchParams.get('viga')).toBe(
      'Sisestage oksjoni või lepingu viide või märkus (vähemalt 5 tähemärki).',
    )
    expect(repos.updates).toHaveLength(0)
  })

  it('lets Leping pass with a reference and records it in the audit', async () => {
    repos.docsById['lead-1'] = leadDoc({ status: 'contacted' })

    const url = await redirectOf(() =>
      moveLeadStatusFormAction(
        form({ id: 'lead-1', status: 'contract', reference: 'oksjon 42 / LP-2026-001' }),
      ),
    )

    expect(url.searchParams.get('teade')).toBe('Olek uuendatud.')
    expect(repos.updates).toContainEqual({
      collection: 'leads',
      id: 'lead-1',
      data: { status: 'contract' },
    })
    const statusAudit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'lead.status',
    )
    expect(statusAudit?.data.after).toEqual({ status: 'contract', reference: 'oksjon 42 / LP-2026-001' })
  })
})

describe('settings-driven auto-assignment in createLeadAction (task 8.2)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.findDocsByCollection.counties = [{ id: 'county-hh', name: 'Harju', code: 'HH' }]
    repos.findDocsByCollection.specialists = [
      { id: 'spec-a', name: 'Aime Mets', active: true },
      { id: 'spec-b', name: 'Boris Kask', active: true },
    ]
    useRepos(repos)
  })

  const createForm = (): FormData =>
    form({ contactName: 'Mari Maasikas', phone: '+37251110000', consent: 'on', cadastr: '78402:003:0210' })

  it('assigns the county round-robin pick when the flag is enabled', async () => {
    repos.findDocsByCollection.settings = [
      { id: 'settings-1', featureFlags: { leadAutoAssign: { enabled: true } } },
    ]
    repos.findDocsByCollection.leads = [
      { id: 'l1', assignedSpecialistId: 'spec-b', status: 'new' },
      { id: 'l2', assignedSpecialistId: 'spec-b', status: 'contacted' },
    ]

    await redirectOf(() => createLeadAction(createForm()))

    const create = repos.creates.find((entry) => entry.collection === 'leads')
    expect(create?.data.assignedSpecialistId).toBe('spec-a')
    expect(create?.data.countyId).toBe('county-hh')
    const audit = repos.creates.find(
      (entry) => entry.collection === 'audit-entry' && entry.data.action === 'lead.create_manual',
    )
    expect(audit?.data.after).toMatchObject({ assignedSpecialistId: 'spec-a', assignment: 'auto' })
  })

  it('skips assignment when the leadAutoAssign flag is disabled', async () => {
    repos.findDocsByCollection.settings = [
      { id: 'settings-1', featureFlags: { leadAutoAssign: { enabled: false } } },
    ]

    await redirectOf(() => createLeadAction(createForm()))

    const create = repos.creates.find((entry) => entry.collection === 'leads')
    expect(create?.data.assignedSpecialistId).toBeNull()
  })

  it('defaults to enabled when the settings row has no flag', async () => {
    repos.findDocsByCollection.settings = []

    await redirectOf(() => createLeadAction(createForm()))

    const create = repos.creates.find((entry) => entry.collection === 'leads')
    expect(create?.data.assignedSpecialistId).toBe('spec-a')
  })

  it('keeps a specialist-authored lead self-assigned', async () => {
    state.session = { userId: 'spec-b', role: 'specialist' }
    repos.findDocsByCollection.settings = [
      { id: 'settings-1', featureFlags: { leadAutoAssign: { enabled: true } } },
    ]

    await redirectOf(() => createLeadAction(createForm()))

    const create = repos.creates.find((entry) => entry.collection === 'leads')
    expect(create?.data.assignedSpecialistId).toBe('spec-b')
    const audit = repos.creates.find(
      (entry) => entry.collection === 'audit-entry' && entry.data.action === 'lead.create_manual',
    )
    expect(audit?.data.after).toMatchObject({ assignment: 'manual' })
  })
})

describe('mergeLeadAction (task 8.2)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsById['dup-1'] = leadDoc({
      id: 'dup-1',
      contactName: 'M. Maasikas',
      phone: '+37251119999',
      countyId: 'county-hh',
    })
    repos.docsById['target-1'] = leadDoc({ id: 'target-1', phone: null, countyId: null })
    useRepos(repos)
  })

  it('fills missing target fields and audits the merge cross-links', async () => {
    const url = await redirectOf(() =>
      mergeLeadAction(form({ id: 'dup-1', targetId: 'target-1' })),
    )

    expect(url.pathname).toBe('/admin/leads/target-1')
    expect(url.searchParams.get('teade')).toBe('Duplikaat ühendatud.')
    expect(repos.updates).toContainEqual({
      collection: 'leads',
      id: 'target-1',
      data: { countyId: 'county-hh', phone: '+37251119999' },
    })
    const mergeAudit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'lead.merge',
    )
    expect(mergeAudit?.data.entityId).toBe('dup-1')
    expect(mergeAudit?.data.after).toMatchObject({ mergedInto: 'target-1' })
    const targetAudit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'lead.merge_target',
    )
    expect(targetAudit?.data.entityId).toBe('target-1')
    expect(targetAudit?.data.after).toMatchObject({ mergedFrom: 'dup-1' })
  })

  it('keeps target values and never overwrites them with duplicate data', async () => {
    repos.docsById['target-1'] = leadDoc({
      id: 'target-1',
      phone: '+37251110000',
      email: 'kee@meil.ee',
      countyId: 'county-ta',
    })

    await redirectOf(() => mergeLeadAction(form({ id: 'dup-1', targetId: 'target-1' })))

    expect(repos.updates).toHaveLength(0)
  })

  it('refuses merging a lead into itself', async () => {
    const url = await redirectOf(() => mergeLeadAction(form({ id: 'dup-1', targetId: 'dup-1' })))

    expect(url.searchParams.get('viga')).toBe('Juhtlõiget ei saa endaga ühendada.')
  })

  it('refuses an already merged duplicate', async () => {
    repos.findDocsByCollection['audit-entry'] = [
      {
        id: 'a1',
        action: 'lead.merge',
        entityType: 'lead',
        entityId: 'dup-1',
        after: { mergedInto: 'target-1' },
      },
    ]

    const url = await redirectOf(() => mergeLeadAction(form({ id: 'dup-1', targetId: 'target-1' })))

    expect(url.searchParams.get('viga')).toBe('See juhtlõige on juba ühendatud.')
    expect(repos.updates).toHaveLength(0)
  })
})

describe('softDeleteLeadAction (task 8.2)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    repos.docsById['lead-1'] = leadDoc({})
    useRepos(repos)
  })

  it('is restricted to superadmins', async () => {
    state.session = { userId: 'admin-1', role: 'admin' }

    const url = await redirectOf(() =>
      softDeleteLeadAction(form({ id: 'lead-1', reason: 'Testkirje, duplikaat' })),
    )

    expect(url.searchParams.get('viga')).toBe('Ainult peakasutaja saab juhtlõiget kustutada.')
    expect(repos.creates).toHaveLength(0)
  })

  it('requires a typed reason', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }

    const url = await redirectOf(() => softDeleteLeadAction(form({ id: 'lead-1', reason: 'ei' })))

    expect(url.searchParams.get('viga')).toBe(
      'Kustutamise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    )
    expect(repos.creates).toHaveLength(0)
  })

  it('writes the soft-delete tombstone with the reason and keeps the row', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }

    const url = await redirectOf(() =>
      softDeleteLeadAction(form({ id: 'lead-1', reason: 'Spam-kirje, test' })),
    )

    expect(url.pathname).toBe('/admin/leads/lead-1')
    expect(url.searchParams.get('teade')).toBe('Juhtlõige pehmelt kustutatud.')
    expect(repos.updates).toHaveLength(0)
    const audit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'lead.delete',
    )
    expect(audit?.data.after).toEqual({ deleted: true, reason: 'Spam-kirje, test' })
  })
})
