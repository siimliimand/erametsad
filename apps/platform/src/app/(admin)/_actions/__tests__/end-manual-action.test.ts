import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CoreRepositories } from '@/lib/data/repositories'

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

const state = vi.hoisted(() => ({
  session: { userId: 'admin-1', role: 'admin' } as { userId: string; role: string },
  repositories: null as unknown,
  cookies: {} as Record<string, string | undefined>,
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
  cookies: vi.fn(async () => ({
    get: (name: string) =>
      state.cookies?.[name] !== undefined ? { value: state.cookies[name] } : undefined,
  })),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(async () => {
    throw new Error('trusted repositories are not used by endAuctionManuallyAction')
  }),
  sessionGuardContext: (payload: unknown) => payload,
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(async () => ({
    session: state.session,
    repositories: state.repositories,
  })),
}))

import { endAuctionManuallyAction } from '../auctions'

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

function makeRepos(router: (args: FindArgs) => { docs: Record<string, unknown>[] } | undefined) {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  return {
    find: vi.fn(async (args: FindArgs) => router(args) ?? { docs: [] }),
    findByID: vi.fn(async () => null),
    create: vi.fn(async (args: CreateArgs) => {
      creates.push(args)
      return { id: `new-${String(creates.length)}`, ...args.data }
    }),
    update: vi.fn(async (args: UpdateArgs) => {
      updates.push(args)
      return { id: args.id, ...args.data }
    }),
    delete: vi.fn(async () => undefined),
    creates,
    updates,
  }
}

type Repos = ReturnType<typeof makeRepos>

