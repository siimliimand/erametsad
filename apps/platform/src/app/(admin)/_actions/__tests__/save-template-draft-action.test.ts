import { revalidatePath } from 'next/cache'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveTemplateDraftAction } from '../contracts'

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

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

interface FindArgs {
  collection: string
  where?: unknown
  sort?: string
  limit?: number
  pagination?: boolean
}

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface FindByIdArgs {
  collection: string
  id: string
}

function templateRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'tpl-1',
    name: 'Raamleping 2026',
    type: 'framework',
    version: '3.1',
    placeholders: [{ key: 'bidder.name' }],
    docxFileId: null,
    sourceContent: null,
    sourceFormat: null,
    active: true,
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...overrides,
  }
}

function makeRepos(headRow: Record<string, unknown>, versionRows: Record<string, unknown>[]) {
  const creates: CreateArgs[] = []
  return {
    find: vi.fn((args: FindArgs) => {
      if (args.collection === 'contract-templates') {
        return Promise.resolve({ docs: versionRows })
      }
      return Promise.resolve({ docs: [] })
    }),
    findByID: vi.fn((args: FindByIdArgs) =>
      Promise.resolve(args.collection === 'contract-templates' && args.id === headRow.id ? headRow : null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `created-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((_args?: unknown) => Promise.resolve(undefined)),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
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

const TEMPLATES_PATH = '/admin/contracts/templates'
const CONTRACTS_PATH = '/admin/contracts'
const SOURCE = '<p>Uus lähtetekst {{bidder.name}}</p>'

describe('saveTemplateDraftAction (editor draft save)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos(templateRow(), [
      templateRow(),
      templateRow({ id: 'tpl-0', version: '2.0', active: false, updatedAt: '2026-08-01T09:00:00.000Z' }),
    ])
    useRepos(repos)
  })

  it('denies a role without contracts:write and writes nothing', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const url = await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'html', version: '3.2' })),
    )

    expect(url.pathname).toBe(TEMPLATES_PATH)
    expect(url.searchParams.get('viga')).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
    expect(repos.creates).toEqual([])
  })

  it('creates a NEW inactive row copying name, type and placeholders from the head', async () => {
    const url = await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'html', version: '3.2' })),
    )

    expect(repos.creates[0]).toMatchObject({
      collection: 'contract-templates',
      data: {
        name: 'Raamleping 2026',
        type: 'framework',
        version: '3.2',
        placeholders: [{ key: 'bidder.name' }],
        sourceContent: SOURCE,
        sourceFormat: 'html',
        active: false,
      },
    })
    expect(url.pathname).toBe(TEMPLATES_PATH)
    expect(url.searchParams.get('teade')).toBe('Mustand salvestatud (versioon 3.2).')
    expect(url.searchParams.get('viga')).toBeNull()
  })

  it('stores a TXT draft with its declared format', async () => {
    await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: 'Lepingu tingimused', sourceFormat: 'txt', version: '3.2' })),
    )

    expect(repos.creates[0]?.data).toMatchObject({
      sourceContent: 'Lepingu tingimused',
      sourceFormat: 'txt',
      active: false,
    })
  })

  it('writes the template.draft_save audit entry for the created row', async () => {
    await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'html', version: '3.2' })),
    )

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'template.draft_save',
      entityType: 'contract-template',
      entityId: 'created-1',
      after: {
        name: 'Raamleping 2026',
        type: 'framework',
        version: '3.2',
        sourceFormat: 'html',
        bytes: SOURCE.length,
        baseTemplateId: 'tpl-1',
      },
    })
  })

  it('revalidates the templates and contracts lists after a successful save', async () => {
    await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'html', version: '3.2' })),
    )

    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(TEMPLATES_PATH)
    expect(vi.mocked(revalidatePath)).toHaveBeenCalledWith(CONTRACTS_PATH)
  })

  it('rejects an empty version before touching the repositories', async () => {
    const url = await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'html', version: '   ' })),
    )

    expect(url.searchParams.get('viga')).toBe('Sisesta versiooninumber.')
    expect(repos.creates).toEqual([])
    expect(repos.findByID).not.toHaveBeenCalled()
  })

  it('rejects a version already used anywhere in the same template name group', async () => {
    const url = await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'html', version: '2.0' })),
    )

    expect(url.searchParams.get('viga')).toBe('Versioon "2.0" on selle malli jaoks juba kasutusel.')
    expect(repos.creates).toEqual([])
  })

  it('rejects an invalid source format', async () => {
    const url = await redirectOf(() =>
      saveTemplateDraftAction(form({ id: 'tpl-1', sourceContent: SOURCE, sourceFormat: 'pdf', version: '3.2' })),
    )

    expect(url.searchParams.get('viga')).toBe('Vali lähtevorming: HTML või TXT.')
    expect(repos.creates).toEqual([])
  })
})
