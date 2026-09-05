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
  cookies: Record<string, string | undefined>
  tokens: Record<string, { userId: string; sessionId: string } | undefined>
} => ({
  session: { userId: 'opener-1', role: 'admin' },
  repositories: null,
  cookies: {},
  tokens: {
    'token-opener': { userId: 'opener-1', sessionId: 'sess-1' },
    'token-approver': { userId: 'approver-1', sessionId: 'sess-2' },
    'token-third': { userId: 'third-1', sessionId: 'sess-3' },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new RedirectError(url)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (name: string) =>
      state.cookies[name] !== undefined ? { value: state.cookies[name] } : undefined,
  })),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
  verifyAdminAccessToken: vi.fn((token: string) => state.tokens[token] ?? null),
}))

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/bidding/sealed-bid', () => ({
  getSealedBidsForAuction: vi.fn(),
  decryptSealedBids: vi.fn((bids: unknown) => bids),
}))

vi.mock('@/lib/contracts/service', () => ({
  prepareContract: vi.fn(),
}))

vi.mock('@/lib/stats/aggregation', () => ({
  upsertSnapshot: vi.fn(),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
  sessionGuardContext: (payload: unknown) => payload,
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

import {
  confirmSealedCeremonyWinnerAction,
  revealSealedBidsAction,
  sealedCeremonyStateAction,
  signSealedApproverAction,
  signSealedOpenerAction,
  voidSealedBidsAction,
  type SealedCeremonyActionState,
} from '../auctions'

import { verifyPassword } from '@/lib/auth/password'
import type { DecryptedBid } from '@/lib/bidding/sealed-bid'
import {
  decryptSealedBids,
  getSealedBidsForAuction,
} from '@/lib/bidding/sealed-bid'
import { prepareContract } from '@/lib/contracts/service'
import { upsertSnapshot } from '@/lib/stats/aggregation'

const verifyPasswordMock = vi.mocked(verifyPassword)
const getSealedBidsMock = vi.mocked(getSealedBidsForAuction)
const decryptMock = vi.mocked(decryptSealedBids)
const prepareContractMock = vi.mocked(prepareContract)
const upsertSnapshotMock = vi.mocked(upsertSnapshot)

interface FindArgs {
  collection: string
  where?: unknown
  sort?: string
  limit?: number
}

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

function whereValues(where: unknown): Record<string, string> {
  const parts =
    (where as { and?: Record<string, { equals?: unknown }>[] } | undefined)?.and ?? []
  const values: Record<string, string> = {}
  for (const part of parts) {
    for (const [key, condition] of Object.entries(part)) {
      if (typeof condition.equals === 'string') {
        values[key] = condition.equals
      }
    }
  }
  return values
}

interface CeremonyFixture {
  auditEntries?: Record<string, Record<string, unknown>[]>
  pendingBids?: Record<string, unknown>[]
  templates?: Record<string, unknown>[]
  auction?: Record<string, unknown> | null
  otherLeadingBids?: Record<string, unknown>[]
  user?: Record<string, unknown> | null
}

function makeRepos(fixture: CeremonyFixture = {}) {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  const auditByAction = new Map(Object.entries(fixture.auditEntries ?? {}))

  const repos = {
    find: vi.fn((args: FindArgs) => {
      const values = whereValues(args.where)
      if (args.collection === 'audit-entry') {
        const created = creates
          .filter((entry) => entry.collection === 'audit-entry' && entry.data.action === values.action)
          .map((entry) => ({ id: `created-${String(creates.indexOf(entry))}`, createdAt: new Date().toISOString(), ...entry.data }))
        return Promise.resolve({ docs: [...(auditByAction.get(values.action ?? '') ?? []), ...created] })
      }
      if (args.collection === 'bids') {
        if (values.status === 'pending_approval') return Promise.resolve({ docs: fixture.pendingBids ?? [] })
        if (values.status === 'leading') return Promise.resolve({ docs: fixture.otherLeadingBids ?? [] })
        return Promise.resolve({ docs: [] })
      }
      if (args.collection === 'contract-templates') {
        return Promise.resolve({ docs: fixture.templates ?? [] })
      }
      return Promise.resolve({ docs: [] })
    }),
    findByID: vi.fn(
      (args: { collection: string; id: string }): Promise<unknown> => {
        if (args.collection === 'auctions') return Promise.resolve(fixture.auction ?? null)
        if (args.collection === 'users') return Promise.resolve(fixture.user ?? null)
        return Promise.resolve(null)
      },
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
  }
  return repos
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
}

const form = (entries: Record<string, string>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value)
  }
  return formData
}

const actionState = (phase: SealedCeremonyActionState['phase']): SealedCeremonyActionState => ({
  ok: false,
  phase,
  error: null,
})

const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString()

let auctionId = ''

const ceremonyAuction = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: auctionId,
  status: 'ended',
  title: 'Suletud pakkumise oksjon',
  specialistId: 'specialist-1',
  sellerId: 'seller-1',
  objectType: 'mets',
  isQuickAuction: false,
  startsAt: minutesAgo(3 * 24 * 60),
  endedAt: minutesAgo(10),
  reservePriceCents: 10_000_000,
  ...overrides,
})

