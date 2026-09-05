import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CoreRepositories } from '@/lib/data/repositories'

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

const state = vi.hoisted(() => ({
  session: { userId: 'admin-1', role: 'admin' } as { userId: string; role: string },
  repositories: null as unknown,
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
  requireAdminRepositories: vi.fn(async () => ({
    session: state.session,
    repositories: state.repositories,
  })),
}))

import { PermissionDeniedError } from '../../_lib/permissions'
import { updateSettingsAction } from '../content'

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

function makeRepos(settingsRow: Record<string, unknown> | null) {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  return {
    find: vi.fn(async () => ({ docs: settingsRow ? [settingsRow] : [] })),
    findByID: vi.fn(async () => null),
    create: vi.fn(async (args: CreateArgs) => {
      creates.push(args)
      return { id: 'created-settings', ...args.data }
    }),
    update: vi.fn(async (args: UpdateArgs) => {
      updates.push(args)
      return { id: args.id, ...args.data }
    }),
    delete: vi.fn(async () => undefined),
    creates,
    updates,
    settingsRow,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos as unknown as CoreRepositories
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

const SETTINGS_PATH = '/admin/content/settings'

describe('updateSettingsAction (audited saves)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos({ id: 'settings-1' })
    useRepos(repos)
  })

  it('rejects an unknown section', async () => {
    const url = await redirectOf(() =>
      updateSettingsAction(form({ section: 'muu', reason: 'seadete muutus' })),
    )
    expect(url.searchParams.get('viga')).toBe('Tundmatu seadete sektsioon.')
  })

  it('refuses a save without a valid reason', async () => {
    const url = await redirectOf(() =>
      updateSettingsAction(form({ section: 'tasud', reason: 'ei', feePercent: '5', vatPercent: '22' })),
    )
    expect(url.searchParams.get('viga')).toBe('Põhjendus peab olema vähemalt 5 tähemärki.')
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('denies a role without settings:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    await expect(
      updateSettingsAction(form({ section: 'tasud', reason: 'seadete muutus' })),
    ).rejects.toBeInstanceOf(PermissionDeniedError)
    expect(repos.updates).toEqual([])
  })

  it('saves the fees with before/after values and the reason in the audit entry', async () => {
    repos.settingsRow.feePercent = 3
    repos.settingsRow.vatPercent = 22

    const url = await redirectOf(() =>
      updateSettingsAction(form({ section: 'tasud', reason: 'vahendustasu tõstetud', feePercent: '5', vatPercent: '22' })),
    )

    expect(repos.updates[0]).toMatchObject({
      collection: 'settings',
      id: 'settings-1',
      data: { feePercent: 5, vatPercent: 22 },
    })
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'settings.change',
      entityType: 'settings',
      entityId: 'settings-1',
      before: { feePercent: 3, vatPercent: 22, reason: 'vahendustasu tõstetud' },
      after: { feePercent: 5, vatPercent: 22, reason: 'vahendustasu tõstetud' },
    })
    expect(url.pathname).toBe(SETTINGS_PATH)
    expect(url.searchParams.get('ok')).toBe('tasud')
  })

  it('saves the Oksjonid defaults into the reserved flag key and audits both snapshots', async () => {
    repos.settingsRow.featureFlags = { auctionDefaults: { old: true } }

    await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'oksjonid',
          reason: 'oksjonide vaikeväärtused',
          antiSnipeDurationMinutes: '7',
          sealedRevisionCap: '2',
          alapakkumineDecisionDeadlineDays: '7',
          kiiroksjonDurationHours: '48',
          sealedApproverRole: 'admin',
          alapakkumineEnabled: 'true',
        }),
      ),
    )

    const update = repos.updates[0]
    expect(update?.data).toMatchObject({
      antiSnipeDurationMinutes: 7,
      sealedRevisionCap: 2,
      alapakkumineEnabled: true,
    })
    expect(update?.data.featureFlags).toEqual({
      auctionDefaults: {
        alapakkumineDecisionDeadlineDays: 7,
        kiiroksjonDurationHours: 48,
        sealedApproverRole: 'admin',
      },
    })
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data.before).toMatchObject({
      antiSnipeDurationMinutes: null,
      alapakkumineEnabled: null,
      auctionDefaults: { old: true },
      reason: 'oksjonide vaikeväärtused',
    })
    expect(audit?.data.after).toMatchObject({
      antiSnipeDurationMinutes: 7,
      alapakkumineEnabled: true,
      reason: 'oksjonide vaikeväärtused',
    })
  })

  it('rejects an alapakkumine deadline outside the spec bounds', async () => {
    const url = await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'oksjonid',
          reason: 'oksjonide vaikeväärtused',
          antiSnipeDurationMinutes: '5',
          sealedRevisionCap: '3',
          alapakkumineDecisionDeadlineDays: '20',
          kiiroksjonDurationHours: '48',
          sealedApproverRole: 'admin',
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe('Alapakkumise otsuse tähtaeg peab olema täisarv vahemikus 1 kuni 14.')
    expect(repos.updates).toEqual([])
  })

  it('masks secret flag values in both audit snapshots while preserving the reserved defaults', async () => {
    repos.settingsRow.featureFlags = { auctionDefaults: { kiiroksjonDurationHours: 48 } }

    await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'lipud',
          reason: 'lippude uuendus',
          featureFlags: '{"apiToken":"sekret","map_view":true}',
        }),
      ),
    )

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    const before = audit?.data.before as { featureFlags: Record<string, unknown>; reason: string }
    const after = audit?.data.after as { featureFlags: Record<string, unknown>; reason: string }
    expect(before.featureFlags).toEqual({ auctionDefaults: { kiiroksjonDurationHours: 48 } })
    expect(before.reason).toBe('lippude uuendus')
    expect(after.featureFlags).toEqual({
      apiToken: '<salajane>',
      map_view: true,
      auctionDefaults: { kiiroksjonDurationHours: 48 },
    })
    expect(after.reason).toBe('lippude uuendus')
  })

  it('creates the settings row when none exists yet', async () => {
    repos = makeRepos(null)
    useRepos(repos)

    const url = await redirectOf(() =>
      updateSettingsAction(form({ section: 'tasud', reason: 'esmased sätted', feePercent: '3', vatPercent: '22' })),
    )

    expect(repos.updates).toEqual([])
    expect(repos.creates[0]?.collection).toBe('settings')
    expect(repos.creates[0]?.data).toMatchObject({ feePercent: 3, vatPercent: 22 })
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data.after).toMatchObject({ feePercent: 3, reason: 'esmased sätted' })
    expect(url.searchParams.get('ok')).toBe('tasud')
  })
})
