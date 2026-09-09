import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const SETTINGS_PATH = '/admin/settings'

describe('updateSettingsAction (audited saves)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'superadmin-1', role: 'superadmin' }
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

  it('denies roles without settings:write, including admin (D-6 read-only tier)', async () => {
    for (const role of ['admin', 'specialist'] as const) {
      state.session = { userId: `${role}-1`, role }
      await expect(
        updateSettingsAction(form({ section: 'tasud', reason: 'seadete muutus' })),
      ).rejects.toBeInstanceOf(PermissionDeniedError)
    }
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
      actorId: 'superadmin-1',
      action: 'settings.change',
      entityType: 'settings',
      entityId: 'settings-1',
      before: { feePercent: 3, vatPercent: 22, reason: 'vahendustasu tõstetud' },
      after: { feePercent: 5, vatPercent: 22, reason: 'vahendustasu tõstetud' },
    })
    expect(url.pathname).toBe(SETTINGS_PATH)
    expect(url.searchParams.get('ok')).toBe('tasud')
  })

  it('rejects fees outside the 0-10 percent bounds', async () => {
    for (const feePercent of ['11', '-1', '100']) {
      const url = await redirectOf(() =>
        updateSettingsAction(
          form({ section: 'tasud', reason: 'seadete muutus', feePercent, vatPercent: '22' }),
        ),
      )
      expect(url.searchParams.get('viga')).toBe('Vahendustasu peab olema täisarv vahemikus 0 kuni 10.')
    }
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('saves Üldandmed contact fields with the audit diff', async () => {
    repos.settingsRow.orgName = 'Erametsad OÜ'

    const url = await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'uldine',
          reason: 'kontaktandmete uuendus',
          orgName: 'Erametsad OÜ',
          orgRegCode: '10128615',
          orgVatCode: 'EE101286155',
          orgAddress: 'Tartu mnt 1',
          supportEmail: 'support@erametsad.ee',
          supportPhone: '+372 5555 5555',
          aliasDomain: 'oksjonid.erametsad.ee',
        }),
      ),
    )

    expect(repos.updates[0]).toMatchObject({
      collection: 'settings',
      data: {
        orgVatCode: 'EE101286155',
        supportEmail: 'support@erametsad.ee',
        supportPhone: '+372 5555 5555',
        aliasDomain: 'oksjonid.erametsad.ee',
      },
    })
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data.before).toMatchObject({ orgName: 'Erametsad OÜ', supportEmail: null })
    expect(audit?.data.after).toMatchObject({ orgVatCode: 'EE101286155', reason: 'kontaktandmete uuendus' })
    expect(url.pathname).toBe(SETTINGS_PATH)
  })

  it('rejects malformed Üldandmed e-mail, phone, and domain values', async () => {
    for (const [field, value, message] of [
      ['supportEmail', 'not-an-email', 'Klienditoe e-post peab olema korrektne e-posti aadress.'],
      ['supportPhone', 'helista', 'Klienditoe telefon peab koosnema numbritest (lubatud +, tühik ja sidekriips).'],
      ['aliasDomain', 'era metsad', 'Alias-domeen peab olema korrektne domeeninimi (näiteks oksjonid.erametsad.ee).'],
    ] as const) {
      const url = await redirectOf(() =>
        updateSettingsAction(form({ section: 'uldine', reason: 'seadete muutus', [field]: value })),
      )
      expect(url.searchParams.get('viga')).toBe(message)
    }
    expect(repos.updates).toEqual([])
  })

  it('saves the quick-auction fee override and the minimum fee in cents', async () => {
    repos.settingsRow.feePercent = 3
    repos.settingsRow.vatPercent = 22

    await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'tasud',
          reason: 'kiiroksjoni tasu erisus',
          feePercent: '3',
          vatPercent: '22',
          quickAuctionFeePercent: '5',
          minimumFeeEur: '12.5',
        }),
      ),
    )

    expect(repos.updates[0]?.data).toMatchObject({
      quickAuctionFeePercent: 5,
      minimumFeeCents: 1250,
    })
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data.after).toMatchObject({
      quickAuctionFeePercent: 5,
      minimumFeeCents: 1250,
      reason: 'kiiroksjoni tasu erisus',
    })
  })

  it('treats an empty quick-auction fee as the default-fee fallback', async () => {
    await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'tasud',
          reason: 'kasutame vaikemäära',
          feePercent: '4',
          vatPercent: '22',
          quickAuctionFeePercent: '',
          minimumFeeEur: '0',
        }),
      ),
    )

    expect(repos.updates[0]?.data).toMatchObject({
      quickAuctionFeePercent: null,
      minimumFeeCents: 0,
    })
  })

  it('rejects the quick-auction fee and minimum fee outside their bounds', async () => {
    const url = await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'tasud',
          reason: 'seadete muutus',
          feePercent: '3',
          vatPercent: '22',
          quickAuctionFeePercent: '11',
          minimumFeeEur: '0',
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Kiiroksjoni teenustasu peab olema täisarv vahemikus 0 kuni 10 või tühi (kasutatakse vaikemäära).',
    )

    const negative = await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'tasud',
          reason: 'seadete muutus',
          feePercent: '3',
          vatPercent: '22',
          minimumFeeEur: '-5',
        }),
      ),
    )
    expect(negative.searchParams.get('viga')).toBe('Minimaalne tasu peab olema vahemikus 0 kuni 10000 eurot.')
    expect(repos.updates).toEqual([])
  })

  it('saves fees at both bounds of the 0-10 range', async () => {
    repos.settingsRow.feePercent = 5
    repos.settingsRow.vatPercent = 22

    for (const feePercent of ['0', '10']) {
      const url = await redirectOf(() =>
        updateSettingsAction(
          form({ section: 'tasud', reason: 'piirväärtuse salvestus', feePercent, vatPercent: '22' }),
        ),
      )
      expect(repos.updates.at(-1)?.data).toMatchObject({ feePercent: Number(feePercent) })
      expect(url.searchParams.get('ok')).toBe('tasud')
    }
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
          autobidderEnabled: 'true',
          minAuctionDurationHours: '2',
        }),
      ),
    )

    const update = repos.updates[0]
    expect(update?.data).toMatchObject({
      antiSnipeDurationMinutes: 7,
      sealedRevisionCap: 2,
      alapakkumineEnabled: true,
      autobidderEnabled: true,
      minAuctionDurationHours: 2,
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
      minAuctionDurationHours: null,
      auctionDefaults: { old: true },
      reason: 'oksjonide vaikeväärtused',
    })
    expect(audit?.data.after).toMatchObject({
      antiSnipeDurationMinutes: 7,
      alapakkumineEnabled: true,
      minAuctionDurationHours: 2,
      reason: 'oksjonide vaikeväärtused',
    })
  })

  it('rejects a minimum auction duration outside the 1-72 hour bounds', async () => {
    const url = await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'oksjonid',
          reason: 'oksjonide vaikeväärtused',
          antiSnipeDurationMinutes: '5',
          sealedRevisionCap: '3',
          alapakkumineDecisionDeadlineDays: '3',
          kiiroksjonDurationHours: '48',
          sealedApproverRole: 'superadmin',
          minAuctionDurationHours: '100',
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Minimaalne oksjoni kestus peab olema täisarv vahemikus 1 kuni 72 tundi.',
    )
    expect(repos.updates).toEqual([])
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
            minAuctionDurationHours: '1',
          }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe('Alapakkumise otsuse tähtaeg peab olema täisarv vahemikus 1 kuni 14.')
    expect(repos.updates).toEqual([])
  })

  it('saves named flag toggles while masking legacy secrets and preserving the reserved defaults', async () => {
    repos.settingsRow.featureFlags = {
      apiToken: 'sekret',
      requireFrameworkContract: true,
      sms_notifications: true,
      auctionDefaults: { kiiroksjonDurationHours: 48 },
    }

    await redirectOf(() =>
      updateSettingsAction(
        form({
          section: 'lipud',
          reason: 'lippude uuendus',
          // Checkbox round-trip: checked toggles post 'true', unchecked ones
          // post nothing.
          map_view: 'true',
          statistics_public: 'true',
        }),
      ),
    )

    const update = repos.updates[0]
    expect(update?.data.featureFlags).toEqual({
      apiToken: 'sekret',
      requireFrameworkContract: true,
      sms_notifications: false,
      sealed_bids: false,
      map_view: true,
      quick_auction: false,
      saved_search_digests: false,
      statistics_public: true,
      partner_portal: false,
      auctionDefaults: { kiiroksjonDurationHours: 48 },
    })

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    const before = audit?.data.before as { featureFlags: Record<string, unknown>; reason: string }
    const after = audit?.data.after as { featureFlags: Record<string, unknown>; reason: string }
    expect(before.featureFlags).toEqual({
      apiToken: '<salajane>',
      requireFrameworkContract: true,
      sms_notifications: true,
      auctionDefaults: { kiiroksjonDurationHours: 48 },
    })
    expect(after.featureFlags).toMatchObject({
      apiToken: '<salajane>',
      map_view: true,
      sms_notifications: false,
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
