import { describe, expect, it, vi } from 'vitest'

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

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: () => undefined,
  })),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(() => Promise.reject(new Error('trusted repositories are not used here'))),
  sessionGuardContext: (payload: unknown) => payload,
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

import {
  createAuctionAction,
  duplicateAuctionAction,
  publishAuctionAction,
  updateAuctionAction,
} from '../auctions'

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

interface UpdateArgs {
  collection: string
  id: string
  data: Record<string, unknown>
}

function makeRepos(): {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
  creates: CreateArgs[]
  updates: UpdateArgs[]
} {
  const creates: CreateArgs[] = []
  const updates: UpdateArgs[] = []
  return {
    find: vi.fn(() => Promise.resolve({ docs: [] })),
    findByID: vi.fn(() => Promise.resolve(null)),
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

const hourFromNow = (hours: number): string =>
  new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()

const storedAuction = (overrides: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'auction-1',
  title: 'Testioksjon',
  slug: 'testioksjon',
  status: 'draft',
  objectType: 'raieoigus',
  type: 'open',
  isQuickAuction: false,
  specialistId: 'specialist-1',
  sellerId: null,
  countyId: 'county-1',
  parishId: 'parish-1',
  address: null,
  coordinates: null,
  cadastres: ['34801:001:0217'],
  registryNumbers: [],
  species: [],
  loggingTypes: [],
  compartments: [],
  notifications: [],
  areaHa: 12.4,
  volumeM3: 980,
  deadlines: null,
  minBidCents: 300000,
  bidStepCents: 5000,
  reservePriceCents: null,
  feeOverridePercent: null,
  startsAt: hourFromNow(2),
  endsAt: hourFromNow(26),
  aliasEmail: 'mtabc123@oksjonid.erametsad.ee',
  media: [],
  files: null,
  packageHeader: null,
  // Row-level measures keep the raieõigus volume gate happy on publish.
  packageRows: [{ area: 12.4, volume: 980 }],
  packageColumns: null,
  ...overrides,
})

const wizardPayload = (overrides: Record<string, unknown> = {}): string =>
  JSON.stringify({
    title: 'Uuendatud pealkiri',
    objectType: 'raieoigus',
    auctionType: 'open',
    isQuickAuction: false,
    antiSnipeEnabled: false,
    startsAt: hourFromNow(1),
    endsAt: hourFromNow(25),
    minBidEur: 3000,
    bidStepEur: 50,
    areaHa: 12.5,
    volumeM3: 980,
    cadastres: ['34801:001:0217'],
    countyId: 'county-1',
    parishId: 'parish-1',
    deadlines: {},
    descriptionPublic: '',
    descriptionSecondary: '',
    media: [],
    ...overrides,
  })

const withAuction = (auction: unknown, repos: Repos): void => {
  repos.findByID.mockImplementation((args: { collection: string; id: string }) =>
    Promise.resolve(args.collection === 'auctions' ? auction : null),
  )
}

const auditActions = (repos: Repos): unknown[] =>
  repos.creates
    .filter((entry) => entry.collection === 'audit-entry')
    .map((entry) => (entry.data as { action?: string }).action)

describe('area/volume columns (task 5.1 follow-ups)', () => {
  it('persists areaHa/volumeM3 as columns from the wizard payload', async () => {
    const repos = makeRepos()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    await redirectOf(() => updateAuctionAction(form({ id: 'auction-1', payload: wizardPayload() })))
    expect(repos.updates[0]?.data).toMatchObject({
      areaHa: 12.5,
      volumeM3: 980,
      // The deadlines JSON mirror still travels for guest preview reads.
      deadlines: { areaHa: 12.5, volumeM3: 980 },
    })
  })

  it('copies areaHa/volumeM3 into the draft clone', async () => {
    const repos = makeRepos()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    await redirectOf(() => duplicateAuctionAction(form({ id: 'auction-1' })))
    expect(repos.creates[0]?.collection).toBe('auctions')
    expect(repos.creates[0]?.data).toMatchObject({ areaHa: 12.4, volumeM3: 980, status: 'draft' })
  })
})

describe('wizard intents', () => {
  it('saves a plain draft by default and never touches the status', async () => {
    const repos = makeRepos()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(form({ id: 'auction-1', payload: wizardPayload() })),
    )
    expect(url.pathname).toBe('/admin/auctions/auction-1')
    expect(url.searchParams.get('teade')).toBeNull()
    expect(repos.updates[0]?.data).not.toHaveProperty('status')
    expect(auditActions(repos)).toEqual(['auction.update'])
  })

  it('Ajasta moves a draft to scheduled and audits auction.schedule', async () => {
    const repos = makeRepos()
    const payload = wizardPayload()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(form({ id: 'auction-1', payload, intent: 'schedule' })),
    )
    expect(url.searchParams.get('teade')).toBe('Oksjon ajastatud.')
    expect(repos.updates[1]?.data).toMatchObject({ status: 'scheduled' })
    expect(repos.updates[1]?.data.scheduledAt).toBe((JSON.parse(payload) as { startsAt: string }).startsAt)
    expect(auditActions(repos)).toEqual(['auction.update', 'auction.schedule'])
  })

  it('Ajasta refuses a start closer than 10 minutes', async () => {
    const repos = makeRepos()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(
        form({
          id: 'auction-1',
          payload: wizardPayload({ startsAt: hourFromNow(1 / 12) }),
          intent: 'schedule',
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Ajastamine ei ole lubatud: Algusaeg peab olema vähemalt 10 minutit tulevikus.',
    )
    expect(repos.updates.every((update) => update.data.status === undefined)).toBe(true)
  })

  it('Avalda kohe publishes through the gate chain and audits auction.publish', async () => {
    const repos = makeRepos()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(form({ id: 'auction-1', payload: wizardPayload(), intent: 'publish' })),
    )
    expect(url.searchParams.get('teade')).toBe('Oksjon on avaldatud.')
    expect(repos.updates[1]?.data).toMatchObject({ status: 'scheduled' })
    expect(auditActions(repos)).toEqual(['auction.update', 'auction.publish'])
  })

  it('Avalda kohe is blocked without a specialist', async () => {
    const repos = makeRepos()
    withAuction(storedAuction({ specialistId: null }), repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(form({ id: 'auction-1', payload: wizardPayload(), intent: 'publish' })),
    )
    expect(url.searchParams.get('viga')).toBe(
      'Avaldamine on blokeeritud: Sisu → Määra vastutav spetsialist enne avaldamist.',
    )
    expect(repos.updates.every((update) => update.data.status === undefined)).toBe(true)
  })

  it('create + Avalda kohe with a failed gate lands on the preserved draft editor', async () => {
    const repos = makeRepos()
    useRepos(repos)
    const url = await redirectOf(() =>
      createAuctionAction(form({ payload: wizardPayload({ specialistId: undefined }), intent: 'publish' })),
    )
    expect(url.pathname).toBe('/admin/auctions/new-1/edit')
    expect(url.searchParams.get('viga')).toContain('Määra vastutav spetsialist enne avaldamist.')
    // The draft was created; only the publish transition is blocked.
    expect(repos.creates[0]?.collection).toBe('auctions')
    expect(repos.updates).toEqual([])
  })

  it('create + Ajasta schedules the fresh draft', async () => {
    const repos = makeRepos()
    useRepos(repos)
    const url = await redirectOf(() =>
      createAuctionAction(form({ payload: wizardPayload(), intent: 'schedule' })),
    )
    expect(url.pathname).toBe('/admin/auctions/new-1')
    expect(url.searchParams.get('teade')).toBe('Oksjon ajastatud.')
    expect(repos.updates[0]?.data).toMatchObject({ status: 'scheduled' })
    expect(auditActions(repos)).toEqual(['auction.create', 'auction.schedule'])
  })
})