const cleanFixture = (overrides: CeremonyFixture = {}): CeremonyFixture => ({
  auction: ceremonyAuction(),
  auditEntries: { auction_ended: [{ id: 'worker-1', createdAt: minutesAgo(10) }] },
  templates: [
    {
      id: 'tpl-1',
      name: 'Müügleping',
      version: '2',
      type: 'auction',
      active: true,
      updatedAt: minutesAgo(48 * 60),
    },
  ],
  ...overrides,
})

const sealedRow = (
  id: string,
  user: string,
  amount: number,
  createdAt: string,
  valid = true,
): Record<string, unknown> => ({
  id,
  auction: auctionId,
  user,
  amount,
  status: 'leading',
  createdAt,
  valid,
})

async function signOpenerAndApprover(_repos: Repos): Promise<void> {
  state.cookies.access_token = 'token-opener'
  const opener = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
  expect(opener.ok, opener.error ?? 'opener sign failed').toBe(true)
  state.cookies.access_token = 'token-approver'
  const approver = await signSealedApproverAction(actionState('checklist'), form({ auctionId, keyword: 'KINNITAN' }))
  expect(approver.ok, approver.error ?? 'approver sign failed').toBe(true)
  // The opener confirms the winner, so leave that session signed in.
  state.cookies.access_token = 'token-opener'
}

