import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  anonymizeUserAction,
  exportUserGdprAction,
  precheckUserDeleteAction,
} from '../users'

import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

const mediaMocks = vi.hoisted(() => ({
  getMediaBucket: vi.fn(),
}))
vi.mock('../../admin/media/_lib/media-upload', () => mediaMocks)

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
  sessionGuardContext: (payload: unknown) => payload,
}))

const sessionMocks = vi.hoisted(() => ({
  createSession: vi.fn(),
  getUserSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeUserSessions: vi.fn(),
  writeSessionCookies: vi.fn(),
  clearSessionCookiesOnStore: vi.fn(),
}))
vi.mock('@/lib/auth/session', () => sessionMocks)

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

const getRepositoriesMock = vi.mocked(getRepositories)
const getMediaBucketMock = vi.mocked(mediaMocks.getMediaBucket)

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
  where?: unknown
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  const deletes: { collection: string; id: string }[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  // audit-entry lookups are split by their where clause: delete markers
  // (user.gdpr_delete) and sealed-reveal markers (sealed.reveal).
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  const findDocsByKey: Record<string, Record<string, unknown>[]> = {}
  const repos = {
    find: vi.fn((args: FindArgs) => {
      let docs = findDocsByCollection[args.collection] ?? []
      if (args.collection === 'audit-entry' && args.where !== undefined) {
        const json = JSON.stringify(args.where)
        if (json.includes('user.gdpr_delete')) docs = findDocsByKey['delete-markers'] ?? []
        else if (json.includes('sealed.reveal')) docs = findDocsByKey['sealed-reveal'] ?? []
      }
      return Promise.resolve({ docs })
    }),
    findByID: vi.fn((args: { collection: string; id: string }): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    delete: vi.fn((args: { collection: string; id: string }) => {
      deletes.push(args)
      return Promise.resolve(undefined)
    }),
    creates,
    updates,
    deletes,
    docsByCollection,
    findDocsByCollection,
    findDocsByKey,
  }
  return repos
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as never)
}

const ANONYMIZE_REASON = 'GDPR taotlus täidetud'
const ANONYMIZE_OK_MESSAGE = 'Kasutaja anonüümiseeritud; arvestuslikud andmed säilitatakse 7 aastat.'