describe('publish readiness gates (publishAuctionAction)', () => {
  it('blocks without a specialist', async () => {
    const repos = makeRepos()
    withAuction(storedAuction({ specialistId: null }), repos)
    useRepos(repos)
    const url = await redirectOf(() => publishAuctionAction(form({ id: 'auction-1' })))
    expect(url.searchParams.get('viga')).toContain('Määra vastutav spetsialist enne avaldamist.')
    expect(repos.updates).toEqual([])
  })

  it('blocks a start closer than 10 minutes', async () => {
    const repos = makeRepos()
    withAuction(storedAuction({ startsAt: hourFromNow(1 / 12) }), repos)
    useRepos(repos)
    const url = await redirectOf(() => publishAuctionAction(form({ id: 'auction-1' })))
    expect(url.searchParams.get('viga')).toContain(
      'Algusaeg peab olema vähemalt 10 minutit tulevikus.',
    )
  })

  it('blocks a lot without area', async () => {
    const repos = makeRepos()
    withAuction(storedAuction({ areaHa: null, packageRows: [] }), repos)
    useRepos(repos)
    const url = await redirectOf(() => publishAuctionAction(form({ id: 'auction-1' })))
    expect(url.searchParams.get('viga')).toContain('Pindala (ha) peab olema suurem kui 0.')
  })

  it('publishes a ready lot as scheduled with the audit entry', async () => {
    const repos = makeRepos()
    const auction = storedAuction()
    withAuction(auction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      publishAuctionAction(form({ id: 'auction-1', auditNote: 'kohapeal kinnitatud' })),
    )
    expect(url.searchParams.get('teade')).toBe('Oksjon ajastatud ja avalikustatud.')
    expect(repos.updates[0]?.data).toMatchObject({
      status: 'scheduled',
      scheduledAt: auction.startsAt,
    })
    expect(repos.creates[0]?.data).toMatchObject({
      action: 'auction.publish',
      entityId: 'auction-1',
      after: { status: 'scheduled', auditNote: 'kohapeal kinnitatud' },
    })
  })
})