describe('signSealedOpenerAction (ceremony checklist)', () => {
  beforeEach(() => {
    auctionId = `auction-${crypto.randomUUID()}`
    state.session = { userId: 'opener-1', role: 'admin' }
    state.cookies = { access_token: 'token-opener' }
    vi.clearAllMocks()
    decryptMock.mockImplementation((bids) => bids as unknown as DecryptedBid[])
  })

  it('rejects a keyword other than AVAN', async () => {
    useRepos(makeRepos(cleanFixture()))
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVA' }))
    expect(result).toEqual({ ok: false, phase: 'checklist', error: 'Kirjuta kinnitusväljale "AVAN".' })
  })

  it('denies a role without sealed:operate', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    useRepos(makeRepos(cleanFixture()))
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    expect(result.ok).toBe(false)
    expect(result.error).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
  })

  it('blocks the opening while the ending worker confirmation is missing', async () => {
    useRepos(makeRepos(cleanFixture({ auditEntries: {} })))
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    expect(result.error).toBe('Eelkontroll ei läbi: lõpuaeg ei ole kinnitatud (lõpetustöötlus puudub).')
  })

  it('blocks the opening while alapakkumised are pending', async () => {
    useRepos(
      makeRepos(cleanFixture({ pendingBids: [{ id: 'bid-p', status: 'pending_approval' }] })),
    )
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    expect(result.error).toBe('Eelkontroll ei läbi: alapakkumisi on ootel.')
  })

  it('blocks the opening without an active contract template', async () => {
    useRepos(makeRepos(cleanFixture({ templates: [] })))
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    expect(result.error).toBe('Eelkontroll ei läbi: aktiivset lepingu malli ei ole.')
  })

  it('lists every blocker joined with a semicolon', async () => {
    useRepos(makeRepos(cleanFixture({ auditEntries: {}, templates: [] })))
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    expect(result.error).toBe(
      'Eelkontroll ei läbi: lõpuaeg ei ole kinnitatud (lõpetustöötlus puudub); aktiivset lepingu malli ei ole.',
    )
  })

  it('records the opener signature and the sealed.sign_opener audit entry', async () => {
    const repos = makeRepos(cleanFixture())
    useRepos(repos)
    const result = await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    expect(result).toEqual({ ok: true, phase: 'awaiting-approval', error: null })
    expect(repos.creates[0]?.data).toMatchObject({
      actorId: 'opener-1',
      action: 'sealed.sign_opener',
      entityType: 'auction',
      entityId: auctionId,
    })
  })

  it('needs the KINNITAN keyword from the approver', async () => {
    useRepos(makeRepos(cleanFixture()))
    await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    state.cookies.access_token = 'token-approver'
    const result = await signSealedApproverAction(actionState('checklist'), form({ auctionId, keyword: 'KINNITA' }))
    expect(result.error).toBe('Kirjuta kinnitusväljale "KINNITAN".')
  })

  it('refuses the opener confirming their own signature', async () => {
    useRepos(makeRepos(cleanFixture()))
    await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    const result = await signSealedApproverAction(actionState('checklist'), form({ auctionId, keyword: 'KINNITAN' }))
    expect(result.error).toBe('Kinnitaja peab olema teine isik kui avaja.')
  })

  it('requires two distinct sessions', async () => {
    state.tokens['token-second'] = { userId: 'approver-1', sessionId: 'sess-1' }
    useRepos(makeRepos(cleanFixture()))
    await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    state.cookies.access_token = 'token-second'
    const result = await signSealedApproverAction(actionState('checklist'), form({ auctionId, keyword: 'KINNITAN' }))
    expect(result.error).toBe('Allkirjad peavad tulema erinevatest sessioonidest.')
  })

  it('records the approver signature with the opener user in the audit entry', async () => {
    const repos = makeRepos(cleanFixture())
    useRepos(repos)
    await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    state.cookies.access_token = 'token-approver'
    const result = await signSealedApproverAction(actionState('checklist'), form({ auctionId, keyword: 'KINNITAN' }))
    expect(result.ok).toBe(true)
    expect(repos.creates[1]?.data).toMatchObject({
      action: 'sealed.sign_approver',
      after: { openerUserId: 'opener-1' },
    })
  })
})

