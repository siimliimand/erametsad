import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  approveCompanyAccessRequestAction,
  exportCompanyHistoryAction,
  registryRecheckAction,
} from '../ops'

import type * as MediaUpload from '@/app/(admin)/admin/media/_lib/media-upload'
import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: 'admin' | 'specialist' }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

class RedirectError extends Error {
  constructor(
    readonly url: string,
  ) {
    super(`NEXT_REDIRECT:${url}`)
    this.name = 'RedirectError'
  }
}

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

const mediaUpload = vi.hoisted(() => ({
  getMediaBucket: vi.fn(),
}))

vi.mock('@/app/(admin)/admin/media/_lib/media-upload', async (importOriginal) => {
  const actual = await importOriginal<typeof MediaUpload>()
  return {
    ...actual,
    getMediaBucket: mediaUpload.getMediaBucket,
  }
})

const getRepositoriesMock = vi.mocked(getRepositories)

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: { collection: string }) =>
      Promise.resolve({ docs: findDocsByCollection[args.collection] ?? [] }),
    ),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(
        args.collection === 'company-access-request'
          ? ({
              id: 'req-1',
              regCode: '12345678',
              companyName: 'Mari Mets OÜ',
              requesterName: 'Kalle Katel',
              requesterPhone: '+372 5555 0100',
              requesterEmail: 'kalle@example.ee',
              reason: 'Soovin pakkumisi esitada.',
              status: 'pending',
              reviewedBy: null,
              reviewedAt: null,
              createdAt: '2026-08-01T09:00:00.000Z',
              updatedAt: '2026-08-01T09:00:00.000Z',
            } satisfies Record<string, unknown>)
          : (docsByCollection[args.collection] ?? null),
      ),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((args: { collection: string; id: string; data: Record<string, unknown> }) =>
      Promise.resolve({ id: args.id, ...args.data }),
    ),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    findDocsByCollection,
  }
}

type Repos = ReturnType<typeof makeRepos>

const JUSTIFICATION = 'Taotleja on juhatuse poolt volitatud'

function makeVolikiriFile(): File {
  return new File(['volikiri'], 'volikiri.pdf', { type: 'application/pdf' })
}

function baseFormData(): FormData {
  const formData = new FormData()
  formData.set('id', 'req-1')
  formData.set('checkedRegistry', 'on')
  return formData
}

/** redirect() encodes the Estonian message into the query; decode to assert. */
function redirectUrlOf(error: unknown): string {
  const url = (error as RedirectError).url
  return url.replace(/([?&][^=]+)=([^&]*)/g, (_match, key: string, value: string) => `${key}=${decodeURIComponent(value)}`)
}

async function runAction(action: (formData: FormData) => Promise<void>, formData: FormData): Promise<string> {
  return action(formData).then(
    () => '',
    (caught: unknown) => redirectUrlOf(caught),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  state.session = { userId: 'admin-1', role: 'admin' }
  const repos = makeRepos()
  repos.findDocsByCollection.users = [
    { id: 'user-9', email: 'kalle@example.ee', name: 'Kalle Katel', status: 'active' },
  ]
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as never)
})

