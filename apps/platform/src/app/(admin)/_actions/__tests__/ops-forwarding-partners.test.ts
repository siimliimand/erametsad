import { beforeEach, describe, expect, it, vi } from 'vitest'

import { markRequestRespondedAction, setPartnerActiveAction, updatePartnerAction } from '../ops'

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

function makeRepos() {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  return {
    find: vi.fn(() => Promise.resolve({ docs: [] })),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: 'new-1', ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    updates,
    docsByCollection,
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

const partnerDoc = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'p1',
  name: 'Metsapartner OÜ',
  serviceTypes: ['kava'],
  counties: null,
  capacity: 5,
  contactEmail: 'partner@meil.ee',
  contactPhone: null,
  active: true,
  ...overrides,
})

describe('markRequestRespondedAction märkus (task 8.6)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsByCollection['service-requests'] = { id: 'req-1', status: 'routed' }
    repos.docsByCollection.partners = partnerDoc()
    useRepos(repos)
  })

  it('records the typed märkus in the audit entry', async () => {
    const url = await redirectOf(() =>
      markRequestRespondedAction(
        form({ id: 'req-1', partnerId: 'p1', note: 'Hindame ja vastame esmaspäevaks' }),
      ),
    )

    expect(url.pathname).toBe('/admin/inquiries')
    expect(url.searchParams.get('detail')).toBe('req-1')
    expect(url.searchParams.get('teade')).toBe('Partner märgitud vastanuks.')
    const audit = repos.creates.find((create) => create.collection === 'audit-entry')
    expect(audit?.data.action).toBe('request.mark_responded')
    expect(audit?.data.after).toEqual({
      partnerId: 'p1',
      partnerName: 'Metsapartner OÜ',
      note: 'Hindame ja vastame esmaspäevaks',
    })
  })

  it('omits the märkus when the field is empty', async () => {
    await redirectOf(() => markRequestRespondedAction(form({ id: 'req-1', partnerId: 'p1' })))

    const audit = repos.creates.find((create) => create.collection === 'audit-entry')
    expect(audit?.data.after).toEqual({ partnerId: 'p1', partnerName: 'Metsapartner OÜ' })
  })
})

describe('partner deactivate reason (task 8.6)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsByCollection.partners = partnerDoc({ active: true })
    useRepos(repos)
  })

  it('blocks deactivating without a typed reason', async () => {
    const url = await redirectOf(() =>
      setPartnerActiveAction(form({ id: 'p1', active: 'off' })),
    )

    expect(url.searchParams.get('viga')).toBe(
      'Deaktiveerimise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    )
    expect(repos.updates).toHaveLength(0)
  })

  it('stores the reason in the deactivate audit entry', async () => {
    const url = await redirectOf(() =>
      setPartnerActiveAction(form({ id: 'p1', active: 'off', reason: 'Lõpetasid teenuse' })),
    )

    expect(url.searchParams.get('teade')).toBe('Partner deaktiveeritud.')
    expect(repos.updates).toContainEqual({
      collection: 'partners',
      id: 'p1',
      data: { active: false },
    })
    const audit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'partner.deactivate',
    )
    expect(audit?.data.after).toEqual({ active: false, reason: 'Lõpetasid teenuse' })
  })

  it('lets reactivation pass without a reason', async () => {
    repos.docsByCollection.partners = partnerDoc({ active: false })

    const url = await redirectOf(() =>
      setPartnerActiveAction(form({ id: 'p1', active: 'on' })),
    )

    expect(url.searchParams.get('teade')).toBe('Partner aktiveeritud.')
    expect(repos.updates).toContainEqual({
      collection: 'partners',
      id: 'p1',
      data: { active: true },
    })
  })
})

describe('partner form registrikood, kontaktisik and märkus (task 8.6)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsByCollection.partners = partnerDoc()
    useRepos(repos)
  })

  const updateForm = (entries: Record<string, string>): FormData => {
    const formData = form({ id: 'p1', ...entries })
    formData.append('serviceTypes', 'kava')
    formData.append('counties', 'ALL')
    formData.set('capacity', '5')
    return formData
  }

  it('keeps the extra fields out of the table write and into the audit record', async () => {
    const url = await redirectOf(() =>
      updatePartnerAction(
        updateForm({
          name: 'Metsapartner OÜ',
          contactEmail: 'partner@meil.ee',
          regCode: '12345678',
          contactPerson: 'Karl Tamm',
          note: 'Eelistab talve töid',
        }),
      ),
    )

    expect(url.searchParams.get('teade')).toBe('Partner uuendatud.')
    const update = repos.updates[0]
    expect(update?.data).not.toHaveProperty('regCode')
    expect(update?.data).not.toHaveProperty('contactPerson')
    expect(update?.data).not.toHaveProperty('note')
    const audit = repos.creates.find(
      (create) => create.collection === 'audit-entry' && create.data.action === 'partner.update',
    )
    expect(audit?.data.after).toMatchObject({
      regCode: '12345678',
      contactPerson: 'Karl Tamm',
      note: 'Eelistab talve töid',
    })
  })

  it('rejects a registrikood that is not eight digits', async () => {
    const url = await redirectOf(() =>
      updatePartnerAction(
        updateForm({
          name: 'Metsapartner OÜ',
          contactEmail: 'partner@meil.ee',
          regCode: '12ab',
        }),
      ),
    )

    expect(url.searchParams.get('viga')).toBe('Registrikood peab koosnema 8 numbrist.')
    expect(repos.updates).toHaveLength(0)
  })
})