describe('revealSealedBidsAction (one-shot reveal)', () => {
  beforeEach(() => {
    auctionId = `auction-${crypto.randomUUID()}`
    state.session = { userId: 'opener-1', role: 'admin' }
    state.cookies = { access_token: 'token-opener' }
    vi.clearAllMocks()
    decryptMock.mockImplementation((bids) => bids as unknown as DecryptedBid[])
  })

  const seededRepos = (overrides: CeremonyFixture = {}): Repos => makeRepos(cleanFixture(overrides))

  it('refuses a signer that took no part in the opening', async () => {
    const repos = seededRepos()
    useRepos(repos)
    await signOpenerAndApprover(repos)
    state.cookies.access_token = 'token-third'
    const result = await revealSealedBidsAction(actionState('awaiting-approval'), form({ auctionId }))
    expect(result.error).toBe('Paljastada saab ainult avamise osapool.')
  })

  it('needs both signatures before any reveal', async () => {
    const repos = seededRepos()
    useRepos(repos)
    await signSealedOpenerAction(actionState('checklist'), form({ auctionId, keyword: 'AVAN' }))
    const result = await revealSealedBidsAction(actionState('awaiting-approval'), form({ auctionId }))
    expect(result).toEqual({ ok: false, phase: 'awaiting-approval', error: 'Avamine vajab mõlemat allkirja.' })
  })

  it('holds the reveal until 60 seconds after the recorded end', async () => {
    const repos = seededRepos({ auction: ceremonyAuction({ endedAt: minutesAgo(0.2) }) })
    useRepos(repos)
    await signOpenerAndApprover(repos)
    const result = await revealSealedBidsAction(actionState('awaiting-approval'), form({ auctionId }))
    expect(result.ok).toBe(false)
    expect(result.error).toContain('Paljastus avaneb 60 sekundit pärast lõppaega')
  })

  it('writes one sealed.reveal entry with ranking counts and both signers', async () => {
    const repos = seededRepos()
    useRepos(repos)
    await signOpenerAndApprover(repos)
    getSealedBidsMock.mockResolvedValue([
      sealedRow('bid-1', 'user-a', 150_000, minutesAgo(30)),
      sealedRow('bid-2', 'user-b', 120_000, minutesAgo(29)),
    ] as never)

    const result = await revealSealedBidsAction(actionState('awaiting-approval'), form({ auctionId }))

    expect(result).toEqual({ ok: true, phase: 'revealed', error: null })
    const reveal = repos.creates.find((entry) => entry.data.action === 'sealed.reveal')
    expect(reveal?.data).toMatchObject({
      actorId: 'opener-1',
      entityType: 'auction',
      entityId: auctionId,
      after: {
        totalBids: 2,
        validCount: 2,
        invalidCount: 0,
        topAmount: 150_000,
        topTie: false,
        openerUserId: 'opener-1',
        approverUserId: 'approver-1',
      },
    })
  })

  it('replays the same record on a second reveal without decrypting again', async () => {
    const repos = seededRepos()
    useRepos(repos)
    await signOpenerAndApprover(repos)
    getSealedBidsMock.mockResolvedValue([sealedRow('bid-1', 'user-a', 150_000, minutesAgo(30))] as never)

    const first = await revealSealedBidsAction(actionState('awaiting-approval'), form({ auctionId }))
    const second = await revealSealedBidsAction(actionState('revealed'), form({ auctionId }))

    expect(first.ok).toBe(true)
    expect(second).toEqual({ ok: true, phase: 'revealed', error: null })
    expect(repos.creates.filter((entry) => entry.data.action === 'sealed.reveal')).toHaveLength(1)
    expect(getSealedBidsMock).toHaveBeenCalledTimes(1)
    expect(decryptMock).toHaveBeenCalledTimes(1)
  })

  it('flags the top tie when the two highest amounts are equal', async () => {
    const repos = seededRepos()
    useRepos(repos)
    await signOpenerAndApprover(repos)
    getSealedBidsMock.mockResolvedValue([
      sealedRow('bid-late', 'user-b', 150_000, minutesAgo(29)),
      sealedRow('bid-early', 'user-a', 150_000, minutesAgo(31)),
    ] as never)

    await revealSealedBidsAction(actionState('awaiting-approval'), form({ auctionId }))

    const reveal = repos.creates.find((entry) => entry.data.action === 'sealed.reveal')
    expect(reveal?.data.after).toMatchObject({ topTie: true, topAmount: 150_000 })
  })
})

