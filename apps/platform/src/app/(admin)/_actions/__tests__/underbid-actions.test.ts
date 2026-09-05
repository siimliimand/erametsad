import { beforeEach, describe, expect, it, vi } from 'vitest'

import { approveUnderbidAction, rejectUnderbidAction } from '../auctions'

import type { ApproveDecision, RejectDecision } from '@/lib/bidding/alapakkumine'
import { approveAlapakkumine, rejectAlapakkumine } from '@/lib/bidding/alapakkumine'
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

vi.mock('@/lib/bidding/alapakkumine', () => ({
  approveAlapakkumine: vi.fn(),
  rejectAlapakkumine: vi.fn(),
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

const approveMock = vi.mocked(approveAlapakkumine)
const rejectMock = vi.mocked(rejectAlapakkumine)
const getRepositoriesMock = vi.mocked(getRepositories)

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  return {
    find: vi.fn((_args: { collection: string }) =>
      Promise.resolve({ docs: [] as Record<string, unknown>[] }),
    ),
    findByID: vi.fn(
      (_args: { collection: string; id: string }): Promise<unknown> => Promise.resolve(null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((args: { collection: string; id: string; data: Record<string, unknown> }) =>
      Promise.resolve(args.data),
    ),
    delete: vi.fn(() => Promise.resolve(undefined)),
    creates,
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

const auction = {
  id: 'auction-1',
  status: 'active',
  title: 'Metsaoksjon',
  specialistId: 'specialist-1',
  sellerId: 'seller-1',
}

const approvedDecision: ApproveDecision = {
  outcome: 'approved',
  bid: { bidId: 'bid-1', bidderId: 'user-9', amount: 80, auctionTitle: 'Metsaoksjon' },
  displacedLeader: null,
}

const rejectedDecision: RejectDecision = {
  outcome: 'rejected',
  bid: { bidId: 'bid-1', bidderId: 'user-9', amount: 80, auctionTitle: 'Metsaoksjon' },
}

const earlierDecisionEntry = {
  id: 'audit-1',
  actorId: 'admin-9',
  action: 'bid.approve',
  entityType: 'bid',
  entityId: 'bid-1',
  createdAt: '2026-09-01T10:00:00.000Z',
}

/** Trusted repository fake: the auction lookup, decision audit lookups and actor lookups. */
function useTrusted(options: {
  auction?: Record<string, unknown> | null
  auditEntries?: Record<string, unknown>[]
  actor?: Record<string, unknown> | null
}): Repos {
  const trusted = makeRepos()
  trusted.findByID.mockImplementation((args: { collection: string; id: string }) => {
    if (args.collection === 'auctions') return Promise.resolve(options.auction ?? null)
    if (args.collection === 'users') return Promise.resolve(options.actor ?? null)
    return Promise.resolve(null)
  })
  trusted.find.mockImplementation((args: { collection: string }) =>
    Promise.resolve(
      args.collection === 'audit-entry'
        ? { docs: options.auditEntries ?? [] }
        : { docs: [] },
    ),
  )
  getRepositoriesMock.mockResolvedValue(trusted as unknown as CoreRepositories)
  return trusted
}

describe('approveUnderbidAction', () => {
  let guarded: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    approveMock.mockReset()
    rejectMock.mockReset()
    guarded = makeRepos()
    state.repositories = guarded
  })

  it('approves a pending alapakkumine and writes the bid.approve audit entry', async () => {
    useTrusted({ auction })
    approveMock.mockResolvedValue(approvedDecision)

    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )

    expect(approveMock).toHaveBeenCalledWith('auction-1', 'bid-1')
    expect(guarded.creates).toHaveLength(1)
    expect(guarded.creates[0]).toEqual({
      collection: 'audit-entry',
      data: {
        actorId: 'admin-1',
        action: 'bid.approve',
        entityType: 'bid',
        entityId: 'bid-1',
        after: { auctionId: 'auction-1', amountEur: 80, bidderNotified: true },
      },
    })
    expect(url.pathname).toBe('/admin/bids')
    expect(url.searchParams.get('teade')).toBe('Alapakkumus kinnitatud ja juhtivaks seatud; osapooled teavitatud.')
  })

  it('lets the seller decide on its own lot', async () => {
    state.session = { userId: 'seller-1', role: 'seller' }
    useTrusted({ auction })
    approveMock.mockResolvedValue(approvedDecision)

    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )

    expect(approveMock).toHaveBeenCalledOnce()
    expect(url.searchParams.get('teade')).not.toBeNull()
  })

  it('rejects a seller deciding on a foreign seller lot before the domain call', async () => {
    state.session = { userId: 'seller-2', role: 'seller' }
    useTrusted({ auction })
    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )
    expect(url.searchParams.get('viga')).toBe('Oksjon ei ole teie tööulatuses.')
    expect(approveMock).not.toHaveBeenCalled()
    expect(guarded.creates).toEqual([])
  })

  it('requires both identifiers', async () => {
    useTrusted({ auction })
    const url = await redirectOf(() => approveUnderbidAction(form({ auctionId: 'auction-1' })))
    expect(url.searchParams.get('viga')).toBe('Pakkumuse otsustamiseks puudub identifikaator.')
  })

  it('reports a missing auction', async () => {
    useTrusted({ auction: null })
    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )
    expect(url.searchParams.get('viga')).toBe('Oksjonit ei leitud.')
  })

  it('surfaces the first decision from the audit chain on a losing race', async () => {
    useTrusted({ auction, auditEntries: [earlierDecisionEntry], actor: { id: 'admin-9', name: 'Kaire Kask' } })
    approveMock.mockResolvedValue({ outcome: 'not_pending', status: 'leading' })

    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )

    expect(url.searchParams.get('viga')).toMatch(/^Juba otsustatud \(Kaire Kask/)
    expect(guarded.creates).toEqual([])
  })

  it('falls back to the status message without an earlier decision entry', async () => {
    useTrusted({ auction, auditEntries: [] })
    approveMock.mockResolvedValue({ outcome: 'not_pending', status: 'leading' })

    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )

    expect(url.searchParams.get('viga')).toBe('Pakkumus ei ole enam kinnitamisel (hetke olek: leading).')
  })

  it('maps auction_not_active to the explicit Estonian failure', async () => {
    useTrusted({ auction })
    approveMock.mockResolvedValue({ outcome: 'auction_not_active' })

    const url = await redirectOf(() =>
      approveUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1' })),
    )

    expect(url.searchParams.get('viga')).toBe('Oksjon pole aktiivne; alapakkumuse otsustamine pole enam lubatud.')
  })
})