function useRepos(repos: Repos): void {
  state.repositories = repos as unknown as CoreRepositories
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

const activeAuction = {
  id: 'auction-1',
  status: 'active',
  title: 'Testioksjon',
  specialistId: 'specialist-1',
  sellerId: 'seller-1',
}

const leadingBid = {
  id: 'bid-1',
  auctionId: 'auction-1',
  amountCents: 80_000,
  status: 'leading',
}

describe('endAuctionManuallyAction', () => {
  beforeEach(() => {
    state.session = { userId: 'admin-1', role: 'admin' }
  })

  const withAuction = (auction: Record<string, unknown> | null, repos: Repos): void => {
    repos.findByID.mockImplementation(async (args: { collection: string; id: string }) => {
      if (args.collection === 'auctions') return (auction as never) ?? null
      return null
    })
  }

  it('requires an auction identifier', async () => {
    const repos = makeRepos(() => undefined)
    useRepos(repos)
    const url = await redirectOf(() => endAuctionManuallyAction(form({})))
    expect(url.pathname).toBe('/admin/auctions')
    expect(url.searchParams.get('viga')).toBe('Lõpetamiseks puudub oksjoni identifikaator.')
  })

  it('reports a missing auction', async () => {
    const repos = makeRepos(() => undefined)
    withAuction(null, repos)
    useRepos(repos)
    const url = await redirectOf(() => endAuctionManuallyAction(form({ id: 'auction-1' })))
    expect(url.searchParams.get('viga')).toBe('Oksjonit ei leitud.')
  })

  it('denies the specialist role even on its own lot', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const repos = makeRepos(() => undefined)
    withAuction({ ...activeAuction, specialistId: 'specialist-1' }, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'müük tühistati', outcome: 'unsold' })),
    )
    expect(url.searchParams.get('viga')).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
    expect(repos.updates).toEqual([])
  })

  it('denies the seller role', async () => {
    state.session = { userId: 'seller-1', role: 'seller' }
    const repos = makeRepos(() => undefined)
    withAuction({ ...activeAuction, sellerId: 'seller-1' }, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'müük tühistati', outcome: 'unsold' })),
    )
    expect(url.searchParams.get('viga')).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
    expect(repos.updates).toEqual([])
  })

  it('checks the end-manual permission before the lot scope', async () => {
    // The specialist role is deny-listed on auctions:end-manual, so the
    // permission denial always fires before the foreign-lot scope check.
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const repos = makeRepos(() => undefined)
    withAuction({ ...activeAuction, specialistId: 'specialist-2' }, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'müük tühistati', outcome: 'unsold' })),
    )
    expect(url.searchParams.get('viga')).toBe('Teil puudub õigus selle toimingu sooritamiseks.')
    expect(repos.updates).toEqual([])
  })

  it('only ends an active auction', async () => {
    const repos = makeRepos(() => undefined)
    withAuction({ ...activeAuction, status: 'scheduled' }, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'müük tühistati', outcome: 'unsold' })),
    )
    expect(url.searchParams.get('viga')).toBe('Käsitsi saab lõpetada ainult aktiivset oksjonit.')
  })

  it('rejects a reason shorter than 5 characters', async () => {
    const repos = makeRepos(() => undefined)
    withAuction(activeAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'lühi', outcome: 'unsold' })),
    )
    expect(url.searchParams.get('viga')).toBe('Kirjuta põhjus (vähemalt 5 tähemärki).')
    expect(repos.updates).toEqual([])
  })

  it('rejects an outcome other than winner or unsold', async () => {
    const repos = makeRepos(() => undefined)
    withAuction(activeAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'müük tühistati', outcome: 'maybe' })),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Vali lõpetamise tulemus: võitja kuulutamine või müümata märkimine.',
    )
  })

  it('refuses the winner outcome without a leading bid', async () => {
    const repos = makeRepos(() => ({ docs: [] }))
    withAuction(activeAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'juhtiv pakkumus olemas', outcome: 'winner' })),
    )
    expect(url.searchParams.get('viga')).toBe('Juhtivat pakkumust ei ole; märgi oksjon müümata.')
    expect(repos.updates).toEqual([])
  })

  it('declares the leading bid the winner: ended then appraised, bid won, audited', async () => {
    const repos = makeRepos((args) =>
      args.collection === 'bids' ? { docs: [leadingBid] } : undefined,
    )
    withAuction(activeAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'oksjon lõpetati enne tähtaega', outcome: 'winner' })),
    )
    expect(repos.updates.map((update) => update.data)).toEqual([
      { status: 'ended' },
      { status: 'won' },
      { status: 'appraised', winningBid: 'bid-1', finalPriceCents: 80_000 },
    ])
    expect(repos.updates[1]?.collection).toBe('bids')
    expect(repos.creates).toHaveLength(1)
    expect(repos.creates[0]?.collection).toBe('audit-entry')
    expect(repos.creates[0]?.data).toEqual({
      actorId: 'admin-1',
      action: 'auction.end_manual',
      entityType: 'auction',
      entityId: 'auction-1',
      after: {
        outcome: 'winner',
        reason: 'oksjon lõpetati enne tähtaega',
        bidId: 'bid-1',
        finalPriceCents: 80_000,
        status: 'appraised',
      },
    })
    expect(url.searchParams.get('teade')).toBe('Oksjon lõpetatud; juhtiv pakkumus kuulutatud võitjaks.')
  })

  it('honors the client return path from the monitor modal', async () => {
    const repos = makeRepos((args) =>
      args.collection === 'bids' ? { docs: [leadingBid] } : undefined,
    )
    withAuction(activeAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(
        form({
          id: 'auction-1',
          reason: 'oksjon lõpetati enne tähtaega',
          outcome: 'winner',
          redirectTo: '/admin/auctions/auction-1/monitor',
        }),
      ),
    )
    expect(url.pathname).toBe('/admin/auctions/auction-1/monitor')
    expect(url.searchParams.get('teade')).not.toBeNull()
  })

  it('marks the auction unsold without touching bids and audits the outcome', async () => {
    const repos = makeRepos((args) =>
      args.collection === 'bids' ? { docs: [leadingBid] } : undefined,
    )
    withAuction(activeAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'piirhind ei ole saavutatud', outcome: 'unsold' })),
    )
    expect(repos.updates.map((update) => update.data)).toEqual([{ status: 'ended' }, { status: 'unsold' }])
    expect(repos.updates.every((update) => update.collection === 'auctions')).toBe(true)
    expect(repos.creates[0]?.data).toMatchObject({
      action: 'auction.end_manual',
      entityId: 'auction-1',
      after: { outcome: 'unsold', reason: 'piirhind ei ole saavutatud', status: 'unsold' },
    })
    expect(url.searchParams.get('teade')).toBe('Oksjon lõpetatud ja märgitud müümata.')
  })

  it('reports a repository failure through the Estonian error redirect', async () => {
    const repos = makeRepos((args) =>
      args.collection === 'bids' ? { docs: [leadingBid] } : undefined,
    )
    withAuction(activeAuction, repos)
    repos.update.mockRejectedValueOnce(new Error('db down'))
    useRepos(repos)
    const url = await redirectOf(() =>
      endAuctionManuallyAction(form({ id: 'auction-1', reason: 'müük tühistati', outcome: 'unsold' })),
    )
    expect(url.searchParams.get('viga')).toBe('Käsitsi lõpetamine ebaõnnestus: db down')
  })
})
