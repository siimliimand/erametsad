import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

import { encryptSealedData } from '../../encryption'
import type { BidResult, BidError } from '../place-bid'
import { submitSealedBid } from '../sealed-bid'

function assertBidError(result: BidResult): asserts result is BidError {
  expect(result.success).toBe(false)
}

const TEST_KEY = 'test-encryption-key-32chars!!'
const OLD_KEY = process.env.SEALED_BID_ENCRYPTION_KEY

beforeAll(() => {
  process.env.SEALED_BID_ENCRYPTION_KEY = TEST_KEY
})

afterAll(() => {
  if (OLD_KEY) {
    process.env.SEALED_BID_ENCRYPTION_KEY = OLD_KEY
  } else {
    delete process.env.SEALED_BID_ENCRYPTION_KEY
  }
})

vi.mock('@/payload/payloadClient', () => ({
  getPayloadClient: vi.fn(),
}))

import { getPayloadClient } from '@/payload/payloadClient'

let mockPayload: { find: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockPayload = { find: vi.fn(), create: vi.fn(), update: vi.fn() }
  vi.mocked(getPayloadClient).mockResolvedValue(mockPayload as never)
})

describe('encryption / decryption', () => {
  it('encrypts data with aes-256-gcm and returns hex strings', () => {
    const original = '15000'
    const encrypted = encryptSealedData(original)
    expect(typeof encrypted.encrypted).toBe('string')
    expect(typeof encrypted.iv).toBe('string')
    expect(encrypted.encrypted).not.toBe(original)
    expect(encrypted.encrypted.length).toBeGreaterThan(0)
    expect(encrypted.iv.length).toBeGreaterThan(0)
  })

  it('produces different ciphertexts for the same input (different IV)', () => {
    const data = '10000'
    const result1 = encryptSealedData(data)
    const result2 = encryptSealedData(data)
    expect(result1.encrypted).not.toBe(result2.encrypted)
  })
})

describe('submitSealedBid', () => {
  const baseParams = {
    userId: 'user-1',
    auctionId: 'auction-1',
    amount: 50000,
  }

  function mockUser(user?: Record<string, unknown>) {
    mockPayload.find.mockResolvedValueOnce({ docs: user ? [user] : [] })
  }

  function mockAuction(auction?: Record<string, unknown>) {
    mockPayload.find.mockResolvedValueOnce({ docs: auction ? [auction] : [] })
  }

  function mockExistingBids(docs: Record<string, unknown>[]) {
    mockPayload.find.mockResolvedValueOnce({ docs })
  }

  function mockSettings(revisionCap: number) {
    mockPayload.find.mockResolvedValueOnce({ docs: [{ sealedRevisionCap: revisionCap }] })
  }

  function mockIdempotencyCheck(found = false) {
    mockPayload.find.mockResolvedValueOnce({ docs: found ? [{ id: 'dup' }] : [] })
  }

  it('returns error when user is not found', async () => {
    mockUser(undefined)

    const result = await submitSealedBid(baseParams)
    assertBidError(result)
    expect(result.status).toBe(401)
  })

  it('returns error when user is suspended', async () => {
    mockUser({ id: 'user-1', status: 'suspended' })

    const result = await submitSealedBid(baseParams)
    assertBidError(result)
    expect(result.status).toBe(403)
  })

  it('returns error when auction is not active', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'ended', minBid: 100, endsAt: '2099-01-01T00:00:00Z' })

    const result = await submitSealedBid(baseParams)
    assertBidError(result)
    expect(result.status).toBe(400)
  })

  it('returns error when amount is below minBid', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBid: 100000, endsAt: '2099-01-01T00:00:00Z' })

    const result = await submitSealedBid({ ...baseParams, amount: 50000 })
    assertBidError(result)
    expect(result.status).toBe(400)
  })

  it('enforces revision cap', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBid: 100, endsAt: '2099-01-01T00:00:00Z' })
    mockExistingBids(Array.from({ length: 4 }, (_, i) => ({ id: `bid-${String(i)}`, status: 'leading' })))
    mockSettings(3)

    const result = await submitSealedBid(baseParams)
    assertBidError(result)
    expect(result.error).toContain('Revision limit')
    expect(result.status).toBe(400)
  })

  it('accepts bid when under revision cap', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBid: 100, endsAt: '2099-01-01T00:00:00Z' })
    mockExistingBids([])
    mockSettings(3)
    mockIdempotencyCheck(false)
    mockPayload.create.mockResolvedValueOnce({ id: 'sealed-bid-1' })

    const result = await submitSealedBid(baseParams)
    expect(result.success).toBe(true)
    expect(mockPayload.create).toHaveBeenCalled()
    const createCall = mockPayload.create.mock.calls[0]
    const createData = createCall && (createCall[0] as Record<string, unknown>).data as Record<string, unknown>
    expect(createData.type).toBe('sealed')
    expect(createData.amount).toBe(0)
    expect(createData.identitySnapshot).toBeTruthy()
  })

  it('prevents duplicate with idempotency key', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBid: 100, endsAt: '2099-01-01T00:00:00Z' })
    mockExistingBids([])
    mockSettings(3)
    mockIdempotencyCheck(true)

    const result = await submitSealedBid({ ...baseParams, idempotencyKey: 'dup-key' })
    assertBidError(result)
    expect(result.status).toBe(409)
  })
})