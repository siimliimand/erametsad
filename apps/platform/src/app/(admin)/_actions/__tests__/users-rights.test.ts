import { beforeEach, describe, expect, it, vi } from 'vitest'

import { profileRightGroups } from '../../admin/users/_components/tabs/RightsTab'
import { userRightsContextAction, voidLeadingBidAction } from '../users'
import type { RightsContextProfile } from '../users'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

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

vi.mock('@/lib/auth/session', () => ({
  getUserSession: vi.fn(),
  revokeSession: vi.fn(),
  revokeUserSessions: vi.fn(),
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
  const findDocsByCollection: Record<string, Record<string, unknown>[]> = {}
  return {
    find: vi.fn((args: { collection: string; where?: unknown }) => {
      let docs = findDocsByCollection[args.collection] ?? []
      // Emulate the repository's status equals filter so outbid rows stay
      // out of leading-bid results, like the real where layer does.
      const statusRegex = /"status":\{"equals":"([a-z_]+)"\}/
      const statusMatch = statusRegex.exec(JSON.stringify(args.where ?? {}))
      if (statusMatch?.[1]) {
        docs = docs.filter((doc) => doc.status === statusMatch[1])
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
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
    updates,
    docsByCollection,
    findDocsByCollection,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as unknown as CoreRepositories)
}

const VOID_REASON = 'juhtiv pakkumine tühistati'

beforeEach(() => {
  vi.clearAllMocks()
  state.session = { userId: 'admin-1', role: 'admin' }
})

describe('userRightsContextAction (leading bids + profiles)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.users = { id: 'user-9', role: 'private', status: 'active' }
    repos.findDocsByCollection.bids = []
    repos.findDocsByCollection.profile = []
    repos.findDocsByCollection.auctions = []
  })

  it('denies a role without users:read', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }

    const result = await userRightsContextAction('user-9')

    expect(result).toEqual({ ok: false, error: 'Teil puudub õigus selle toimingu sooritamiseks.' })
    expect(repos.find).not.toHaveBeenCalled()
  })

  it('reports a missing user', async () => {
    repos.docsByCollection.users = null

    const result = await userRightsContextAction('user-9')

    expect(result).toEqual({ ok: false, error: 'Kasutajat ei leitud.' })
  })

  it('lists only leading bids on active auctions, with profiles and role flag', async () => {
    repos.findDocsByCollection.bids = [
      { id: 'bid-1', auctionId: 'auc-1', amountCents: 120000, status: 'leading', createdAt: '2026-09-01T00:00:00.000Z' },
      { id: 'bid-2', auctionId: 'auc-2', amountCents: 90000, status: 'leading', createdAt: '2026-09-02T00:00:00.000Z' },
      { id: 'bid-3', auctionId: 'auc-1', amountCents: 80000, status: 'outbid', createdAt: '2026-09-03T00:00:00.000Z' },
    ]
    repos.findDocsByCollection.auctions = [
      { id: 'auc-1', title: 'Aktiivne tukk', status: 'active' },
      { id: 'auc-2', title: 'Lõppenud tukk', status: 'ended' },
    ]
    repos.findDocsByCollection.profile = [
      { id: 'profile-1', type: 'private', approvalStatus: 'approved', displayName: 'Mari Mets', companyName: null },
    ]

    const result = await userRightsContextAction('user-9')
    if (!result.ok) throw new Error('context failed')

    expect(result.context.leadingBids).toEqual([
      {
        bidId: 'bid-1',
        auctionId: 'auc-1',
        auctionTitle: 'Aktiivne tukk',
        amountCents: 120000,
        createdAt: '2026-09-01T00:00:00.000Z',
      },
    ])
    expect(result.context.profiles).toEqual([
      { id: 'profile-1', type: 'private', approvalStatus: 'approved', displayName: 'Mari Mets', companyName: null },
    ])
    expect(result.context.isSuperadmin).toBe(false)
  })

  it('flags the superadmin viewer', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }

    const result = await userRightsContextAction('user-9')
    if (!result.ok) throw new Error('context failed')

    expect(result.context.isSuperadmin).toBe(true)
  })
})