describe('mechanics lock override', () => {
  const lockedAuction = storedAuction({ status: 'scheduled' })

  it('blocks mechanic changes without the override flag', async () => {
    const repos = makeRepos()
    withAuction(lockedAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(
        form({
          id: 'auction-1',
          title: 'Testioksjon',
          objectType: 'raieoigus',
          type: 'open',
          minBidEur: '3000',
          bidStepEur: '50',
          volumeM3: '980',
          endsAt: hourFromNow(50),
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe('Aktiivse oksjoni mehaanikat muuta ei saa.')
    expect(repos.updates).toEqual([])
  })

  it('blocks the override for specialists even on their own lot', async () => {
    state.session = { userId: 'specialist-1', role: 'specialist' }
    const repos = makeRepos()
    withAuction(lockedAuction, repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(
        form({
          id: 'auction-1',
          title: 'Testioksjon',
          objectType: 'raieoigus',
          type: 'open',
          minBidEur: '3000',
          bidStepEur: '50',
          volumeM3: '980',
          endsAt: hourFromNow(50),
          mechanicsOverride: 'true',
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toBe('Aktiivse oksjoni mehaanikat muuta ei saa.')
    expect(repos.updates).toEqual([])
  })

  it('lets an admin push the end-time change through with an audited override', async () => {
    state.session = { userId: 'admin-1', role: 'admin' }
    const repos = makeRepos()
    withAuction(lockedAuction, repos)
    useRepos(repos)
    const newEndsAt = hourFromNow(50)
    await redirectOf(() =>
      updateAuctionAction(
        form({
          id: 'auction-1',
          title: 'Testioksjon',
          objectType: 'raieoigus',
          type: 'open',
          minBidEur: '3000',
          bidStepEur: '50',
          volumeM3: '980',
          endsAt: newEndsAt,
          mechanicsOverride: 'true',
        }),
      ),
    )
    const data = repos.updates[0]?.data
    expect(data).toMatchObject({ endsAt: newEndsAt })
    expect(data).not.toHaveProperty('status')
    expect(repos.creates[0]?.data).toMatchObject({
      action: 'auction.update',
      entityId: 'auction-1',
      after: { mechanicsOverride: true, mechanicsLocked: true },
    })
  })
})

describe('reserve gating (server-side)', () => {
  it('rejects a reserve on an open ascending lot', async () => {
    const repos = makeRepos()
    withAuction(storedAuction(), repos)
    useRepos(repos)
    const url = await redirectOf(() =>
      updateAuctionAction(
        form({
          id: 'auction-1',
          title: 'Testioksjon',
          objectType: 'raieoigus',
          type: 'open',
          minBidEur: '3000',
          bidStepEur: '50',
          reservePriceEur: '5000',
        }),
      ),
    )
    expect(url.searchParams.get('viga')).toContain(
      'Piirhind on lubatud ainult pimepakkumise ja kiiroksjoni puhul.',
    )
    expect(repos.updates).toEqual([])
  })

  it('accepts a reserve on a sealed lot', async () => {
    const repos = makeRepos()
    withAuction(storedAuction({ type: 'sealed', bidStepCents: null }), repos)
    useRepos(repos)
    await redirectOf(() =>
      updateAuctionAction(
        form({
          id: 'auction-1',
          title: 'Testioksjon',
          objectType: 'raieoigus',
          type: 'sealed',
          minBidEur: '3000',
          volumeM3: '980',
          reservePriceEur: '5000',
        }),
      ),
    )
    expect(repos.updates[0]?.data).toMatchObject({ reservePriceCents: 500000 })
  })
})
