import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted((): {
  token: string | undefined
  payload: { userId: string; role: string } | null
  repositories: unknown
} => ({
  token: 'token.admin',
  payload: { userId: 'admin-1', role: 'admin' },
  repositories: null,
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: (): { value: string | undefined } => ({ value: state.token }),
  })),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(() => state.payload),
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(() => state.repositories),
}))

import { GET as bidsExportRoute } from '../route'

import type { CoreRepositories } from '@/lib/data/repositories'

const AUCTION_ID = 'a-11111111-1111-4111-8111-111111111111'

const auction = {
  id: AUCTION_ID,
  title: 'Raieõigus Valgamaal',
  specialistId: 'spec-1',
  sellerId: 'seller-1',
}

function bid(id: string, userId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    auctionId: AUCTION_ID,
    userId,
    amountCents: 12_000_00,
    type: 'open',
    source: 'manual',
    status: 'leading',
    identitySnapshot: null,
    ipHash: `ip-${id}`,
    idempotencyKey: null,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    ...overrides,
  }
}

const BID_DOCS = [
  bid('bid-1', 'user-1'),
  bid('bid-2', 'user-2', {
    status: 'pending_approval',
    amountCents: 8_000_00,
    createdAt: '2026-09-01T11:00:00.000Z',
  }),
]

const USER_DOCS = [
  { id: 'user-1', name: 'Mari Maasikas', email: 'mari@naide.ee' },
  { id: 'user-2', name: null, email: 'kalle@naide.ee' },
]

interface CreateArgs {
  collection: string
  data: Record<string, unknown>
}

function makeRepos() {
  const creates: CreateArgs[] = []
  const repositories = {
    findByID: vi.fn((args: { collection: string }) => {
      if (args.collection === 'auctions') return Promise.resolve(auction)
      return Promise.resolve(null)
    }),
    find: vi.fn((args: { collection: string }) => {
      if (args.collection === 'bids') return Promise.resolve({ docs: BID_DOCS })
      if (args.collection === 'users') return Promise.resolve({ docs: USER_DOCS })
      return Promise.resolve({ docs: [] })
    }),
    create: vi.fn((args: CreateArgs) => {
      creates.push(args)
      return Promise.resolve({ id: 'audit-new', ...args.data })
    }),
  }
  return { repositories: repositories as unknown as CoreRepositories, creates }
}

function useSession(
  payload: { userId: string; role: string } | null,
  token: string | undefined = 'token.x',
) {
  state.payload = payload
  state.token = token
  const exported = makeRepos()
  state.repositories = exported.repositories
  return exported
}

function exportRequest(query: string): Request {
  return new Request(
    query === ''
      ? 'http://localhost:3000/api/v1/admin/bids/export'
      : `http://localhost:3000/api/v1/admin/bids/export?${query}`,
  )
}

beforeEach(() => {
  state.token = 'token.admin'
  state.payload = { userId: 'admin-1', role: 'admin' }
  state.repositories = null
})

describe('GET /api/v1/admin/bids/export', () => {
  it('answers 401 without a session cookie and reads nothing', async () => {
    const exported = useSession(null, undefined)

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(401)
    expect(exported.creates).toEqual([])
  })

  it('answers 401 for an invalid token', async () => {
    useSession(null)

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(401)
  })

  it('answers 403 to a seller (bids:write denied) and reads nothing', async () => {
    const exported = useSession({ userId: 'seller-1', role: 'seller' })

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(403)
    expect(exported.creates).toEqual([])
  })

  it('answers 400 when the auction parameter is missing', async () => {
    const exported = useSession({ userId: 'admin-1', role: 'admin' })

    const response = await bidsExportRoute(exportRequest(''))

    expect(response.status).toBe(400)
    expect(exported.creates).toEqual([])
  })

  it('answers 404 for an unknown auction', async () => {
    const exported = useSession({ userId: 'admin-1', role: 'admin' })
    vi.mocked(exported.repositories.findByID).mockResolvedValue(null as never)

    const response = await bidsExportRoute(exportRequest(`auction=missing`))

    expect(response.status).toBe(404)
    expect(exported.creates).toEqual([])
  })

  it('answers 403 when a specialist requests a lot outside its scope', async () => {
    useSession({ userId: 'spec-other', role: 'specialist' })

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(403)
    expect(await response.text()).toContain('tööulatuses')
  })

  it('serves the CSV with the documented columns and audited filename', async () => {
    useSession({ userId: 'admin-1', role: 'admin' })

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(response.headers.get('content-disposition')).toContain(
      `filename="pakkumised-${AUCTION_ID}-`,
    )
    // response.text() strips the UTF-8 BOM per the fetch spec, so the BOM
    // is asserted on raw bytes.
    const bytes = new Uint8Array(await response.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const text = new TextDecoder().decode(bytes.slice(3))
    const header = text.split('\r\n')[0] ?? ''
    expect(header.split(';')).toEqual([
      'Esitatud',
      'Pakkuja (anonüümne)',
      'Pakkuja ID',
      'Pakkuja nimi',
      'Summa (EUR)',
      'Allikas',
      'Olek',
      'Alapakkumine',
      'IP räsi',
    ])
    expect(text).toContain('Pakkuja #1')
    expect(text).toContain('Mari Maasikas')
    expect(text).toContain('kalle@naide.ee')
    expect(text).toContain('ip-bid-1')
    expect(text).toContain('jah')
  })

  it('blanks the identity columns for a specialist within scope', async () => {
    useSession({ userId: 'spec-1', role: 'specialist' })

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toContain('Pakkuja #1')
    expect(text).not.toContain('user-1')
    expect(text).not.toContain('Mari Maasikas')
  })

  it('writes the export audit entry carrying the row count before responding', async () => {
    const exported = useSession({ userId: 'admin-1', role: 'admin' })

    const response = await bidsExportRoute(exportRequest(`auction=${AUCTION_ID}`))

    expect(response.status).toBe(200)
    expect(exported.creates).toHaveLength(1)
    expect(exported.creates[0]?.collection).toBe('audit-entry')
    expect(exported.creates[0]?.data).toMatchObject({
      actorId: 'admin-1',
      action: 'bid.export',
      entityType: 'bid',
      entityId: AUCTION_ID,
      after: { auctionId: AUCTION_ID, rowCount: 2, includeIdentity: true },
    })
  })
})