describe('voidLeadingBidAction (superadmin-only compensating void)', () => {
  let repos: Repos

  beforeEach(() => {
    repos = makeRepos()
    useRepos(repos)
    repos.docsByCollection.bids = {
      id: 'bid-1',
      auctionId: 'auc-1',
      userId: 'user-9',
      amountCents: 120000,
      status: 'leading',
      type: 'open',
      source: 'manual',
    }
    repos.docsByCollection.auctions = { id: 'auc-1', title: 'Aktiivne tukk', status: 'active' }
  })

  it('refuses a non-superadmin caller', async () => {
    state.session = { userId: 'admin-1', role: 'admin' }

    const result = await voidLeadingBidAction('bid-1', VOID_REASON)

    expect(result).toEqual({
      ok: false,
      error: 'Juhtiva pakkumise tühistamine on lubatud ainult superadminile.',
    })
    expect(repos.updates).toEqual([])
    expect(repos.creates).toEqual([])
  })

  it('requires a typed reason', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }

    const result = await voidLeadingBidAction('bid-1', 'ei')

    expect(result).toEqual({
      ok: false,
      error: 'Tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
    expect(repos.updates).toEqual([])
  })

  it('refuses a bid that is not leading or an auction that is not active', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }

    repos.docsByCollection.bids = { id: 'bid-1', auctionId: 'auc-1', status: 'outbid', amountCents: 1 }
    const notLeading = await voidLeadingBidAction('bid-1', VOID_REASON)
    expect(notLeading).toEqual({ ok: false, error: 'Ainult juhtiv pakkumine on tühistatav.' })

    repos.docsByCollection.bids = { id: 'bid-1', auctionId: 'auc-1', status: 'leading', amountCents: 1 }
    repos.docsByCollection.auctions = { id: 'auc-1', title: 'Lõppenud', status: 'ended' }
    const notActive = await voidLeadingBidAction('bid-1', VOID_REASON)
    expect(notActive).toEqual({ ok: false, error: 'Oksjon ei ole aktiivne.' })

    expect(repos.updates).toEqual([])
  })

  it('marks the bid rejected without touching the amount, audits and notifies', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }

    const result = await voidLeadingBidAction('bid-1', VOID_REASON)

    expect(result).toEqual({ ok: true, message: 'Juhtiv pakkumine tühistatud ja kasutajat teavitatud.' })

    // Append-only ledger: the status is the compensating correction; the
    // amount column is never rewritten.
    expect(repos.updates).toEqual([
      { collection: 'bids', id: 'bid-1', data: { status: 'rejected' } },
    ])

    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'root-1',
      action: 'bid.void',
      entityType: 'bid',
      entityId: 'bid-1',
      before: { status: 'leading' },
      after: {
        status: 'rejected',
        userId: 'user-9',
        auctionId: 'auc-1',
        amountCents: 120000,
        reason: VOID_REASON,
      },
    })

    const notification = repos.creates.find((entry) => entry.collection === 'notifications')
    expect(notification?.data).toMatchObject({ userId: 'user-9', event: 'bid.void' })
  })

  it('returns a failure when the write fails', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }
    repos.update.mockRejectedValueOnce(new Error('db down'))

    const result = await voidLeadingBidAction('bid-1', VOID_REASON)

    expect(result).toEqual({
      ok: false,
      error: 'Juhtiva pakkumise tühistamine ebaõnnestus: db down',
    })
    expect(repos.creates).toEqual([])
  })
})

describe('profileRightGroups (per-profile matrix rows)', () => {
  const approvedProfile = (id: string): RightsContextProfile => ({
    id,
    type: 'private',
    approvalStatus: 'approved',
    displayName: `Profiil ${id}`,
    companyName: null,
  })
  const pendingCompanyProfile = (id: string): RightsContextProfile => ({
    id,
    type: 'company',
    approvalStatus: 'pending',
    displayName: null,
    companyName: 'OÜ Mets',
  })

  it('keeps the shared matrix without profiles or with a single profile', () => {
    expect(profileRightGroups([], ['mets'])).toBeNull()
    expect(profileRightGroups([approvedProfile('p-1')], ['mets'])).toBeNull()
  })

  it('keeps the shared matrix when profiles carry identical rights', () => {
    expect(profileRightGroups([approvedProfile('p-1'), approvedProfile('p-2')], ['mets'])).toBeNull()
  })

  it('renders per-profile rows only when the profiles hold different rights', () => {
    const rows = profileRightGroups([approvedProfile('p-1'), pendingCompanyProfile('p-2')], [
      'mets',
      'raie',
    ])
    expect(rows).toEqual([
      {
        id: 'p-1',
        label: 'Profiil p-1',
        approvalStatus: 'approved',
        objectTypes: ['mets', 'raie'],
      },
      {
        id: 'p-2',
        label: 'OÜ Mets',
        approvalStatus: 'pending',
        objectTypes: [],
      },
    ])
  })
})
