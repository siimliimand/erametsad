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

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

import { PermissionDeniedError } from '../../_lib/permissions'
import {
  getIntegrationCheckAction,
  revealIntegrationKeyAction,
  rotateIntegrationKeyAction,
  testIntegrationConnectionAction,
} from '../settings'

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
  const row: Record<string, unknown> = settingsRow ?? {}
  let hasRow = settingsRow !== null
  return {
    find: vi.fn(() => Promise.resolve({ docs: hasRow ? [{ ...row }] : [] })),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      Object.assign(row, args.data)
      hasRow = true
      return Promise.resolve({ id: 'created-settings', ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      Object.assign(row, args.data)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    creates,
    updates,
    settingsRow: row,
    auditEntries: creates.filter((entry) => entry.collection === 'audit-entry'),
  }
}

type Repos = ReturnType<typeof makeRepos>

describe('integration connection test + rotation actions', () => {
  let repos: Repos
  const saved = {
    smtpPass: process.env.SMTP_PASS,
    cfToken: process.env.CLOUDFLARE_EMAIL_TOKEN,
    cfAccount: process.env.CLOUDFLARE_ACCOUNT_ID,
    mapTileUrl: process.env.MAP_TILE_URL,
  }

  beforeEach(() => {
    state.session = { userId: 'superadmin-1', role: 'superadmin' }
    repos = makeRepos({ id: 'settings-1' })
    state.repositories = repos
    delete process.env.SMTP_PASS
    delete process.env.CLOUDFLARE_EMAIL_TOKEN
    delete process.env.CLOUDFLARE_ACCOUNT_ID
    delete process.env.MAP_TILE_URL
  })

  afterEach(() => {
    if (saved.smtpPass === undefined) delete process.env.SMTP_PASS
    else process.env.SMTP_PASS = saved.smtpPass
    if (saved.cfToken === undefined) delete process.env.CLOUDFLARE_EMAIL_TOKEN
    else process.env.CLOUDFLARE_EMAIL_TOKEN = saved.cfToken
    if (saved.cfAccount === undefined) delete process.env.CLOUDFLARE_ACCOUNT_ID
    else process.env.CLOUDFLARE_ACCOUNT_ID = saved.cfAccount
    if (saved.mapTileUrl === undefined) delete process.env.MAP_TILE_URL
    else process.env.MAP_TILE_URL = saved.mapTileUrl
    vi.unstubAllGlobals()
  })

  const auditAfter = (): Record<string, unknown> => {
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    if (!audit) throw new Error('expected an audit entry')
    return audit.data.after as Record<string, unknown>
  }

  const persistedChecks = (): Record<string, unknown> => {
    const flags = repos.updates.at(-1)?.data.featureFlags as Record<string, unknown>
    return flags.integrationChecks as Record<string, unknown>
  }

  describe('testIntegrationConnectionAction', () => {
    it('passes a presence probe, persists the check and audits without any live call', async () => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      process.env.SMTP_PASS = 'mailpass'

      const result = await testIntegrationConnectionAction('smtp')

      expect(fetchMock).not.toHaveBeenCalled()
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.latencyMs).toBeGreaterThanOrEqual(0)
      expect(Number.isNaN(new Date(result.checkedAt).getTime())).toBe(false)
      expect(persistedChecks().smtp).toMatchObject({ ok: true })
      expect(auditAfter()).toMatchObject({
        integrationCheck: { key: 'smtp', ok: true },
      })
    })

    it('fails a presence probe without the credential and persists the failure', async () => {
      const result = await testIntegrationConnectionAction('smtp')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Võti pole seadistatud.')
      expect(persistedChecks().smtp).toMatchObject({ ok: false, error: 'Võti pole seadistatud.' })
    })

    it('runs the map HTTP probe against the tile URL override and defaults to OpenStreetMap', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
      vi.stubGlobal('fetch', fetchMock)
      process.env.MAP_TILE_URL = 'https://tiles.example.com/'

      const overridden = await testIntegrationConnectionAction('map')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://tiles.example.com/',
        expect.objectContaining({ method: 'GET' }),
      )
      expect(overridden.ok).toBe(true)

      delete process.env.MAP_TILE_URL
      fetchMock.mockClear()
      await testIntegrationConnectionAction('map')
      expect(fetchMock).toHaveBeenCalledWith(
        'https://tile.openstreetmap.org/',
        expect.anything(),
      )
    })

    it('sends the bearer token for the e-mail probe and reports the HTTP failure', async () => {
      const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 500 })))
      vi.stubGlobal('fetch', fetchMock)
      process.env.CLOUDFLARE_EMAIL_TOKEN = 'tok-1'
      process.env.CLOUDFLARE_ACCOUNT_ID = 'acc-1'

      const result = await testIntegrationConnectionAction('cloudflare-email')

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.cloudflare.com/client/v4/user/tokens/verify',
        expect.objectContaining({ headers: { authorization: 'Bearer tok-1' } }),
      )
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Test ebaõnnestus: HTTP 500.')
      expect(persistedChecks()['cloudflare-email']).toMatchObject({ ok: false })
    })

    it('reports a network failure from the HTTP probe', async () => {
      vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('fetch failed'))))

      const result = await testIntegrationConnectionAction('map')

      expect(result.ok).toBe(false)
      expect(result.error).toContain('fetch failed')
    })

    it('returns an error result for an unknown key', async () => {
      const result = await testIntegrationConnectionAction('nope')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Tundmatu võti.')
    })

    it('denies roles without settings:write, including admin (D-6 read-only tier)', async () => {
      for (const role of ['admin', 'specialist'] as const) {
        state.session = { userId: `${role}-1`, role }
        await expect(testIntegrationConnectionAction('smtp')).rejects.toBeInstanceOf(
          PermissionDeniedError,
        )
      }
      expect(repos.updates).toEqual([])
    })
  })

  describe('getIntegrationCheckAction', () => {
    it('returns the persisted check after a test and null before it', async () => {
      expect(await getIntegrationCheckAction('smtp')).toBeNull()

      const result = await testIntegrationConnectionAction('smtp')
      expect(await getIntegrationCheckAction('smtp')).toMatchObject({
        ok: result.ok,
        checkedAt: result.checkedAt,
      })
    })
  })

  describe('rotateIntegrationKeyAction (write-only)', () => {
    it('stores the rotated value and never writes it to the audit trail', async () => {
      const result = await rotateIntegrationKeyAction('smtp', 'brand-new-secret', 'võtme leke kahtlus')

      expect(result.ok).toBe(true)
      const flags = repos.updates[0]?.data.featureFlags as Record<string, unknown>
      const secrets = flags.integrationKeySecrets as Record<string, unknown>
      expect(secrets.smtp).toBe('brand-new-secret')
      const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
      expect(audit?.data).toMatchObject({
        action: 'settings.change',
        entityId: 'smtp',
        after: { key: 'smtp', rotated: true, reason: 'võtme leke kahtlus' },
      })
      expect(JSON.stringify(audit?.data)).not.toContain('brand-new-secret')
    })

    it('creates the settings row when none exists yet', async () => {
      repos = makeRepos(null)
      state.repositories = repos

      const result = await rotateIntegrationKeyAction('smtp', 'brand-new-secret', 'võtme leke kahtlus')

      expect(result.ok).toBe(true)
      expect(repos.updates).toEqual([])
      const flags = repos.creates[0]?.data.featureFlags as Record<string, unknown>
      expect((flags.integrationKeySecrets as Record<string, unknown>).smtp).toBe('brand-new-secret')
    })

    it('requires a valid reason', async () => {
      const result = await rotateIntegrationKeyAction('smtp', 'brand-new-secret', 'ei')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Põhjendus peab olema vähemalt 5 tähemärki.')
      expect(repos.updates).toEqual([])
      expect(repos.creates).toEqual([])
    })

    it('rejects an empty new value', async () => {
      const result = await rotateIntegrationKeyAction('smtp', '   ', 'võtme leke kahtlus')

      expect(result.ok).toBe(false)
      expect(result.error).toBe('Uus võti on tühi.')
      expect(repos.updates).toEqual([])
    })

    it('returns an error result for an unknown key', async () => {
      const result = await rotateIntegrationKeyAction('nope', 'x-secret', 'võtme leke kahtlus')
      expect(result.ok).toBe(false)
      expect(result.error).toBe('Tundmatu võti.')
    })

    it('makes the rotated value win over the env var in the audited reveal', async () => {
      process.env.SMTP_PASS = 'env-secret'
      await rotateIntegrationKeyAction('smtp', 'rotated-secret', 'võtme leke kahtlus')

      const revealed = await revealIntegrationKeyAction('smtp')

      expect(revealed).toMatchObject({ ok: true, value: 'rotated-secret' })
      const audits = repos.creates.filter((entry) => entry.collection === 'audit-entry')
      expect(audits.at(-1)?.data).toMatchObject({
        action: 'settings.key_reveal',
        entityId: 'smtp',
        after: { key: 'smtp', source: 'settings' },
      })
      expect(JSON.stringify(audits.at(-1)?.data)).not.toContain('rotated-secret')
    })

    it('marks the audit source as env when no rotation is stored', async () => {
      process.env.SMTP_PASS = 'env-secret'

      const revealed = await revealIntegrationKeyAction('smtp')

      expect(revealed).toMatchObject({ ok: true, value: 'env-secret' })
      const audits = repos.creates.filter((entry) => entry.collection === 'audit-entry')
      expect(audits.at(-1)?.data.after).toMatchObject({ key: 'smtp', source: 'env' })
    })
  })
})