describe('approveCompanyAccessRequestAction volikiri enforcement', () => {
  it('blocks the approve without a justification when the board check fails', async () => {
    const url = await runAction(approveCompanyAccessRequestAction, baseFormData())
    expect(url).toContain('viga=')
    expect(url).toContain('põhjendus on kohustuslik')
  })

  it('blocks the approve when the justification is too short', async () => {
    const formData = baseFormData()
    formData.set('justification', 'ei')
    formData.set('volikiri', makeVolikiriFile())

    const url = await runAction(approveCompanyAccessRequestAction, formData)
    expect(url).toContain('põhjendus on kohustuslik')
  })

  it('blocks the approve without the power-of-attorney upload', async () => {
    const formData = baseFormData()
    formData.set('justification', JUSTIFICATION)

    const url = await runAction(approveCompanyAccessRequestAction, formData)
    expect(url).toContain('nõuab volikirja üleslaadimist')
  })

  it('blocks the approve when the upload is not an allowed media type', async () => {
    const formData = baseFormData()
    formData.set('justification', JUSTIFICATION)
    formData.set('volikiri', new File(['x'], 'volikiri.svg', { type: 'image/svg+xml' }))

    const url = await runAction(approveCompanyAccessRequestAction, formData)
    expect(url).toContain('viga=Volikiri:')
  })

  it('blocks the approve when the R2 bucket is unavailable', async () => {
    mediaUpload.getMediaBucket.mockResolvedValue(null)
    const formData = baseFormData()
    formData.set('justification', JUSTIFICATION)
    formData.set('volikiri', makeVolikiriFile())

    const url = await runAction(approveCompanyAccessRequestAction, formData)
    expect(url).toContain('R2 salvestusruum pole saadaval')
  })

  it('approves with the upload and records justification and the R2 key on the audit entry', async () => {
    const bucketPut = vi.fn()
    const bucketDelete = vi.fn()
    mediaUpload.getMediaBucket.mockResolvedValue({ put: bucketPut, delete: bucketDelete })
    const repos = state.repositories as Repos

    const formData = baseFormData()
    formData.set('justification', JUSTIFICATION)
    formData.set('volikiri', makeVolikiriFile())
    formData.set('redirectTo', '/admin/companies')

    const url = await runAction(approveCompanyAccessRequestAction, formData)
    expect(url).toContain('/admin/companies')
    expect(url).toContain('teade=')
    expect(url).toContain('volikirjaga')

    expect(bucketPut).toHaveBeenCalledTimes(1)
    const [key, , options] = bucketPut.mock.calls[0] as unknown as [
      string,
      ArrayBuffer,
      { httpMetadata: { contentType: string } },
    ]
    expect(key).toContain('volikiri/req-1/')
    expect(key.endsWith('volikiri.pdf')).toBe(true)
    expect(options.httpMetadata.contentType).toBe('application/pdf')

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data.action).toBe('company.approve')
    expect(audit?.data.after).toMatchObject({
      status: 'approved',
      boardCheck: 'none',
      volikiri: {
        filename: 'volikiri.pdf',
        mimeType: 'application/pdf',
        justification: JUSTIFICATION,
      },
    })
    expect((audit?.data.after as Record<string, unknown>).volikiri).toMatchObject({ r2Key: key })
  })

  it('asks for no volikiri when the board check passes', async () => {
    const repos = state.repositories as Repos
    // Registry fixture for 12345678 has Mari Mets on the board; the
    // requester must carry that name for a non-failed check.
    repos.findDocsByCollection.users = [
      { id: 'user-9', email: 'kalle@example.ee', name: 'Mari Mets', status: 'active' },
    ]

    const formData = baseFormData()
    const url = await runAction(approveCompanyAccessRequestAction, formData)
    expect(url).toContain('teade=')
    expect(url).not.toContain('volikirjaga')

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data.after).toMatchObject({ boardCheck: 'weak' })
    expect((audit?.data.after as Record<string, unknown>).volikiri).toBeUndefined()
  })
})

describe('registryRecheckAction (audited re-check)', () => {
  it('writes the audited registry view and redirects back with a notice', async () => {
    const repos = state.repositories as Repos

    const formData = new FormData()
    formData.set('id', 'req-1')
    formData.set('redirectTo', '/admin/companies')

    const url = await runAction(registryRecheckAction, formData)
    expect(url).toContain('/admin/companies')
    expect(url).toContain('teade=')

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'company.registry_recheck',
      entityType: 'company-access-request',
      entityId: 'req-1',
    })
    expect(audit?.data.after).toMatchObject({ regCode: '12345678', verified: true })
  })

  it('denies a role without companies:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const repos = state.repositories as Repos

    const formData = new FormData()
    formData.set('id', 'req-1')

    const url = await runAction(registryRecheckAction, formData)
    expect(url).toContain('õigus')
    expect(repos.creates).toEqual([])
  })
})

