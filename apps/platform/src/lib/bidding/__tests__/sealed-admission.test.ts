import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'

import {
  buildSealedIdentitySnapshot,
  resolveSealedRevisionCap,
  sealedStorageAmountCents,
} from '../sealed-admission'
import { decryptSealedBids } from '../sealed-bid'
import { placeBid } from '../place-bid'
import { fakeD1, type FakeD1, type RecordedStatement } from './fake-d1'
import { setD1ForTests } from '../../db'

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

let mockRepos: {
  find: ReturnType<typeof vi.fn>
  create: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
}
let statements: RecordedStatement[]
let d1: FakeD1

beforeEach(() => {
  vi.clearAllMocks()
  statements = []
  d1 = fakeD1(statements)
  setD1ForTests(d1)
  mockRepos = {
    find: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  }
  vi.mocked(getRepositories).mockImplementation(() => mockRepos as never)
})

const gateOffSettings = { featureFlags: { requireFrameworkContract: false } }
const activeAuction = {
  minBidCents: 5000,
  bidStepCents: 1000,
  status: 'active',
  endsAt: '2099-01-01T00:00:00Z',
  objectType: 'forest',
  title: 'Test auction',
}

// Queue order mirrors placeBid: user, auction, rights, settings, leading
// bid (normal path), then the sealed count read.
function setupSealedMocks(opts: {
  sealedDocs: Record<string, unknown>[]
  revisionCap?: number
}) {
  mockRepos.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
  mockRepos.find.mockResolvedValueOnce({ docs: [activeAuction] })
  mockRepos.find.mockResolvedValueOnce({ docs: [{ id: 'right-1' }] })
  mockRepos.find.mockResolvedValueOnce({
    docs: [{ ...gateOffSettings, sealedRevisionCap: opts.revisionCap ?? 3 }],
  })
  mockRepos.find.mockResolvedValueOnce({ docs: [] })
  mockRepos.find.mockResolvedValueOnce({ docs: opts.sealedDocs })
}

const submittedSnapshot = JSON.stringify({
  name: 'Mari Maasikas',
  aadress: 'Metsa tee 1, Tartu',
  email: 'mari@example.com',
  telefon: '+372 500 100',
  isikukood: '30000000003',
})

function insertFor(): RecordedStatement {
  const insert = statements.find((statement) =>
    statement.sql.includes('insert into bids'),
  )
  expect(insert).toBeDefined()
  return insert as RecordedStatement
}

describe('sealed admission helpers', () => {
  it('stores sealed amounts as 0 and open amounts unchanged', () => {
    expect(sealedStorageAmountCents('sealed', 15000)).toBe(0)
    expect(sealedStorageAmountCents('open', 15000)).toBe(15000)
  })

  it('resolves the revision cap from settings with the default fallback', () => {
    expect(resolveSealedRevisionCap({ sealedRevisionCap: 5 })).toBe(5)
    expect(resolveSealedRevisionCap({ sealedRevisionCap: 2.9 })).toBe(2)
    expect(resolveSealedRevisionCap({ sealedRevisionCap: -1 })).toBe(3)
    expect(resolveSealedRevisionCap({})).toBe(3)
    expect(resolveSealedRevisionCap(null)).toBe(3)
  })

  it('builds an envelope the ceremony decrypt path can open (roundtrip)', async () => {
    const snapshot = await buildSealedIdentitySnapshot(500, submittedSnapshot)

    const row = {
      id: 'bid-1',
      auction: 'auction-1',
      user: 'user-1',
      status: 'leading',
      createdAt: '2026-02-01T10:00:00Z',
      identitySnapshot: snapshot,
    }
    const decrypted = decryptSealedBids([row])

    expect(decrypted[0]?.valid).toBe(true)
    expect(decrypted[0]?.amount).toBe(500)
    expect(decrypted[0]?.identitySnapshot).toBe(submittedSnapshot)
  })

  it('omits identity envelope fields when no snapshot was submitted', async () => {
    const snapshot = await buildSealedIdentitySnapshot(500)
    const payload = JSON.parse(snapshot) as Record<string, string>

    expect(payload.encrypted).toBeTruthy()
    expect(payload.identityEncrypted).toBeUndefined()
    const decrypted = decryptSealedBids([
      {
        id: 'bid-1',
        auction: 'auction-1',
        user: 'user-1',
        status: 'leading',
        createdAt: '2026-02-01T10:00:00Z',
        identitySnapshot: snapshot,
      },
    ])
    expect(decrypted[0]?.valid).toBe(true)
    expect(decrypted[0]?.identitySnapshot).toBeUndefined()
  })
})