describe('rejectUnderbidAction', () => {
  let guarded: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    approveMock.mockReset()
    rejectMock.mockReset()
    guarded = makeRepos()
    state.repositories = guarded
  })

  it('rejects with a typed reason and records it in the audit entry', async () => {
    useTrusted({ auction })
    rejectMock.mockResolvedValue(rejectedDecision)

    const url = await redirectOf(() =>
      rejectUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1', reason: 'pakkumus alla miinimumi' })),
    )

    expect(rejectMock).toHaveBeenCalledWith('auction-1', 'bid-1')
    expect(guarded.creates[0]?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'bid.reject',
      entityType: 'bid',
      entityId: 'bid-1',
      after: { auctionId: 'auction-1', amountEur: 80, reason: 'pakkumus alla miinimumi', bidderNotified: true },
    })
    expect(url.searchParams.get('teade')).toBe('Alapakkumus tagasi lükatud; pakkuja teavitatud põhjusega.')
  })

  it('rejects a reason shorter than 5 characters before touching the domain', async () => {
    useTrusted({ auction })
    const url = await redirectOf(() =>
      rejectUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1', reason: 'ei' })),
    )
    expect(url.searchParams.get('viga')).toBe('Kirjuta põhjus (vähemalt 5 tähemärki).')
    expect(rejectMock).not.toHaveBeenCalled()
  })

  it('rejects a seller deciding on a foreign seller lot', async () => {
    state.session = { userId: 'seller-2', role: 'seller' }
    useTrusted({ auction })
    const url = await redirectOf(() =>
      rejectUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1', reason: 'pakkumus alla miinimumi' })),
    )
    expect(url.searchParams.get('viga')).toBe('Oksjon ei ole teie tööulatuses.')
    expect(rejectMock).not.toHaveBeenCalled()
  })

  it('surfaces the first outcome on a double-decision race', async () => {
    useTrusted({ auction, auditEntries: [earlierDecisionEntry], actor: { id: 'admin-9', name: 'Kaire Kask' } })
    rejectMock.mockResolvedValue({ outcome: 'not_pending', status: 'pending_approval' })

    const url = await redirectOf(() =>
      rejectUnderbidAction(form({ auctionId: 'auction-1', bidId: 'bid-1', reason: 'pakkumus alla miinimumi' })),
    )

    expect(url.searchParams.get('viga')).toMatch(/^Juba otsustatud \(Kaire Kask/)
  })
})
