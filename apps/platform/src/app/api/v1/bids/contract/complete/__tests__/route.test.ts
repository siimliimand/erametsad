import crypto from 'node:crypto'

import { NextRequest } from 'next/server'

import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(),
}))

import { POST as completeRoute } from '../route'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { getRepositories } from '@/lib/data/runtime'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'contract-complete-route-test-secret'

const BASE = 'http://localhost:3000/api/v1/bids/contract/complete'
const OWNER_ID = 'owner-1'
const ATTACKER_ID = 'attacker-1'
const CONTRACT_ID = 'contract-1'
const RENDERED_HTML = '<p>Metsa ostu-müügleping</p>'

function preparedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONTRACT_ID,
    templateId: 'template-1',
    lotId: 'auction-1',
    status: 'prepared',
    signedAt: null,
    signedBy: OWNER_ID,
    contentHash: null,
    renderedHtml: RENDERED_HTML,
    createdAt: new Date().toISOString(),
    ...overrides,
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

function completeRequest(body: Record<string, unknown>, cookie?: string): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie !== undefined ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

function mockFindContract(row: Record<string, unknown>): void {
  mockRepos.find.mockImplementation(async (args: { collection: string }) => {
    if (args.collection === 'contracts') return { docs: [row] }
    return { docs: [] }
  })
}

describe('POST /api/v1/bids/contract/complete', () => {
  it('answers 401 without an access token cookie', async () => {
    const response = await completeRoute(completeRequest({ contractId: CONTRACT_ID }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Not authenticated' })
    expect(verifyAccessToken).not.toHaveBeenCalled()
    expect(mockRepos.find).not.toHaveBeenCalled()
  })

  it('answers 401 for an invalid token', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce(null)

    const response = await completeRoute(
      completeRequest({ contractId: CONTRACT_ID }, 'access_token=bogus.token.value'),
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Invalid or expired token' })
  })

  it('lets the contract owner sign and returns the signed contract', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: OWNER_ID, role: 'private' })
    const row = preparedRow()
    mockFindContract(row)
    mockRepos.update.mockImplementation(async (args: { data: Record<string, unknown> }) => ({
      ...row,
      ...args.data,
    }))

    const response = await completeRoute(
      completeRequest({ contractId: CONTRACT_ID }, `access_token=t.${OWNER_ID}.x`),
    )

    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.status).toBe('signed')
    expect(body.signedBy).toBe(OWNER_ID)
    const expectedHash = crypto.createHash('sha256').update(RENDERED_HTML).digest('hex')
    expect(body.contentHash).toBe(expectedHash)
  })

  it('answers 400 for a cross-user sign and stamps no signature', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: ATTACKER_ID, role: 'private' })
    mockFindContract(preparedRow())

    const response = await completeRoute(
      completeRequest({ contractId: CONTRACT_ID }, `access_token=t.${ATTACKER_ID}.x`),
    )

    expect(response.status).toBe(400)
    expect(response.status).not.toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.error).toBe('Contract belongs to another user')
    expect(body.status).toBeUndefined()
    expect(mockRepos.update).not.toHaveBeenCalled()
  })

  it('answers 410 when the signing session expired', async () => {
    vi.mocked(verifyAccessToken).mockReturnValueOnce({ userId: OWNER_ID, role: 'private' })
    const stale = preparedRow({
      createdAt: new Date(Date.now() - 16 * 60 * 1000).toISOString(),
    })
    mockFindContract(stale)
    mockRepos.update.mockResolvedValueOnce({ ...stale, status: 'voided' })

    const response = await completeRoute(
      completeRequest({ contractId: CONTRACT_ID }, `access_token=t.${OWNER_ID}.x`),
    )

    expect(response.status).toBe(410)
    expect(mockRepos.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'voided' } }),
    )
  })
})
