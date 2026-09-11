import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
  // Settings writes are superadmin-only since the D-6 tier split.
  session: { userId: 'superadmin-1', role: 'superadmin' },
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

vi.mock('../../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

import {
  revealIntegrationKeyAction,
  saveSocialLinksAction,
  setMaintenanceModeAction,
} from '../../../_actions/settings'
import { PermissionDeniedError } from '../../../_lib/permissions'

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
  // Non-null alias so tests can mutate the row without narrowing.
  const row: Record<string, unknown> = settingsRow ?? {}
  return {
    find: vi.fn(() => Promise.resolve({ docs: settingsRow ? [settingsRow] : [] })),
    findByID: vi.fn((_args?: unknown) => Promise.resolve(null)),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: 'created-settings', ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    updates,
    settingsRow: row,
  }
}

type Repos = ReturnType<typeof makeRepos>

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

const SETTINGS_PATH = '/admin/settings'

describe('setMaintenanceModeAction', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'superadmin-1', role: 'superadmin' }
    repos = makeRepos({ id: 'settings-1', maintenanceEnabled: false })
    state.repositories = repos
  })

  function auditEntries(): CreateArgs[] {
    return repos.creates.filter((entry) => entry.collection === 'audit-entry')
  }

  it('denies roles without settings:write, including admin (D-6 read-only tier)', async () => {
    for (const role of ['admin', 'specialist'] as const) {
      state.session = { userId: `${role}-1`, role }
      await expect(
        setMaintenanceModeAction(form({ enabled: 'true', confirm: 'HOOLDUS', reason: 'hooldustööd käivad' })),
      ).rejects.toBeInstanceOf(PermissionDeniedError)
    }

    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('refuses to enable without a valid reason', async () => {
    const url = await redirectOf(() =>
      setMaintenanceModeAction(form({ enabled: 'true', confirm: 'HOOLDUS', reason: 'ei' })),
    )

    expect(url.searchParams.get('viga')).toBe('Põhjendus peab olema vähemalt 5 tähemärki.')
    expect(repos.updates).toEqual([])
    expect(auditEntries()).toEqual([])
  })

  it('refuses to enable without the typed confirm word', async () => {
    const url = await redirectOf(() =>
      setMaintenanceModeAction(form({ enabled: 'true', confirm: 'PEATU', reason: 'plaanitud hooldus' })),
    )

    expect(url.searchParams.get('viga')).toBe(
      'Kinnitussõna ei sobi. Trüki HOOLDUS, et hooldusrežiimi sisse lülitada.',
    )
    expect(repos.updates).toEqual([])
    expect(auditEntries()).toEqual([])
  })

  it('redirects when maintenance is already enabled', async () => {
    repos.settingsRow.maintenanceEnabled = true

    const url = await redirectOf(() =>
      setMaintenanceModeAction(form({ enabled: 'true', confirm: 'HOOLDUS', reason: 'hooldus käib juba' })),
    )

    expect(url.searchParams.get('viga')).toBe('Hooldusrežiim on juba sisse lülitatud.')
    expect(repos.updates).toEqual([])
    expect(auditEntries()).toEqual([])
  })

  it('saves the flag and writes a maintenance.start audit entry with the reason', async () => {
    const url = await redirectOf(() =>
      setMaintenanceModeAction(form({ enabled: 'true', confirm: 'HOOLDUS', reason: 'plaanitud hooldus' })),
    )

    expect(repos.updates[0]).toMatchObject({
      collection: 'settings',
      id: 'settings-1',
      data: { maintenanceEnabled: true },
    })
    expect(auditEntries()[0]?.data).toMatchObject({
      actorId: 'superadmin-1',
      action: 'maintenance.start',
      entityType: 'settings',
      entityId: 'settings-1',
      before: { maintenanceEnabled: false, reason: 'plaanitud hooldus' },
      after: { maintenanceEnabled: true, reason: 'plaanitud hooldus' },
    })
    expect(url.pathname).toBe(SETTINGS_PATH)
    expect(url.searchParams.get('viga')).toBeNull()
  })

  it('enables without a confirm word when the flag is case-insensitively typed', async () => {
    await redirectOf(() =>
      setMaintenanceModeAction(form({ enabled: 'true', confirm: 'hooldus', reason: 'väiketähed lähevad' })),
    )

    expect(repos.updates[0]?.data).toMatchObject({ maintenanceEnabled: true })
    expect(auditEntries()[0]?.data).toMatchObject({ action: 'maintenance.start' })
  })

  it('writes a maintenance.end audit entry when disabling needs no confirm word or reason', async () => {
    repos.settingsRow.maintenanceEnabled = true

    const url = await redirectOf(() => setMaintenanceModeAction(form({ enabled: 'false' })))

    expect(repos.updates[0]).toMatchObject({
      collection: 'settings',
      id: 'settings-1',
      data: { maintenanceEnabled: false },
    })
    expect(auditEntries()[0]?.data).toMatchObject({
      actorId: 'superadmin-1',
      action: 'maintenance.end',
      entityType: 'settings',
      entityId: 'settings-1',
      before: { maintenanceEnabled: true },
      after: { maintenanceEnabled: false },
    })
    expect(url.pathname).toBe(SETTINGS_PATH)
  })

  it('creates the settings row when none exists yet', async () => {
    repos = makeRepos(null)
    state.repositories = repos

    await redirectOf(() =>
      setMaintenanceModeAction(form({ enabled: 'true', confirm: 'HOOLDUS', reason: 'esimene hooldus' })),
    )

    expect(repos.updates).toEqual([])
    expect(repos.creates[0]).toMatchObject({
      collection: 'settings',
      data: { maintenanceEnabled: true },
    })
    expect(auditEntries()[0]?.data).toMatchObject({
      action: 'maintenance.start',
      entityId: 'settings',
      after: { maintenanceEnabled: true, reason: 'esimene hooldus' },
    })
  })
})

