import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

interface AuthPayload {
  userId: string
  role: string
  sessionId?: string
}

interface RouteTestState {
  payload: AuthPayload | null
  sessionState: 'live' | 'revoked'
  ingest: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<unknown>>>
}

const state = vi.hoisted<RouteTestState>(() => ({
  payload: { userId: 'seller-1', role: 'private', sessionId: 'sess-1' },
  sessionState: 'live',
  ingest: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
}))

vi.mock('@/lib/auth/jwt', () => ({
  verifyAccessToken: vi.fn(() => state.payload),
}))

vi.mock('@/lib/auth/session', () => ({
  resolveAccessTokenSession: vi.fn(() =>
    Promise.resolve(
      state.sessionState === 'revoked' ? { state: 'revoked' } : { state: 'live' },
    ),
  ),
}))

vi.mock('@/lib/object-submission/sale-branch', () => ({
  ingestSaleSubmission: (...args: unknown[]) => state.ingest(...args),
}))

import { POST } from '../route'

const BASE = 'http://localhost:3000/api/v1/object-submissions'

function postRequest(body: string, accessToken?: string): NextRequest {
  return new NextRequest(BASE, {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { cookie: `access_token=${accessToken}` } : {}),
    },
  })
}

const validBody = {
  branch: 'sale',
  objectType: 'raieoigus',
  cadastres: ['78402:003:0210'],
  areaHa: 12.4,
  species: ['MA', 'KU'],
  loggingTypes: ['HL'],
  description: 'Müüa raieõigus Harjumaal.',
  contact: { name: 'Mati Mets', phone: '+37251234567', email: 'mati@mets.ee' },
}

const ingestResult = {
  auction: {
    id: 'a-1',
    slug: 'raieoiguse-muuk-78402-003-0210',
    status: 'draft',
    objectType: 'raieoigus',
    type: 'open',
  },
  lead: { id: 'l-1' },
  assignedSpecialistId: 'sp-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  state.payload = { userId: 'seller-1', role: 'private', sessionId: 'sess-1' }
  state.sessionState = 'live'
  state.ingest.mockResolvedValue(ingestResult)
})

describe('POST /api/v1/object-submissions auth gate', () => {
  it('answers 401 to an anonymous caller', async () => {
    const response = await POST(postRequest(JSON.stringify(validBody)))

    expect(response.status).toBe(401)
    expect(state.ingest).not.toHaveBeenCalled()
  })

  it('answers 401 when the token cannot be verified', async () => {
    state.payload = null

    const response = await POST(postRequest(JSON.stringify(validBody), 'broken.token'))

    expect(response.status).toBe(401)
    expect(state.ingest).not.toHaveBeenCalled()
  })

  it('answers 401 when the session is revoked', async () => {
    state.sessionState = 'revoked'

    const response = await POST(postRequest(JSON.stringify(validBody), 'token'))

    expect(response.status).toBe(401)
    expect(state.ingest).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/object-submissions validation', () => {
  it('answers 400 for malformed JSON', async () => {
    const response = await POST(postRequest('{not json', 'token'))

    expect(response.status).toBe(400)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Vigane JSON')
  })

  it('answers 422 with per-field errors for an invalid payload', async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...validBody, contact: { ...validBody.contact, phone: '123' } }), 'token'),
    )

    expect(response.status).toBe(422)
    const json = (await response.json()) as { errors: Record<string, string> }
    expect(json.errors['contact.phone']).toBeTruthy()
    expect(state.ingest).not.toHaveBeenCalled()
  })

  it('rejects admin-only fields the schema does not accept', async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...validBody, minBidEur: 5000, specialistId: 'sp-1' }), 'token'),
    )

    expect(response.status).toBe(422)
    expect(state.ingest).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/object-submissions happy path', () => {
  it('creates the owned draft from the session user, never from the body', async () => {
    const response = await POST(
      postRequest(JSON.stringify({ ...validBody, files: ['object-submissions/u1/a.pdf'] }), 'token'),
    )

    expect(response.status).toBe(201)
    expect(state.ingest).toHaveBeenCalledTimes(1)
    const [input, sellerId] = state.ingest.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ]
    expect(sellerId).toBe('seller-1')
    expect(input).toMatchObject({
      branch: 'sale',
      objectType: 'raieoigus',
      cadastres: ['78402:003:0210'],
      files: ['object-submissions/u1/a.pdf'],
    })

    const json = (await response.json()) as {
      status: string
      auction: { id: string; slug: string; status: string }
      lead: { id: string }
      assignedSpecialistId: string | null
    }
    expect(json).toMatchObject({
      status: 'ok',
      auction: { id: 'a-1', slug: 'raieoiguse-muuk-78402-003-0210', status: 'draft' },
      lead: { id: 'l-1' },
      assignedSpecialistId: 'sp-1',
    })
  })

  it('answers 500 with an Estonian message when ingestion fails', async () => {
    state.ingest.mockRejectedValue(new Error('D1 puudub'))

    const response = await POST(postRequest(JSON.stringify(validBody), 'token'))

    expect(response.status).toBe(500)
    const json = (await response.json()) as { error: string }
    expect(json.error).toBe('Sisemine viga')
  })
})