describe('placeBid sealed ciphertext at rest', () => {
  it('stores amount_cents 0 and an unreadable identity_snapshot envelope', async () => {
    setupSealedMocks({ sealedDocs: [] })

    const result = await placeBid({
      userId: 'user-1',
      auctionId: 'auction-1',
      amount: 500,
      type: 'sealed',
      source: 'manual',
      identitySnapshot: submittedSnapshot,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // The stored row reads back as amount 0, never the submitted amount.
      expect(result.bid.amount).toBe(0)
    }

    const insert = insertFor()
    expect(insert.params[3]).toBe(0)
    const storedSnapshot = String(insert.params[7])
    expect(storedSnapshot).not.toContain('500')
    expect(storedSnapshot).not.toContain('Mari Maasikas')
    expect(storedSnapshot).not.toContain('30000000003')
    expect(storedSnapshot).not.toContain('mari@example.com')
    const payload = JSON.parse(storedSnapshot) as Record<string, string>
    expect(payload.encrypted).toBeTruthy()
    expect(payload.iv).toBeTruthy()
    expect(payload.authTag).toBeTruthy()
    expect(payload.identityEncrypted).toBeTruthy()
  })

  it('rejects a sealed bid past 1 + sealedRevisionCap with the coded limit error', async () => {
    setupSealedMocks({
      sealedDocs: Array.from({ length: 4 }, (_, i) => ({
        id: `bid-${String(i)}`,
        status: 'leading',
      })),
      revisionCap: 3,
    })

    const result = await placeBid({
      userId: 'user-1',
      auctionId: 'auction-1',
      amount: 500,
      type: 'sealed',
      source: 'manual',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.code).toBe('revision_cap_exceeded')
      expect(result.status).toBe(400)
      expect(result.error).toBe(
        'Lukspakkumuste limiit on ületatud: lubatud on üks esialgne pakkumine ja kuni 3 täienduspakkumist',
      )
    }
    expect(statements.find((s) => s.sql.includes('insert into bids'))).toBeUndefined()
  })

  it('decrypts the stored envelope back into the submitted snapshot (ceremony roundtrip)', async () => {
    setupSealedMocks({ sealedDocs: [] })

    const result = await placeBid({
      userId: 'user-1',
      auctionId: 'auction-1',
      amount: 500,
      type: 'sealed',
      source: 'manual',
      identitySnapshot: submittedSnapshot,
    })
    expect(result.success).toBe(true)

    const insert = insertFor()
    const decrypted = decryptSealedBids([
      {
        id: String(insert.params[0]),
        auction: 'auction-1',
        user: 'user-1',
        status: 'leading',
        createdAt: '2026-02-01T10:00:00Z',
        identitySnapshot: String(insert.params[7]),
      },
    ])

    expect(decrypted[0]?.valid).toBe(true)
    expect(decrypted[0]?.amount).toBe(500)
    expect(decrypted[0]?.identitySnapshot).toBe(submittedSnapshot)
    const parsed = JSON.parse(decrypted[0]?.identitySnapshot ?? '') as Record<
      string,
      string
    >
    expect(parsed.name).toBe('Mari Maasikas')
    expect(parsed.aadress).toBe('Metsa tee 1, Tartu')
    expect(parsed.email).toBe('mari@example.com')
    expect(parsed.telefon).toBe('+372 500 100')
    expect(parsed.isikukood).toBe('30000000003')
  })
})

describe('open bids without identitySnapshot behave as before', () => {
  it('stores the real amount and no identity_snapshot write', async () => {
    mockRepos.find.mockResolvedValueOnce({ docs: [{ id: 'user-1' }] })
    mockRepos.find.mockResolvedValueOnce({ docs: [activeAuction] })
    mockRepos.find.mockResolvedValueOnce({ docs: [{ id: 'right-1' }] })
    mockRepos.find.mockResolvedValueOnce({ docs: [gateOffSettings] })
    mockRepos.find.mockResolvedValueOnce({ docs: [] })

    const result = await placeBid({
      userId: 'user-1',
      auctionId: 'auction-1',
      amount: 110,
      type: 'open',
      source: 'manual',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.bid.amount).toBe(110)
    }
    const insert = insertFor()
    expect(insert.params[3]).toBe(11000)
    expect(insert.params[7]).toBeNull()
  })
})