function userDoc(): Record<string, unknown> {
  return {
    id: 'user-9',
    email: 'mari@example.ee',
    name: 'Mari Mets',
    phone: '+37251234567',
    role: 'private',
    status: 'active',
    authMethod: 'eid',
    passwordHash: 'secret-hash',
    passwordSalt: 'secret-salt',
    isikukoodEncrypted: 'encrypted-blob',
    isikukoodIv: 'iv-blob',
    isikukoodAuthTag: 'tag-blob',
    isikukoodHash: 'hash-blob',
    isikukood: '32708100019',
    createdAt: '2026-01-15T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  }
}

function requestedMarker(coolingOffUntil: string): Record<string, unknown> {
  return {
    id: 'marker-1',
    action: 'user.gdpr_delete',
    entityType: 'user',
    entityId: 'user-9',
    after: { phase: 'requested', reason: ANONYMIZE_REASON, coolingOffUntil },
    createdAt: '2026-09-01T09:00:00.000Z',
  }
}

const FUTURE_COOLING_OFF = '2099-01-01T00:00:00.000Z'
const PAST_COOLING_OFF = '2026-09-02T00:00:00.000Z'

beforeEach(() => {
  vi.clearAllMocks()
  getMediaBucketMock.mockResolvedValue(null)
  state.session = { userId: 'admin-1', role: 'admin' }
})

describe('anonymizeUserAction (14-day cooling-off delete)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = userDoc()
    repos.findDocsByKey['delete-markers'] = []
    repos.findDocsByKey['sealed-reveal'] = []
    repos.findDocsByCollection.profile = [
      { id: 'profile-1', userId: 'user-9', displayName: 'Mari Mets', phone: '+37251234567' },
    ]
    repos.findDocsByCollection.bids = []
    repos.findDocsByCollection.contracts = []
    repos.findDocsByCollection.auctions = []
  })

  it('denies a role without users:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('rejects a reason shorter than 5 characters', async () => {
    const result = await anonymizeUserAction('user-9', 'ei')

    expect(result).toEqual({
      ok: false,
      error: 'Anonüümiseerimise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
    expect(repos.updates).toEqual([])
  })

  it('refuses a staff target', async () => {
    repos.docsByCollection.users = { id: 'staff-1', role: 'admin', status: 'active' }

    const result = await anonymizeUserAction('staff-1', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Töötaja konto anonüümiseerimine ei ole lubatud.' })
    expect(repos.updates).toEqual([])
  })

  it('registers a fresh request with the 14-day cooling-off instead of deleting', async () => {
    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('unreachable')
    expect(result.message).toContain('Kustutustaotlus registreeritud')

    // The request touches no rows; only the audit trail and the notice.
    expect(repos.updates).toEqual([])
    expect(repos.deletes).toEqual([])

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    if (!audit) throw new Error('audit entry not created')
    const after = audit.data.after as { phase: string; coolingOffUntil: string; requestedAt: string }
    expect(audit.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.gdpr_delete',
      entityType: 'user',
      entityId: 'user-9',
    })
    expect(after.phase).toBe('requested')

    const requestedAt = new Date(after.requestedAt)
    const expected = new Date(requestedAt)
    expected.setDate(expected.getDate() + 14)
    expect(after.coolingOffUntil).toBe(expected.toISOString())

    // The user is told how to cancel in the portal during the window.
    const notification = repos.creates.find((entry) => entry.collection === 'notifications')
    expect(notification).toBeDefined()
    expect(String(notification?.data.body)).toContain('tühistada')
  })

  it('refuses to execute while the cooling-off window still runs', async () => {
    repos.findDocsByKey['delete-markers'] = [requestedMarker(FUTURE_COOLING_OFF)]

    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    expect(result.error).toContain('jäägaeg kestab kuni')
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('treats a legacy phase-less marker as an executed delete', async () => {
    repos.findDocsByKey['delete-markers'] = [
      { id: 'marker-0', action: 'user.gdpr_delete', entityType: 'user', entityId: 'user-9', createdAt: '2026-01-01T00:00:00.000Z' },
    ]

    const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Kasutaja konto on juba anonüümiseeritud.' })
    expect(repos.updates).toEqual([])
  })

  describe('after the cooling-off window', () => {
    beforeEach(() => {
      repos.findDocsByKey['delete-markers'] = [requestedMarker(PAST_COOLING_OFF)]
      repos.findDocsByCollection.auctions = [
        { id: 'auc-1', title: 'Metsa tukk', status: 'completed' },
        { id: 'auc-2', title: 'Suletud oksjon', status: 'ended' },
      ]
      repos.findDocsByCollection.bids = [
        { id: 'bid-1', auctionId: 'auc-1', amountCents: 150000, type: 'open', status: 'won', identitySnapshot: 'snap', ipHash: 'ip-1' },
        { id: 'bid-2', auctionId: 'auc-1', amountCents: 120000, type: 'sealed', status: 'leading', identitySnapshot: 'sealed-snap', ipHash: 'ip-2' },
        { id: 'bid-3', auctionId: 'auc-2', amountCents: 90000, type: 'sealed', status: 'lost', identitySnapshot: 'revealed-snap', ipHash: 'ip-3' },
      ]
      repos.findDocsByCollection.contracts = [
        { id: 'contract-1', status: 'signed', signedAt: '2026-02-01T00:00:00.000Z', renderedHtml: '<p>Leping Mari Mets</p>' },
      ]
      // bid-3's auction went through the reveal ceremony; bid-2's did not.
      repos.findDocsByKey['sealed-reveal'] = [
        { id: 'reveal-1', action: 'sealed.reveal', entityType: 'auction', entityId: 'auc-2', createdAt: '2026-03-01T00:00:00.000Z' },
      ]
    })

    it('masks the account, pseudonymises bids and contracts and purges unopened sealed bids', async () => {
      const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

      expect(result).toEqual({ ok: true, message: ANONYMIZE_OK_MESSAGE })
      expect(sessionMocks.revokeUserSessions).toHaveBeenCalledWith('user-9')

      // The users row survives with masked fields; the unique email index
      // stays satisfied without personal data.
      expect(repos.updates).toContainEqual({
        collection: 'users',
        id: 'user-9',
        data: {
          email: 'anonymized-user-9@gdpr.invalid',
          name: null,
          phone: null,
          status: 'suspended',
          passwordHash: null,
          passwordSalt: null,
          isikukoodEncrypted: null,
          isikukoodIv: null,
          isikukoodAuthTag: null,
          isikukoodHash: null,
        },
      })
      expect(repos.updates).toContainEqual({
        collection: 'profile',
        id: 'profile-1',
        data: { displayName: 'Anonümiseeritud', phone: null },
      })

      // Identity columns only: amounts and statuses are never rewritten.
      expect(repos.updates).toContainEqual({
        collection: 'bids',
        id: 'bid-1',
        data: { identitySnapshot: null, ipHash: null },
      })
      expect(repos.updates).toContainEqual({
        collection: 'bids',
        id: 'bid-3',
        data: { identitySnapshot: null, ipHash: null },
      })
      expect(repos.updates).toContainEqual({
        collection: 'contracts',
        id: 'contract-1',
        data: { renderedHtml: null },
      })

      // Only the sealed bid whose auction was never opened is purged.
      expect(repos.deletes).toEqual([{ collection: 'bids', id: 'bid-2' }])
    })

    it('audits the execution with phase, retention and purge counts', async () => {
      await anonymizeUserAction('user-9', ANONYMIZE_REASON)

      const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
      if (!audit) throw new Error('audit entry not created')
      const after = audit.data.after as {
        phase: string
        retentionUntil: string
        anonymizedAt: string
        bidsPseudonymised: number
        contractsMasked: number
        sealedBidsPurged: number
        override: boolean
      }
      expect(after.phase).toBe('executed')
      expect(after.override).toBe(false)
      expect(after.bidsPseudonymised).toBe(3)
      expect(after.contractsMasked).toBe(1)
      expect(after.sealedBidsPurged).toBe(1)

      const retention = new Date(after.anonymizedAt)
      retention.setFullYear(retention.getFullYear() + 7)
      expect(after.retentionUntil).toBe(retention.toISOString())

      // The account is gone; nobody is left to notify.
      expect(repos.creates.some((entry) => entry.collection === 'notifications')).toBe(false)
    })

    it('blocks on the pre-check report until the explicit override', async () => {
      repos.findDocsByCollection.auctions = [{ id: 'auc-1', title: 'Aktiivne', status: 'active' }]
      repos.findDocsByCollection.bids = [
        { id: 'bid-1', auctionId: 'auc-1', amountCents: 150000, type: 'open', status: 'leading' },
      ]
      repos.findDocsByCollection.contracts = [
        { id: 'contract-1', status: 'sent', renderedHtml: null },
      ]

      const blocked = await anonymizeUserAction('user-9', ANONYMIZE_REASON)
      expect(blocked.ok).toBe(false)
      if (!blocked.ok) {
        expect(blocked.error).toContain('ülekäiku')
        expect(blocked.error).toContain('1 pakkumist aktiivsel oksjonil')
        expect(blocked.error).toContain('1 allkirjastamata lepingut')
      }
      expect(repos.updates).toEqual([])

      const overridden = await anonymizeUserAction('user-9', ANONYMIZE_REASON, { override: true })
      expect(overridden).toEqual({ ok: true, message: ANONYMIZE_OK_MESSAGE })

      const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
      expect((audit?.data.after as { override?: boolean }).override).toBe(true)
    })

    it('returns a failure and leaves the account untouched when a write fails', async () => {
      repos.update.mockRejectedValueOnce(new Error('db down'))

      const result = await anonymizeUserAction('user-9', ANONYMIZE_REASON)

      expect(result).toEqual({ ok: false, error: 'Anonüümiseerimine ebaõnnestus: db down' })
      expect(repos.creates).toEqual([])
    })
  })
})

describe('precheckUserDeleteAction (delete pre-check report)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = userDoc()
    repos.findDocsByKey['delete-markers'] = []
    repos.findDocsByKey['sealed-reveal'] = []
    repos.findDocsByCollection.bids = []
    repos.findDocsByCollection.contracts = []
    repos.findDocsByCollection.auctions = []
  })

  it('denies a role without users:read', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await precheckUserDeleteAction('user-9')

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
  })

  it('reports active bids, open contracts, purgeable sealed bids and the cooling-off state', async () => {
    repos.findDocsByCollection.auctions = [
      { id: 'auc-1', title: 'Aktiivne oksjon', status: 'active' },
      { id: 'auc-2', title: 'Lõppenud', status: 'completed' },
    ]
    repos.findDocsByCollection.bids = [
      { id: 'bid-1', auctionId: 'auc-1', amountCents: 150000, type: 'open', status: 'leading' },
      { id: 'bid-2', auctionId: 'auc-2', amountCents: 90000, type: 'open', status: 'won' },
      { id: 'bid-3', auctionId: 'auc-1', amountCents: 1000, type: 'sealed', status: 'leading' },
    ]
    repos.findDocsByCollection.contracts = [
      { id: 'contract-1', status: 'sent', createdAt: '2026-08-01T00:00:00.000Z', renderedHtml: null },
      { id: 'contract-2', status: 'signed', createdAt: '2026-07-01T00:00:00.000Z', renderedHtml: '<p>x</p>' },
    ]
    repos.findDocsByKey['delete-markers'] = [requestedMarker(FUTURE_COOLING_OFF)]

    const result = await precheckUserDeleteAction('user-9')
    if (!result.ok) throw new Error('precheck failed')

    expect(result.precheck.activeAuctionBids).toEqual([
      { bidId: 'bid-1', auctionId: 'auc-1', auctionTitle: 'Aktiivne oksjon', amountCents: 150000, status: 'leading' },
      { bidId: 'bid-3', auctionId: 'auc-1', auctionTitle: 'Aktiivne oksjon', amountCents: 1000, status: 'leading' },
    ])
    expect(result.precheck.openContracts).toEqual([
      { contractId: 'contract-1', status: 'sent', createdAt: '2026-08-01T00:00:00.000Z' },
    ])
    expect(result.precheck.signedContractCount).toBe(1)
    expect(result.precheck.blocking).toBe(true)
    expect(result.status).toMatchObject({
      phase: 'requested',
      coolingOffUntil: FUTURE_COOLING_OFF,
      coolingOffElapsed: false,
    })
  })
})

