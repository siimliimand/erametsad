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

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'contract-prepare-route-test-secret'

const BASE = 'http://localhost:3000/api/v1/bids/contract/prepare'
const CALLER_ID = 'winner-1'
const AUCTION_ID = 'auction-1'

const wonBid = { id: 'bid-1', auction: AUCTION_ID, user: CALLER_ID, status: 'won' }

const activeTemplate = {
  id: 'template-1',
  name: 'Metsa ostu-müügleping',
  type: 'auction',
  version: '1.0.0',
  placeholders: [],
  active: true,
  htmlContent: '<p>{{auctionTitle}}</p>',
}

const auction = { id: AUCTION_ID, title: 'Testioksjon' }

const createdContractRow = {
  id: 'contract-1',
  templateId: 'template-1',
  lotId: AUCTION_ID,
  status: 'prepared',
  signedAt: null,
  signedBy: CALLER_ID,
  contentHash: null,
  renderedHtml: '<p>Testioksjon</p>',
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

// Mock order mirrors the route and service reads: winner gate (bids), then
// template and auction lookups inside prepareContract.
function mockHappyPathRepos(): void {
  mockRepos.find.mockImplementation(async (args: { collection: string }) => {
    if (args.collection === 'bids') return { docs: [wonBid] }
    if (args.collection === 'contract-templates') return { docs: [activeTemplate] }
    if (args.collection === 'auctions') return { docs: [auction] }
    return { docs: [] }
  })
  mockRepos.create.mockResolvedValueOnce(createdContractRow)
}

describe('POST /api/v1/bids/contract/prepare', () => {
  it('answers 401 without an access token cookie', async () => {
    const response = await prepareRoute(prepareRequest({ auctionId: AUCTION_ID }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Not authenticated' })
    expect(verifyAccessToken).not.toHaveBeenCalled()
    expect(mockRepos.find).not.toHaveBeenCalled()
  })

  it('answers 401 for an invalid token', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(null)

    const response = await prepareRoute(
      prepareRequest({ auctionId: AUCTION_ID }, 'access_token=bogus.token.value'),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid or expired token' })
    expect(mockRepos.find).not.toHaveBeenCalled()
  })

  it('answers 403 when the caller holds no won bid on the auction', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: CALLER_ID, role: 'private' })
    mockRepos.find.mockResolvedValueOnce({ docs: [] })

    const response = await prepareRoute(prepareRequest({ auctionId: AUCTION_ID }, `access_token=t.${CALLER_ID}.x`))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'Lepingu koostamise õigus on ainult oksjoni võitjal.',
    })
    expect(mockRepos.create).not.toHaveBeenCalled()
  })

  it('checks the winner gate with the caller id, auction id and won status', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: CALLER_ID, role: 'private' })
    mockHappyPathRepos()

    await prepareRoute(prepareRequest({ auctionId: AUCTION_ID }, `access_token=t.${CALLER_ID}.x`))

    expect(mockRepos.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'bids',
        where: {
          and: [
            { auction: { equals: AUCTION_ID } },
            { user: { equals: CALLER_ID } },
            { status: { equals: 'won' } },
          ],
        },
      }),
    )
  })

  it('answers 201 with the prepared contract bound to the winner', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: CALLER_ID, role: 'private' })
    mockHappyPathRepos()

    const response = await prepareRoute(
      prepareRequest({ auctionId: AUCTION_ID }, `access_token=t.${CALLER_ID}.x`),
    )

    expect(response.status).toBe(201)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.lot).toBe(AUCTION_ID)
    expect(body.signedBy).toBe(CALLER_ID)
    expect(mockRepos.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'contracts',
        data: expect.objectContaining({ signedBy: CALLER_ID, status: 'prepared' }),
      }),
    )
  })
})