describe('sealedCeremonyStateAction (ranked read model)', () => {
  beforeEach(() => {
    auctionId = `auction-${crypto.randomUUID()}`
    state.session = { userId: 'opener-1', role: 'admin' }
    state.cookies = { access_token: 'token-opener' }
    vi.clearAllMocks()
    decryptMock.mockImplementation((bids) => bids as unknown as DecryptedBid[])
  })

  it('denies a role without sealed:read', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    useRepos(makeRepos(cleanFixture()))
    const context = await sealedCeremonyStateAction(auctionId)
    expect(context.error).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
  })

  it('collects the checklist: ending worker, pending alapakkumised, template age', async () => {
    const repos = makeRepos(
      cleanFixture({
        pendingBids: [{ id: 'bid-p1' }, { id: 'bid-p2' }],
        templates: [
          {
            id: 'tpl-1',
            name: 'Müügleping',
            version: '3',
            type: 'auction',
            active: true,
            updatedAt: minutesAgo(3 * 24 * 60 - 12 * 60),
          },
        ],
      }),
    )
    useRepos(repos)

    const context = await sealedCeremonyStateAction(auctionId)

    expect(context.error).toBeNull()
    expect(context.checklist.endingWorker.done).toBe(true)
    expect(context.checklist.endingWorker.key).toBe('worker-1')
    expect(context.checklist.pendingAlapakkumised).toBe(2)
    expect(context.checklist.template).toMatchObject({
      active: true,
      name: 'Müügleping',
      version: '3',
      changedWithin24h: true,
    })
  })

  it('marks a template older than 24 hours before the start as safe', async () => {
    const startsAt = minutesAgo(3 * 24 * 60)
    const repos = makeRepos(
      cleanFixture({
        auction: ceremonyAuction({ startsAt }),
        templates: [
          { id: 'tpl-1', name: 'Müügleping', version: '1', type: 'auction', active: true, updatedAt: minutesAgo(6 * 24 * 60) },
        ],
      }),
    )
    useRepos(repos)

    const context = await sealedCeremonyStateAction(auctionId)

    expect(context.checklist.template.changedWithin24h).toBe(false)
  })

  it('ranks revealed bids amount-desc with earliest-wins ties and computes the reserve verdict', async () => {
    const repos = makeRepos(
      cleanFixture({
        auditEntries: {
          auction_ended: [{ id: 'worker-1', createdAt: minutesAgo(10) }],
          'sealed.reveal': [{ id: 'reveal-1', createdAt: minutesAgo(5) }],
        },
      }),
    )
    useRepos(repos)
    getSealedBidsMock.mockResolvedValue([
      sealedRow('bid-late', 'user-b', 150_000, minutesAgo(29)),
      sealedRow('bid-early', 'user-a', 150_000, minutesAgo(31)),
      sealedRow('bid-low', 'user-c', 100_000, minutesAgo(28)),
      sealedRow('bid-bad', 'user-d', 999_000, minutesAgo(27), false),
    ] as never)

    const context = await sealedCeremonyStateAction(auctionId)

    expect(context.revealed).toBe(true)
    expect(context.bids.map((bid) => bid.id)).toEqual(['bid-early', 'bid-late', 'bid-low', 'bid-bad'])
    expect(context.bids[0]).toMatchObject({ rank: 1, tie: true, valid: true, invalidReason: null })
    expect(context.bids[3]).toMatchObject({
      rank: null,
      tie: false,
      valid: false,
      invalidReason: 'Krüptimine ebaõnnestus — pakkumine kehtetu',
    })
    expect(context.topMeetsReserve).toBe(true)
  })

  it('reports a reserve miss and empty ranking without valid bids', async () => {
    const repos = makeRepos(
      cleanFixture({
        auditEntries: {
          auction_ended: [{ id: 'worker-1', createdAt: minutesAgo(10) }],
          'sealed.reveal': [{ id: 'reveal-1', createdAt: minutesAgo(5) }],
        },
      }),
    )
    useRepos(repos)
    getSealedBidsMock.mockResolvedValue([
      sealedRow('bid-bad', 'user-d', 999_000, minutesAgo(27), false),
    ] as never)

    const context = await sealedCeremonyStateAction(auctionId)

    expect(context.bids).toHaveLength(1)
    expect(context.topMeetsReserve).toBe(false)
  })
})

