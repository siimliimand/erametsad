import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted((): {
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

vi.mock('next/navigation', () => ({
  redirect: (url: string): never => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (): undefined => undefined,
  })),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
  verifyAdminAccessToken: vi.fn(),
}))

vi.mock('@/lib/auth/password', () => ({
  verifyPassword: vi.fn(),
}))

vi.mock('@/lib/bidding/sealed-bid', () => ({
  getSealedBidsForAuction: vi.fn(),
  decryptSealedBids: vi.fn(),
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

vi.mock('../../../../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

import { revealBidderIdentityAction } from '../../../../../_actions/auctions'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

const getRepositoriesMock = vi.mocked(getRepositories)

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface FindByIDArgs {
  collection: string
  id: string
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const calls: string[] = []
  const docs: Record<string, Record<string, unknown> | null> = {}
  return {
    creates,
    calls,
    docs,
    findByID: vi.fn((args: FindByIDArgs): Promise<unknown> => {
      calls.push(`find:${args.collection}`)
      return Promise.resolve(docs[args.collection] ?? null)
    }),
    create: vi.fn((args: CreateArgs) => {
      calls.push(`create:${String(args.data.action)}`)
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as unknown as CoreRepositories)
}

describe('revealBidderIdentityAction (audited reveal for the monitor chips)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docs.bids = { id: 'bid-1', auctionId: 'auction-1', userId: 'user-9', status: 'outbid' }
    repos.docs.auctions = {
      id: 'auction-1',
      specialistId: 'specialist-1',
      sellerId: 'seller-1',
    }
    repos.docs.users = { id: 'user-9', name: 'Mari Maasikas', email: 'mari@naide.ee' }
    useRepos(repos)
  })

  it('writes the user.identity_view audit entry before the identity is read', async () => {
    const result = await revealBidderIdentityAction('bid-1')

    expect(result).toEqual({
      ok: true,
      identity: { name: 'Mari Maasikas', email: 'mari@naide.ee' },
    })
    expect(repos.calls).toEqual([
      'find:bids',
      'find:auctions',
      'create:user.identity_view',
      'find:users',
    ])
    expect(repos.creates[0]?.data).toEqual({
      actorId: 'admin-1',
      action: 'user.identity_view',
      entityType: 'user',
      entityId: 'user-9',
      after: { bidId: 'bid-1', auctionId: 'auction-1' },
    })
  })

  it('never returns the identity when the audit write fails', async () => {
    repos.create.mockRejectedValueOnce(new Error('audit write failed'))

    const result = await revealBidderIdentityAction('bid-1')

    expect(result).toEqual({
      ok: false,
      error: 'Identiteedi avamine nurjus (auditikirje salvestamine ebaõnnestus).',
    })
    expect(repos.calls).not.toContain('find:users')
  })

  it('keeps the identity hidden from sellers outside an alapakkumine decision', async () => {
    state.session = { userId: 'seller-1', role: 'seller' }

    const result = await revealBidderIdentityAction('bid-1')

    expect(result).toEqual({
      ok: false,
      error: 'Identiteet on nähtav ainult alapakkumise otsuse korral.',
    })
    expect(repos.creates).toEqual([])
  })

  it('reports an auction outside the role scope', async () => {
    state.session = { userId: 'specialist-9', role: 'specialist' }

    const result = await revealBidderIdentityAction('bid-1')

    expect(result).toEqual({ ok: false, error: 'Oksjon ei ole teie tööulatuses.' })
    expect(repos.creates).toEqual([])
  })

  it('reports a missing bid', async () => {
    repos.docs.bids = null

    const result = await revealBidderIdentityAction('bid-1')

    expect(result).toEqual({ ok: false, error: 'Pakkumust ei leitud.' })
    expect(repos.creates).toEqual([])
  })

  it('refuses a blank bid identifier without any repository read', async () => {
    const result = await revealBidderIdentityAction('   ')

    expect(result).toEqual({ ok: false, error: 'Pakkumuse identifikaator puudub.' })
    expect(repos.calls).toEqual([])
  })
})