describe('revealIntegrationKeyAction', () => {
  const SECRET = 'salajane-eideasy-voti'
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'superadmin-9', role: 'superadmin' }
    repos = makeRepos({ id: 'settings-1' })
    state.repositories = repos
    vi.stubEnv('EIDEASY_SECRET', SECRET)
    vi.stubEnv('SMTP_PASS', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  function auditEntries(): CreateArgs[] {
    return repos.creates.filter((entry) => entry.collection === 'audit-entry')
  }

  it('returns the raw value to an authorized admin and audits the key name', async () => {
    const result = await revealIntegrationKeyAction('eideasy')

    expect(result).toEqual({ ok: true, value: SECRET })
    expect(auditEntries()[0]?.data).toMatchObject({
      actorId: 'superadmin-9',
      action: 'settings.key_reveal',
      entityType: 'settings',
      entityId: 'eideasy',
      after: { key: 'eideasy', env: 'EIDEASY_SECRET' },
    })
  })

  it('keeps the raw value out of the audit entry', async () => {
    await revealIntegrationKeyAction('eideasy')

    expect(JSON.stringify(repos.creates)).not.toContain(SECRET)
  })

  it('rejects an unknown key id without auditing', async () => {
    const result = await revealIntegrationKeyAction('pole-olemas')

    expect(result).toEqual({ ok: false, error: 'Tundmatu võti.' })
    expect(auditEntries()).toEqual([])
  })

  it('reports an unconfigured key without auditing', async () => {
    const result = await revealIntegrationKeyAction('smtp')

    expect(result).toEqual({ ok: false, error: 'Võti pole seadistatud.' })
    expect(auditEntries()).toEqual([])
  })

  it('denies a role without settings:write', async () => {
    state.session = { userId: 'seller-1', role: 'seller' }

    await expect(revealIntegrationKeyAction('eideasy')).rejects.toBeInstanceOf(
      PermissionDeniedError,
    )
    expect(auditEntries()).toEqual([])
  })
})