describe('exportUserGdprAction (audited ZIP export with typed reason)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = userDoc()
    repos.findDocsByKey['delete-markers'] = []
    repos.findDocsByKey['sealed-reveal'] = []
    repos.findDocsByCollection.profile = [
      { id: 'profile-1', userId: 'user-9', displayName: 'Mari Mets' },
    ]
    repos.findDocsByCollection.bids = [{ id: 'bid-1', amountCents: 1500, ipHash: 'ip-1' }]
    repos.findDocsByCollection.contracts = [
      { id: 'contract-1', status: 'signed', renderedHtml: '<p>Allkirjastatud leping</p>' },
      { id: 'contract-2', status: 'prepared', renderedHtml: '<p>Allkirjastamata</p>' },
    ]
    repos.findDocsByCollection['auction-rights'] = []
    repos.findDocsByCollection.notifications = []
    repos.findDocsByCollection['consent-log'] = [
      { id: 'consent-1', choice: 'custom', categories: { statistics: true }, ipHash: 'ip-1' },
    ]
  })

  it('denies a role without users:read before any query runs', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.find).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
  })

  it('requires a typed reason of at least 5 characters', async () => {
    const result = await exportUserGdprAction('user-9', 'ei')

    expect(result).toEqual({
      ok: false,
      error: 'Eksportimise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
    expect(repos.find).not.toHaveBeenCalled()
    expect(repos.creates).toEqual([])
  })

  it('reports a missing user', async () => {
    repos.docsByCollection.users = null

    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({ ok: false, error: 'Kasutajat ei leitud.' })
    expect(repos.creates).toEqual([])
  })

  it('scopes every collection query to the requested user', async () => {
    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)
    if (!result.ok) throw new Error('export failed')

    const whereByCollection = new Map(
      repos.find.mock.calls.map((call) => {
        const args = call[0]
        return [args.collection, args.where]
      }),
    )
    expect(whereByCollection.size).toBe(7)
    expect(whereByCollection.get('profile')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('bids')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('contracts')).toEqual({ signedBy: { equals: 'user-9' } })
    expect(whereByCollection.get('auction-rights')).toEqual({ user: { equals: 'user-9' } })
    expect(whereByCollection.get('notifications')).toEqual({ user: { equals: 'user-9' } })
    // The consent log has no user column; entries resolve via the bids' IP hashes.
    expect(whereByCollection.get('consent-log')).toEqual({ ipHash: { in: ['ip-1'] } })
    expect(whereByCollection.get('audit-entry')).toEqual({
      and: [{ entityType: { equals: 'user' } }, { entityId: { equals: 'user-9' } }],
    })
  })

  it('returns a ZIP carrying personal data, consents and signed contract documents', async () => {
    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)
    if (!result.ok) throw new Error('export failed')

    expect(result.filename).toBe('isikuandmed-user-9.zip')
    const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0))
    const archive = new TextDecoder().decode(bytes)
    expect(archive.startsWith('PK')).toBe(true)
    expect(archive).toContain('kasutaja.json')
    expect(archive).toContain('32708100019')
    expect(archive).toContain('nõusolekud.json')
    expect(archive).toContain('consent-1')
    expect(archive).toContain('leping-contract-1.html')
    expect(archive).toContain('Allkirjastatud leping')
    // Only signed documents travel as document files; drafts stay behind
    // (the lepingud.json projection still lists the contract rows).
    expect(archive).not.toContain('leping-contract-2.html')
    // Credential columns never leave the server.
    expect(archive).not.toContain('secret-hash')
    expect(archive).not.toContain('secret-salt')
  })

  it('audits the export with the file list and byte size', async () => {
    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)
    if (!result.ok) throw new Error('export failed')

    const bytes = Uint8Array.from(atob(result.base64), (char) => char.charCodeAt(0))
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    if (!audit) throw new Error('audit entry not created')
    expect(audit.data).toMatchObject({
      actorId: 'admin-1',
      action: 'user.gdpr_export',
      entityType: 'user',
      entityId: 'user-9',
      after: {
        format: 'zip',
        archived: false,
        bytes: bytes.length,
      },
    })

    const files = (audit.data.after as { files: string[] }).files
    expect(files).toContain('kasutaja.json')
    expect(files).toContain('nõusolekud.json')
    expect(files).toContain('audit.json')
    expect(files).toContain('leping-contract-1.html')
    expect(files).not.toContain('leping-contract-2.html')

    // No bucket binding (local dev): download-only, no R2 key on the audit.
    expect(getMediaBucketMock).toHaveBeenCalledTimes(1)
    expect((audit.data.after as { r2Key?: unknown }).r2Key).toBeUndefined()
  })

  it('archives the ZIP under gdpr-exports/ when the media bucket exists', async () => {
    const putMock = vi.fn(
      (_key: string, _value: ArrayBuffer, _options?: { httpMetadata?: { contentType?: string } }) =>
        Promise.resolve(undefined),
    )
    getMediaBucketMock.mockResolvedValue({
      put: putMock,
      get: vi.fn(() => Promise.resolve(null)),
      delete: vi.fn(() => Promise.resolve(undefined)),
    })

    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)
    if (!result.ok) throw new Error('export failed')

    expect(putMock).toHaveBeenCalledTimes(1)
    const key = putMock.mock.calls[0]?.[0]
    expect(typeof key).toBe('string')
    expect(String(key)).toContain('gdpr-exports/user-9/')
    expect(String(key).endsWith('.zip')).toBe(true)

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      after: { archived: true, r2Key: key },
    })
  })

  it('fails closed when the audit write fails', async () => {
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))

    const result = await exportUserGdprAction('user-9', ANONYMIZE_REASON)

    expect(result).toEqual({
      ok: false,
      error: 'Eksportimise logimine ebaõnnestus: audit write failed',
    })
  })
})
