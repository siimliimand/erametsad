import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as registerRoute } from '@/app/api/v1/auth/register/route'
import { hash } from '@/lib/crypto'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'register-route-test-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'
// Checksum-valid: weights 1..9,1 give 75 % 11 = 9, matching the last digit.
const VALID_ISIKUKOOD = '32708100019'
const BAD_CHECKSUM = '32708100011'

let testDb: SqliteTestDb
let repos: CoreRepositories
const isikukoodKeyBackup = process.env.ISIKUKOOD_ENCRYPTION_KEY

beforeEach(() => {
  vi.clearAllMocks()
  process.env.ISIKUKOOD_ENCRYPTION_KEY = isikukoodKeyBackup ?? 'register-route-test-key'
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos))
  setD1ForTests(testDb.d1)
})

afterEach(() => {
  setD1ForTests(null)
  if (isikukoodKeyBackup === undefined) {
    delete process.env.ISIKUKOOD_ENCRYPTION_KEY
  } else {
    process.env.ISIKUKOOD_ENCRYPTION_KEY = isikukoodKeyBackup
  }
  testDb.close()
})

// authRateLimiter buckets by x-forwarded-for (5 requests per minute), so
// every test posts from its own address.
function registerRequest(body: Record<string, unknown>, ip = '10.0.0.1'): NextRequest {
  return new NextRequest(`${BASE}/auth/register`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

function validBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const consentAt = new Date().toISOString()
  return {
    identifier: 'uuskasutaja@example.ee',
    isikukood: VALID_ISIKUKOOD,
    profileType: 'private',
    password: 'ajutine-salasana',
    consents: {
      terms: consentAt,
      privacy: consentAt,
      marketing: '1970-01-01T00:00:00.000Z',
    },
    ...overrides,
  }
}

function userCount(): number {
  return (testDb.raw.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n
}

describe('POST /api/v1/auth/register isikukood handling', () => {
  it('rejects a checksum-invalid isikukood with 400 and stores no user', async () => {
    const response = await registerRoute(
      registerRequest(validBody({ isikukood: BAD_CHECKSUM })),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Vigane isikukood' })
    expect(userCount()).toBe(0)
  })

  it('rejects a non-string isikukood with 400', async () => {
    const response = await registerRoute(registerRequest(validBody({ isikukood: 32708100019 }), '10.0.0.2'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Vigane isikukood' })
  })

  it('stores the isikukood hash so the login lookup finds the account', async () => {
    const response = await registerRoute(
      registerRequest(validBody({ identifier: 'kodu@example.ee' }), '10.0.0.3'),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    const userId = String(body.user?.id)

    // The login route looks up hash(identifier) on isikukood_hash.
    const row = testDb.raw
      .prepare('SELECT id, isikukood_hash, isikukood_encrypted FROM users WHERE isikukood_hash = ?')
      .get(hash(VALID_ISIKUKOOD)) as
      | { id: string; isikukood_hash: string; isikukood_encrypted: string }
      | undefined
    expect(row?.id).toBe(userId)
    expect(row?.isikukood_encrypted).toEqual(expect.any(String))
  })

  it('registers without an isikukood and leaves the hash columns unset', async () => {
    const body = validBody({ identifier: 'ilma@example.ee' })
    delete body.isikukood
    const response = await registerRoute(registerRequest(body, '10.0.0.4'))
    expect(response.status).toBe(200)
    const row = testDb.raw
      .prepare('SELECT isikukood_hash FROM users WHERE email = ?')
      .get('ilma@example.ee') as { isikukood_hash: string | null } | undefined
    expect(row?.isikukood_hash).toBeNull()
  })
})