describe('saveSocialLinksAction', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'superadmin-1', role: 'superadmin' }
    repos = makeRepos({
      id: 'settings-1',
      featureFlags: {
        requireFrameworkContract: true,
        auctionDefaults: { sealedApproverRole: 'admin' },
      },
    })
    state.repositories = repos
  })

  function auditEntries(): CreateArgs[] {
    return repos.creates.filter((entry) => entry.collection === 'audit-entry')
  }

  const input = (
    overrides: Partial<{
      facebookUrl: string
      instagramUrl: string
      youtubeUrl: string
      reason: string
    }> = {},
  ) => ({
    facebookUrl: 'https://facebook.com/erametsad',
    instagramUrl: '',
    youtubeUrl: '',
    reason: 'kanalite seadistamine',
    ...overrides,
  })

  it('denies roles without settings:write, including admin (D-6 read-only tier)', async () => {
    for (const role of ['admin', 'specialist'] as const) {
      state.session = { userId: `${role}-1`, role }
      await expect(
        saveSocialLinksAction(input({ reason: 'puuduv õigus' })),
      ).rejects.toBeInstanceOf(PermissionDeniedError)
    }

    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('refuses a short reason without writing', async () => {
    const result = await saveSocialLinksAction(input({ reason: 'ei' }))

    expect(result).toEqual({ ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' })
    expect(repos.updates).toEqual([])
    expect(auditEntries()).toEqual([])
  })

  it('rejects a value that is not a URL', async () => {
    const result = await saveSocialLinksAction(input({ facebookUrl: 'mitte-url' }))

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Facebooki link')
    expect(repos.updates).toEqual([])
    expect(auditEntries()).toEqual([])
  })

  it('rejects javascript: URLs', async () => {
    const result = await saveSocialLinksAction(input({ instagramUrl: 'javascript:alert(1)' }))

    expect(result.ok).toBe(false)
    expect(result.error).toContain('Instagrami link')
    expect(repos.updates).toEqual([])
    expect(auditEntries()).toEqual([])
  })

  it('merges the three keys into the existing flags, trimmed, and audits the change', async () => {
    const result = await saveSocialLinksAction(
      input({
        facebookUrl: '  https://facebook.com/erametsad  ',
        youtubeUrl: 'https://youtube.com/@erametsad',
      }),
    )

    expect(result).toEqual({ ok: true })
    expect(repos.updates[0]).toMatchObject({ collection: 'settings', id: 'settings-1' })
    const flags = repos.updates[0]?.data.featureFlags as Record<string, unknown>
    expect(flags.requireFrameworkContract).toBe(true)
    expect(flags.auctionDefaults).toMatchObject({ sealedApproverRole: 'admin' })
    expect(flags['social.facebook_url']).toBe('https://facebook.com/erametsad')
    expect(flags['social.instagram_url']).toBe('')
    expect(flags['social.youtube_url']).toBe('https://youtube.com/@erametsad')
    expect(auditEntries()[0]?.data).toMatchObject({
      actorId: 'superadmin-1',
      action: 'settings.change',
      entityType: 'settings',
      entityId: 'settings-1',
      before: { socialLinks: { facebook: '', instagram: '', youtube: '' } },
      after: {
        socialLinks: {
          facebook: 'https://facebook.com/erametsad',
          instagram: '',
          youtube: 'https://youtube.com/@erametsad',
        },
      },
    })
  })

  it('creates the settings row when none exists yet', async () => {
    repos = makeRepos(null)
    state.repositories = repos

    const result = await saveSocialLinksAction(input())

    expect(result).toEqual({ ok: true })
    expect(repos.updates).toEqual([])
    expect(repos.creates[0]).toMatchObject({ collection: 'settings' })
    expect(repos.creates[0]?.data.featureFlags).toMatchObject({
      'social.facebook_url': 'https://facebook.com/erametsad',
    })
  })
})
