import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  listVoidConsequences,
  VOID_CONFIRM_KEYWORD,
  VOID_REASON_MIN_LENGTH,
} from '../../admin/contracts/_components/void-consequences'
import { voidContractAction } from '../contracts'

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

interface FindByIDArgs {
  collection: string
  id: string
}

function makeRepos(options: { failUpdatesFor?: string } = {}) {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  const docsByCollection: Record<string, Record<string, unknown> | null> = {}
  return {
    find: vi.fn(() => Promise.resolve({ docs: [] })),
    findByID: vi.fn((args: FindByIDArgs): Promise<unknown> =>
      Promise.resolve(docsByCollection[args.collection] ?? null),
    ),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: `new-${String(creates.length)}`, ...args.data })
    }),
    update: vi.fn((args: UpdateArgs) => {
      if (options.failUpdatesFor === args.collection) {
        return Promise.reject(new Error('boom'))
      }
      updates.push(args)
      return Promise.resolve({ id: args.id, ...args.data })
    }),
    creates,
    updates,
    docsByCollection,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos
  getRepositoriesMock.mockResolvedValue(repos as unknown as never)
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

const contract = {
  id: 'contract-1',
  status: 'sent',
  lotId: 'lot-1',
  templateId: 'tpl-1',
  signedBy: 'user-7',
}

const auctionInContract = { id: 'lot-1', status: 'contract', title: 'Metsaoksjon' }

describe('listVoidConsequences (dialog consequences data)', () => {
  const base = {
    isFramework: false,
    auctionRevertEligible: true,
    isSuperadmin: true,
    outcome: 'contract' as const,
    signerUserId: 'user-7',
  }

  it('keeps the typed keyword and minimum reason aligned with the server guard', () => {
    expect(VOID_CONFIRM_KEYWORD).toBe('TÜHISTA')
    expect(VOID_REASON_MIN_LENGTH).toBe(5)
  })

  it('lists the contract and audit consequences without a revert for the default outcome', () => {
    const result = listVoidConsequences(base)
    expect(result.auctionReverts).toBe(false)
    expect(result.frameworkRightsRevoked).toBe(false)
    expect(result.rightsMatrixPath).toBeNull()
    expect(result).toEqual({
      auctionReverts: false,
      frameworkRightsRevoked: false,
      rightsMatrixPath: null,
      lines: [
        'Leping läheb olekusse "tühistatud" ja seda ei saa tagasi pöörata.',
        'Tühistamise põhjus ja tulemus kantakse auditilogisse.',
      ],
    })
  })

  it('adds the auction revert consequence for a superadmin contract-and-result outcome', () => {
    const result = listVoidConsequences({ ...base, outcome: 'contract-and-result' })
    expect(result.auctionReverts).toBe(true)
    expect(result.lines[1]).toContain('lot läheb tagasi olekusse "lõppenud"')
  })

  it('never reverts for a non-superadmin, a plain outcome, or a lot outside `contract`', () => {
    expect(
      listVoidConsequences({ ...base, outcome: 'contract-and-result', isSuperadmin: false })
        .auctionReverts,
    ).toBe(false)
    expect(
      listVoidConsequences({ ...base, outcome: 'contract-and-result', auctionRevertEligible: false })
        .auctionReverts,
    ).toBe(false)
    expect(listVoidConsequences(base).auctionReverts).toBe(false)
  })

  it('detects a framework contract and links the signer rights matrix', () => {
    const result = listVoidConsequences({ ...base, isFramework: true })
    expect(result.frameworkRightsRevoked).toBe(true)
    expect(result.rightsMatrixPath).toBe('/admin/users/user-7?tab=oigused')
    expect(result.lines.some((line) => line.startsWith('Raamlepingu tühistamine'))).toBe(true)
  })

  it('flags framework consequences without a link when the contract has no signer', () => {
    const result = listVoidConsequences({ ...base, isFramework: true, signerUserId: null })
    expect(result.frameworkRightsRevoked).toBe(true)
    expect(result.rightsMatrixPath).toBeNull()
  })
})