describe('confirmSealedCeremonyWinnerAction (reserve branches)', () => {
  beforeEach(() => {
    auctionId = `auction-${crypto.randomUUID()}`
    state.session = { userId: 'opener-1', role: 'admin' }
    state.cookies = { access_token: 'token-opener' }
    vi.clearAllMocks()
    decryptMock.mockImplementation((bids) => bids as unknown as DecryptedBid[])
    verifyPasswordMock.mockResolvedValue(true)
  })

  const revealedRepos = (overrides: CeremonyFixture = {}): Repos =>
    makeRepos(
      cleanFixture({
        auditEntries: {
          auction_ended: [{ id: 'worker-1', createdAt: minutesAgo(10) }],
          'sealed.reveal': [{ id: 'reveal-1', createdAt: minutesAgo(5) }],
        },
        user: { id: 'opener-1', passwordHash: 'hash-1' },
        ...overrides,
      }),
    )

  const baseForm = (overrides: Record<string, string> = {}): FormData =>
    form({
      auctionId,
      bidId: 'bid-1',
      decision: 'sold',
      keyword: 'KINNITAN',
      password: '',
      reason: '',
      ...overrides,
    })

  const signedRepos = async (overrides: CeremonyFixture = {}): Promise<Repos> => {
    const repos = revealedRepos(overrides)
    useRepos(repos)
    await signOpenerAndApprover(repos)
    getSealedBidsMock.mockResolvedValue([
      sealedRow('bid-1', 'user-a', 150_000, minutesAgo(31)),
      sealedRow('bid-2', 'user-b', 120_000, minutesAgo(29)),
    ] as never)
    return repos
  }

  it('needs the KINNITAN keyword', async () => {
    await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm({ keyword: 'KINNITA' }))
    expect(result.error).toBe('Kirjuta kinnitusväljale "KINNITAN".')
  })

  it('rejects a decision other than sold, unsold or house-backup', async () => {
    await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm({ decision: 'maybe' }))
    expect(result.error).toBe('Vali tulemus: müük, müümata või varupakkumine.')
  })

  it('requires a typed reason for the unsold path', async () => {
    await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(
      actionState('revealed'),
      baseForm({ decision: 'unsold', reason: 'ei' }),
    )
    expect(result.error).toBe('Müümata märkimine vajab põhjust (vähemalt 5 tähemärki).')
  })

  it('lets only the opener confirm the winner after re-auth', async () => {
    await signedRepos()
    state.cookies.access_token = 'token-approver'
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm())
    expect(result.error).toBe('Võitja kinnitab avaja pärast uuesti autentimist.')
  })

  it('rejects a wrong step-up password', async () => {
    await signedRepos()
    verifyPasswordMock.mockResolvedValue(false)
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm({ password: 'vale' }))
    expect(result.error).toBe('Salasõna ei ole õige.')
  })

  it('refuses confirmation before the bids are revealed', async () => {
    const repos = makeRepos(
      cleanFixture({ auditEntries: { auction_ended: [{ id: 'worker-1', createdAt: minutesAgo(10) }] } }),
    )
    useRepos(repos)
    await signOpenerAndApprover(repos)
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm())
    expect(result.error).toBe('Enne kinnitamist paljasta pakkumised.')
  })

  it('confirms only the top valid bid as the winner', async () => {
    await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm({ bidId: 'bid-2' }))
    expect(result.error).toBe('Võitjaks saab kinnitada ainult kõrgeima kehtiva pakkumise.')
  })

  it('refuses a sale below the reserve', async () => {
    const repos = await signedRepos()
    getSealedBidsMock.mockResolvedValue([sealedRow('bid-1', 'user-a', 50_000, minutesAgo(31))] as never)
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm())
    expect(result.error).toBe('Kõrgeim pakkumis jääb piirhinnale alla; kasuta müümata või varupakkumise teed.')
    expect(repos.updates).toEqual([])
  })

  it('sells to the top bid: bid won, auction appraised, contract queued, winner_confirm audited', async () => {
    const repos = await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm())

    expect(result).toEqual({ ok: true, phase: 'confirmed', error: null })
    expect(repos.updates).toContainEqual({
      collection: 'bids',
      id: 'bid-1',
      data: { status: 'won' },
    })
    expect(repos.updates).toContainEqual({
      collection: 'auctions',
      id: auctionId,
      data: { status: 'appraised', winningBid: 'bid-1', finalPriceCents: 15_000_000 },
    })
    expect(prepareContractMock).toHaveBeenCalledWith(auctionId, 'auction', 'user-a')
    expect(upsertSnapshotMock).toHaveBeenCalled()
    const confirm = repos.creates.find((entry) => entry.data.action === 'sealed.winner_confirm')
    expect(confirm?.data.after).toMatchObject({
      bidId: 'bid-1',
      decision: 'sold',
      finalPrice: 150_000,
      reauth: 'token',
      openerUserId: 'opener-1',
      approverUserId: 'approver-1',
    })
  })

  it('uses password re-auth when the opener holds a password hash', async () => {
    const repos = await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(actionState('revealed'), baseForm({ password: 'salasõna' }))
    expect(result.ok).toBe(true)
    expect(verifyPasswordMock).toHaveBeenCalledWith('salasõna', 'hash-1')
    const confirm = repos.creates.find((entry) => entry.data.action === 'sealed.winner_confirm')
    expect(confirm?.data.after).toMatchObject({ reauth: 'password' })
  })

  it('marks the auction unsold with the typed reason', async () => {
    const repos = await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(
      actionState('revealed'),
      baseForm({ decision: 'unsold', reason: 'piirhind jäi alla' }),
    )
    expect(result).toEqual({ ok: true, phase: 'unsold', error: null })
    expect(repos.updates).toContainEqual({ collection: 'auctions', id: auctionId, data: { status: 'unsold' } })
    const unsold = repos.creates.find((entry) => entry.data.action === 'sealed.mark_unsold')
    expect(unsold?.data.after).toMatchObject({ reason: 'piirhind jäi alla' })
  })

  it('restricts the house-backup path to a superadmin', async () => {
    await signedRepos({ auction: ceremonyAuction({ isQuickAuction: true }) })
    const result = await confirmSealedCeremonyWinnerAction(
      actionState('revealed'),
      baseForm({ decision: 'house-backup' }),
    )
    expect(result.error).toBe('Varupakkumise töövoo käivitab ainult superadmin.')
  })

  it('restricts the house-backup path to a kiiroksjon', async () => {
    state.session = { userId: 'opener-1', role: 'superadmin' }
    await signedRepos()
    const result = await confirmSealedCeremonyWinnerAction(
      actionState('revealed'),
      baseForm({ decision: 'house-backup' }),
    )
    expect(result.error).toBe('Varupakkumine kehtib ainult kiiroksjonile.')
  })

  it('runs the superadmin house-backup on a kiiroksjon without a status change', async () => {
    state.session = { userId: 'opener-1', role: 'superadmin' }
    const repos = await signedRepos({ auction: ceremonyAuction({ isQuickAuction: true }) })
    const result = await confirmSealedCeremonyWinnerAction(
      actionState('revealed'),
      baseForm({ decision: 'house-backup', reason: 'maja varupakkumine' }),
    )
    expect(result).toEqual({ ok: true, phase: 'house-backup', error: null })
    expect(repos.updates).toEqual([])
    const backup = repos.creates.find((entry) => entry.data.action === 'sealed.house_backup')
    expect(backup?.data.after).toMatchObject({ reason: 'maja varupakkumine', topAmount: 150_000 })
  })
})

