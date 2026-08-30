import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

import { encryptSealedData } from '../../encryption'
import type { BidResult, BidError } from '../place-bid'
import { submitSealedBid, decryptSealedBids } from '../sealed-bid'

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

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { getRepositories } from '@/lib/data/runtime'

let mockRepos: { find: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
  mockRepos = { find: vi.fn(), create: vi.fn(), update: vi.fn() }
  vi.mocked(getRepositories).mockResolvedValue(mockRepos as never)
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
    mockRepos.find.mockResolvedValueOnce({ docs: user ? [user] : [] })
  }

  function mockAuction(auction?: Record<string, unknown>) {
    mockRepos.find.mockResolvedValueOnce({ docs: auction ? [auction] : [] })
  }

  function mockRights(hasRights: boolean) {
    mockRepos.find.mockResolvedValueOnce({ docs: hasRights ? [{ id: 'right-1' }] : [] })
  }

  function mockExistingBids(docs: Record<string, unknown>[]) {
    mockRepos.find.mockResolvedValueOnce({ docs })
  }

  function mockSettings(revisionCap: number) {
    mockRepos.find.mockResolvedValueOnce({ docs: [{ sealedRevisionCap: revisionCap }] })
  }

  function mockIdempotencyCheck(found = false) {
    mockRepos.find.mockResolvedValueOnce({ docs: found ? [{ id: 'dup' }] : [] })
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

  it('returns 403 when the user lacks the auction objectType right', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBidCents: 10000, endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' })
    mockRights(false)

    const result = await submitSealedBid(baseParams)
    assertBidError(result)
    expect(result.error).toBe('No bidding right for this object type')
    expect(result.status).toBe(403)
  })

  it('returns error when amount is below minBid', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBidCents: 10000000, endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' })
    mockRights(true)

    const result = await submitSealedBid({ ...baseParams, amount: 50000 })
    assertBidError(result)
    expect(result.status).toBe(400)
  })

  it('enforces the revision cap with the Estonian limit message', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBidCents: 10000, endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' })
    mockRights(true)
    mockExistingBids(Array.from({ length: 4 }, (_, i) => ({ id: `bid-${String(i)}`, status: 'leading' })))
    mockSettings(3)

    const result = await submitSealedBid(baseParams)
    assertBidError(result)
    expect(result.error).toBe(
      'Lukspakkumuste limiit on ületatud: lubatud on üks esialgne pakkumine ja kuni 3 täienduspakkumist',
    )
    expect(result.status).toBe(400)
  })

  it('accepts up to one original bid plus N revisions when under the cap', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBidCents: 10000, endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' })
    mockRights(true)
    mockExistingBids(Array.from({ length: 3 }, (_, i) => ({ id: `bid-${String(i)}`, status: 'leading' })))
    mockSettings(3)
    mockIdempotencyCheck(false)
    mockRepos.create.mockResolvedValueOnce({ id: 'sealed-bid-4' })

    const result = await submitSealedBid(baseParams)
    expect(result.success).toBe(true)
  })

  it('accepts bid when under revision cap', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBidCents: 10000, endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' })
    mockRights(true)
    mockExistingBids([])
    mockSettings(3)
    mockIdempotencyCheck(false)
    mockRepos.create.mockResolvedValueOnce({ id: 'sealed-bid-1' })

    const result = await submitSealedBid(baseParams)
    expect(result.success).toBe(true)
    expect(mockRepos.create).toHaveBeenCalled()
    const createCall = mockRepos.create.mock.calls[0] as unknown[]
    const createData = (createCall[0] as { data: Record<string, unknown> }).data
    expect(createData.type).toBe('sealed')
    expect(createData.amountCents).toBe(0)
    expect(createData.identitySnapshot).toBeTruthy()
  })

  it('prevents duplicate with idempotency key', async () => {
    mockUser({ id: 'user-1' })
    mockAuction({ status: 'active', minBidCents: 10000, endsAt: '2099-01-01T00:00:00Z', objectType: 'forest' })
    mockRights(true)
    mockExistingBids([])
    mockSettings(3)
    mockIdempotencyCheck(true)

    const result = await submitSealedBid({ ...baseParams, idempotencyKey: 'dup-key' })
    assertBidError(result)
    expect(result.status).toBe(409)
  })
})

describe('decryptSealedBids', () => {
  function sealedRow(overrides: Record<string, unknown> = {}) {
    const encrypted = encryptSealedData('50000')
    return {
      id: 'bid-1',
      auction: 'auction-1',
      user: 'user-1',
      amount: 0,
      type: 'sealed',
      status: 'leading',
      createdAt: '2026-02-01T10:00:00Z',
      identitySnapshot: JSON.stringify(encrypted),
      ...overrides,
    }
  }

  it('decrypts a valid sealed bid to its original amount', () => {
    const result = decryptSealedBids([sealedRow()])

    expect(result).toHaveLength(1)
    expect(result[0]?.amount).toBe(50000)
    expect(result[0]?.valid).toBe(true)
  })

  it('marks a tampered bid invalid and logs instead of reporting a valid 0', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const snapshot = encryptSealedData('50000')
    const tampered = snapshot.encrypted.endsWith('00')
      ? `${snapshot.encrypted.slice(0, -2)}11`
      : `${snapshot.encrypted.slice(0, -2)}00`
    const row = sealedRow({
      identitySnapshot: JSON.stringify({ ...snapshot, encrypted: tampered }),
    })

    const result = decryptSealedBids([row])

    expect(result[0]?.amount).toBe(0)
    expect(result[0]?.valid).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('bid-1 marked invalid'))
    errorSpy.mockRestore()
  })

  it('marks a bid without an encrypted payload invalid', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const result = decryptSealedBids([sealedRow({ identitySnapshot: undefined })])

    expect(result[0]?.valid).toBe(false)
    expect(result[0]?.amount).toBe(0)
    errorSpy.mockRestore()
  })

  it('unwraps populated user relations to the plain user id', () => {
    const result = decryptSealedBids([sealedRow({ user: { id: 'user-9' }, auction: { id: 'auction-9' } })])

    expect(result[0]?.user).toBe('user-9')
    expect(result[0]?.auction).toBe('auction-9')
  })
})