describe('voidContractAction (validation)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    useRepos(repos)
  })

  it('demands a contract id', async () => {
    const url = await redirectOf(() => voidContractAction(form({ reason: 'kliendi soov', outcome: 'contract' })))
    expect(url.pathname).toBe('/admin/contracts')
    expect(url.searchParams.get('viga')).toBe('Tühistamiseks puudub lepingu identifikaator.')
  })

  it('rejects a reason shorter than five characters', async () => {
    const url = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'ei', outcome: 'contract' })),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Tühistamise põhjus on kohustuslik (vähemalt 5 tähemärki).',
    )
  })

  it('rejects an unknown outcome', async () => {
    const url = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'kõik' })),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Vali tühistamise tulemus: ainult leping või leping ja tulemus.',
    )
  })

  it('refuses the auction-revert outcome for a non-superadmin', async () => {
    const url = await redirectOf(() =>
      voidContractAction(
        form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract-and-result' }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Lepingu ja oksjoni tulemuse tühistamise peab tegema superadmin.',
    )
  })

  it('denies a role without contracts:write', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const url = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract' })),
    )
    expect(url.searchParams.get('viga')).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
    expect(repos.updates).toEqual([])
  })

  it('rejects a missing, signed, or already voided contract', async () => {
    const missing = await redirectOf(() =>
      voidContractAction(form({ id: 'ghost', reason: 'kliendi soov', outcome: 'contract' })),
    )
    expect(missing.searchParams.get('viga')).toBe('Lepingut ei leitud.')

    repos.docsByCollection.contracts = { ...contract, status: 'signed' }
    const signed = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract' })),
    )
    expect(signed.pathname).toBe('/admin/contracts/contract-1')
    expect(signed.searchParams.get('viga')).toBe('Allkirjastatud lepingut tühistada ei saa.')

    repos.docsByCollection.contracts = { ...contract, status: 'voided' }
    const voided = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract' })),
    )
    expect(voided.searchParams.get('viga')).toBe('Leping on juba tühistatud.')
  })
})

describe('voidContractAction (cascades)', () => {
  let repos: Repos

  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
    repos = makeRepos()
    repos.docsByCollection.contracts = contract
    repos.docsByCollection.auctions = auctionInContract
    useRepos(repos)
  })

  it('voids the contract only and audits reason, outcome, and previous status', async () => {
    const url = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract' })),
    )
    expect(url.searchParams.get('teade')).toBe('Leping tühistatud.')

    expect(repos.updates).toEqual([
      { collection: 'contracts', id: 'contract-1', data: { status: 'voided' } },
    ])
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'contract.void',
      entityType: 'contract',
      entityId: 'contract-1',
      after: {
        reason: 'kliendi soov',
        outcome: 'contract',
        previousStatus: 'sent',
        auctionId: 'lot-1',
        auctionReverted: false,
      },
    })
  })

  it('reverts the auction result for a superadmin when the lot sits in `contract`', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }
    const url = await redirectOf(() =>
      voidContractAction(
        form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract-and-result' }),
      ),
    )
    expect(url.searchParams.get('teade')).toBe(
      'Leping tühistatud; oksjoni tulemus tühistatud ja lot tagasi olekus "lõppenud".',
    )
    expect(repos.updates).toEqual([
      {
        collection: 'auctions',
        id: 'lot-1',
        data: { status: 'ended', winningBid: null, finalPriceCents: null },
      },
      { collection: 'contracts', id: 'contract-1', data: { status: 'voided' } },
    ])
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({ after: { auctionReverted: true } })
  })

  it('skips the auction revert when the lot already left `contract`', async () => {
    state.session = { userId: 'root-1', role: 'superadmin' }
    repos.docsByCollection.auctions = { ...auctionInContract, status: 'completed' }
    const url = await redirectOf(() =>
      voidContractAction(
        form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract-and-result' }),
      ),
    )
    expect(url.searchParams.get('teade')).toBe('Leping tühistatud.')
    expect(repos.updates).toEqual([
      { collection: 'contracts', id: 'contract-1', data: { status: 'voided' } },
    ])
    const audit = repos.creates.find((entry) => entry.collection === 'audit-entry')
    expect(audit?.data).toMatchObject({ after: { auctionReverted: false } })
  })

  it('redirects with the repository failure when the write fails', async () => {
    repos = makeRepos({ failUpdatesFor: 'contracts' })
    repos.docsByCollection.contracts = contract
    useRepos(repos)
    const url = await redirectOf(() =>
      voidContractAction(form({ id: 'contract-1', reason: 'kliendi soov', outcome: 'contract' })),
    )
    expect(url.searchParams.get('viga')).toBe('Lepingu tühistamine ebaõnnestus: boom')
  })
})