describe('exportCompanyHistoryAction (audited CSV export)', () => {
  function makeHistoryRepos() {
    const repos = makeRepos()
    repos.findDocsByCollection['company-access-request'] = [
      {
        id: 'req-approved',
        regCode: '12345678',
        companyName: 'Mari Mets OÜ',
        requesterName: 'Mari Maasikas',
        requesterEmail: 'mari@example.ee',
        status: 'approved',
        reviewedBy: 'admin-1',
        reviewedAt: '2026-08-01T10:00:00.000Z',
        createdAt: '2026-07-01T09:00:00.000Z',
        updatedAt: '2026-08-01T10:00:00.000Z',
      },
      {
        id: 'req-rejected',
        regCode: '23456789',
        companyName: 'Eramets AS',
        requesterName: 'Peeter Kask',
        requesterEmail: 'peeter@example.ee',
        status: 'rejected',
        reviewedBy: 'admin-1',
        reviewedAt: '2026-08-02T10:00:00.000Z',
        createdAt: '2026-07-02T09:00:00.000Z',
        updatedAt: '2026-08-02T10:00:00.000Z',
      },
      {
        id: 'req-pending',
        regCode: '34567890',
        companyName: 'Metsaühistu OÜ',
        requesterName: 'Kadri Leht',
        requesterEmail: 'kadri@example.ee',
        status: 'pending',
        reviewedBy: null,
        reviewedAt: null,
        createdAt: '2026-08-03T09:00:00.000Z',
        updatedAt: '2026-08-03T09:00:00.000Z',
      },
    ]
    repos.findDocsByCollection.users = [
      { id: 'admin-1', email: 'admin@example.ee', name: 'Admin', role: 'admin', status: 'active' },
      { id: 'user-mari', email: 'mari@example.ee', name: 'Mari Maasikas', status: 'active' },
    ]
    repos.findDocsByCollection['audit-entry'] = [
      {
        id: 'audit-reject',
        entityType: 'company-access-request',
        entityId: 'req-rejected',
        action: 'company.reject',
        after: { status: 'rejected', reason: 'Puudub volikiri' },
        createdAt: '2026-08-02T10:00:00.000Z',
      },
      {
        id: 'audit-approve',
        entityType: 'company-access-request',
        entityId: 'req-approved',
        action: 'company.approve',
        after: { status: 'approved', rights: ['raieoigus'] },
        createdAt: '2026-08-01T10:00:00.000Z',
      },
    ]
    return repos
  }

  it('exports only decided rows, audited with the active filters', async () => {
    const repos = makeHistoryRepos()
    state.repositories = repos
    getRepositoriesMock.mockResolvedValue(repos as never)

    const result = await exportCompanyHistoryAction({ q: 'mari' })
    if (!result.ok) throw new Error(result.error)

    expect(result.rowCount).toBe(1)
    expect(result.filename).toContain('ettevotte-taotluste-ajalugu')
    const csv = new TextDecoder().decode(Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0)))
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('Registrikood')
    expect(lines[1]).toContain('Nõustutud')
    expect(lines[1]).toContain('Mari Mets OÜ')
    expect(csv).not.toContain('Eramets AS')

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'company.history_export',
      entityType: 'company-access-request',
      entityId: '*',
    })
    expect(audit?.data.after).toMatchObject({ format: 'csv', rowCount: 1, filters: { q: 'mari' } })
  })

  it('exports both decisions without filters and denies without companies:read', async () => {
    const repos = makeHistoryRepos()
    state.repositories = repos
    getRepositoriesMock.mockResolvedValue(repos as never)

    const result = await exportCompanyHistoryAction({})
    if (!result.ok) throw new Error(result.error)
    expect(result.rowCount).toBe(2)
    const csv = new TextDecoder().decode(Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0)))
    expect(csv).toContain('Keeldutud')
    expect(csv).toContain('"raieoigus"')

    state.session = { userId: 'seller-1', role: 'specialist' }
    const denied = await exportCompanyHistoryAction({})
    expect(denied).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
  })
})
