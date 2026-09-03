import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}))

import { POST as prepareRoute } from '../route'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { getRepositories } from '@/lib/data/runtime'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'framework-prepare-route-test-secret'

const BASE = 'http://localhost:3000/api/v1/bids/framework-contract/prepare'
const CALLER_ID = 'kasutaja-1'
const AUCTION_ID = 'auction-1'

const activeTemplate = {
  id: 'template-framework-1',
  name: 'Raamleping',
  type: 'framework',
  version: '1.0.0',
  placeholders: [],
  active: true,
  htmlContent: '<p>{{auctionTitle}}</p>',
}

const auction = { id: AUCTION_ID, title: 'Testioksjon' }

function createdContractRow(signedBy: string) {
  return {
    id: 'contract-1',
    templateId: 'template-framework-1',
    lotId: AUCTION_ID,
    status: 'prepared',
    signedAt: null,
    signedBy,
    contentHash: null,
    renderedHtml: '<p>Testioksjon</p>',
  }
}

let mockRepos: {
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}

beforeEach(() => {
  vi.clearAllMocks()
  mockRepos = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  vi.mocked(getRepositories).mockImplementation(() => mockRepos as never)
})

function prepareRequest(body: Record<string, unknown>, cookie?: string): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie !== undefined ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

// Mock order mirrors prepareContract reads: template lookup, then auction.
function mockPrepareRepos(signedBy: string): void {
  mockRepos.find.mockImplementation((args: { collection: string }) => {
    if (args.collection === 'contract-templates') {
      return Promise.resolve({ docs: [activeTemplate] })
    }
    if (args.collection === 'auctions') return Promise.resolve({ docs: [auction] })
    return Promise.resolve({ docs: [] })
  })
  mockRepos.create.mockResolvedValueOnce(createdContractRow(signedBy))
}

describe('POST /api/v1/bids/framework-contract/prepare', () => {
  it('answers 401 without an access token cookie', async () => {
    const response = await prepareRoute(prepareRequest({ auctionId: AUCTION_ID }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Not authenticated' })
    expect(verifyAccessToken).not.toHaveBeenCalled()
    expect(mockRepos.create).not.toHaveBeenCalled()
  })

  it('answers 401 for an invalid token', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(null)

    const response = await prepareRoute(
      prepareRequest({ auctionId: AUCTION_ID }, 'access_token=bogus.token.value'),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid or expired token' })
  })

  it('answers 201 for any authenticated user, no won-bid gate', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: CALLER_ID, role: 'private' })
    mockPrepareRepos(CALLER_ID)

    const response = await prepareRoute(
      prepareRequest({ auctionId: AUCTION_ID }, `access_token=t.${CALLER_ID}.x`),
    )

    expect(response.status).toBe(201)
    // The route reads only the bids collection through the service path;
    // no winner-gate lookup happens for the framework contract.
    expect(mockRepos.find).not.toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'bids' }),
    )
  })

  it('binds the created contract row to the calling user', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: CALLER_ID, role: 'private' })
    mockPrepareRepos(CALLER_ID)

    const response = await prepareRoute(
      prepareRequest({ auctionId: AUCTION_ID }, `access_token=t.${CALLER_ID}.x`),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.signedBy).toBe(CALLER_ID)
    expect(mockRepos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contracts',
        data: expect.objectContaining({
          status: 'prepared',
          lot: AUCTION_ID,
          signedBy: CALLER_ID,
        }) as unknown,
      }),
    )
  })

  it('renders from the active framework template', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: CALLER_ID, role: 'private' })
    mockPrepareRepos(CALLER_ID)

    await prepareRoute(prepareRequest({ auctionId: AUCTION_ID }, `access_token=t.${CALLER_ID}.x`))

    expect(mockRepos.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contract-templates',
        where: {
          and: [{ type: { equals: 'framework' } }, { active: { equals: true } }],
        },
      }),
    )
  })
})