describe('voidSealedBidsAction (superadmin void)', () => {
  beforeEach(() => {
    auctionId = `auction-${crypto.randomUUID()}`
    state.session = { userId: 'opener-1', role: 'admin' }
    state.cookies = { access_token: 'token-opener' }
    vi.clearAllMocks()
    decryptMock.mockImplementation((bids) => bids as unknown as DecryptedBid[])
  })

  const voidForm = (overrides: Record<string, string> = {}): FormData =>
    form({ auctionId, reason: 'kahtlane pakkumine', ...overrides })

  it('denies a role that is not a superadmin', async () => {
    const repos = makeRepos(cleanFixture())
    useRepos(repos)
    const result = await voidSealedBidsAction(actionState('checklist'), voidForm())
    expect(result).toEqual({
      ok: false,
      phase: 'checklist',
      error: 'Avamise tühistada saab ainult superadmin.',
    })
    expect(repos.creates).toEqual([])
    expect(repos.updates).toEqual([])
  })

  it('rejects a reason shorter than 5 characters', async () => {
    state.session = { userId: 'opener-1', role: 'superadmin' }
    const repos = makeRepos(cleanFixture())
    useRepos(repos)
    const result = await voidSealedBidsAction(actionState('checklist'), voidForm({ reason: 'ei' }))
    expect(result).toEqual({
      ok: false,
      phase: 'checklist',
      error: 'Tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    })
    expect(repos.updates).toEqual([])
  })

  it('rejects every sealed bid, marks the lot unsold and audits sealed.void', async () => {
    state.session = { userId: 'opener-1', role: 'superadmin' }
    const repos = makeRepos(cleanFixture())
    useRepos(repos)
    getSealedBidsMock.mockResolvedValue([
      sealedRow('bid-1', 'user-a', 150_000, minutesAgo(30)),
      { ...sealedRow('bid-2', 'user-b', 120_000, minutesAgo(29)), status: 'rejected' },
    ] as never)

    const result = await voidSealedBidsAction(actionState('checklist'), voidForm())

    expect(result).toEqual({ ok: true, phase: 'unsold', error: null })
    expect(repos.updates).toContainEqual({
      collection: 'bids',
      id: 'bid-1',
      data: { status: 'rejected' },
    })
    expect(repos.updates).not.toContainEqual({
      collection: 'bids',
      id: 'bid-2',
      data: { status: 'rejected' },
    })
    expect(repos.updates).toContainEqual({
      collection: 'auctions',
      id: auctionId,
      data: { status: 'unsold' },
    })
    const voidEntry = repos.creates.find((entry) => entry.data.action === 'sealed.void')
    expect(voidEntry?.data).toMatchObject({
      actorId: 'opener-1',
      entityType: 'auction',
      entityId: auctionId,
      after: { reason: 'kahtlane pakkumine', status: 'unsold', voidedBidCount: 2 },
    })
  })

  it('replays a no-op success on a second void without a duplicate audit entry', async () => {
    state.session = { userId: 'opener-1', role: 'superadmin' }
    const repos = makeRepos(cleanFixture())
    useRepos(repos)
    getSealedBidsMock.mockResolvedValue([sealedRow('bid-1', 'user-a', 150_000, minutesAgo(30))] as never)

    const first = await voidSealedBidsAction(actionState('checklist'), voidForm())
    // The lot is now unsold; the replay must resolve before the ended-only gate.
    const second = await voidSealedBidsAction(actionState('unsold'), voidForm())

    expect(first.ok).toBe(true)
    expect(second).toEqual({ ok: true, phase: 'unsold', error: null })
    expect(repos.creates.filter((entry) => entry.data.action === 'sealed.void')).toHaveLength(1)
    expect(getSealedBidsMock).toHaveBeenCalledTimes(1)
  })

  it('reports context.voided through the state action after the void', async () => {
    state.session = { userId: 'opener-1', role: 'superadmin' }
    useRepos(makeRepos(cleanFixture()))
    getSealedBidsMock.mockResolvedValue([sealedRow('bid-1', 'user-a', 150_000, minutesAgo(30))] as never)

    await voidSealedBidsAction(actionState('checklist'), voidForm())
    const context = await sealedCeremonyStateAction(auctionId)

    expect(context.voided).toBe(true)
    expect(context.winnerConfirmed).toBe(false)
  })
})
