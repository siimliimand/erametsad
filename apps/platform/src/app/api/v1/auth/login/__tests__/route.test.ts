import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as loginRoute } from '@/app/api/v1/auth/login/route'
import { hashCredentialPassword } from '@/lib/auth/password'
import { hash } from '@/lib/crypto'
import {
  createSqliteTestDb,
  sqliteBatchRunner,
  type SqliteTestDb,
} from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'login-route-test-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'
// Checksum-valid: weights 1..9,1 give 75 % 11 = 9, matching the last digit.
const VALID_ISIKUKOOD = '32708100019'
const PASSWORD = 'Salasona1!'
const NEUTRAL_ERROR = 'Vale kasutajanimi või parool'

let testDb: SqliteTestDb
let repos: CoreRepositories
let nextIp = 0

beforeEach(() => {
  vi.clearAllMocks()
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
  testDb.close()
})

// authRateLimiter buckets by x-forwarded-for (5 requests per minute), so
// every test posts from its own address.
function loginRequest(body: Record<string, unknown>): NextRequest {
  nextIp += 1
  return new NextRequest(`${BASE}/auth/login`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.4.0.${String(nextIp)}`,
    },
  })
}

function seedUser(
  overrides: {
    email?: string
    isikukoodHash?: string
    role?: string
  } = {},
): string {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  testDb.raw
    .prepare(
      'INSERT INTO users (id, email, role, isikukood_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(
      id,
      overrides.email ?? 'kodu@example.ee',
      overrides.role ?? 'private',
      overrides.isikukoodHash ?? null,
      now,
      now,
    )
  return id
}

function seedPasswordCredential(userId: string, password: string): void {
  const credentials = hashCredentialPassword(password)
  testDb.raw
    .prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .run(credentials.hash, credentials.salt, userId)
}

function liveSessionCount(userId: string): number {
  return (
    testDb.raw
      .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND revoked_at IS NULL')
      .get(userId) as { n: number }
  ).n
}

describe('POST /api/v1/auth/login rate limiting', () => {
  it('answers the sixth attempt from one address with 429', async () => {
    nextIp += 1
    const ip = `10.5.0.${String(nextIp)}`
    const attempt = () =>
      loginRoute(
        new NextRequest(`${BASE}/auth/login`, {
          method: 'POST',
          body: JSON.stringify({}),
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': ip,
          },
        }),
      )

    for (let attemptNumber = 0; attemptNumber < 5; attemptNumber += 1) {
      const response = await attempt()
      expect(response.status).toBe(401)
    }

    const blocked = await attempt()
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({ error: 'Liiga palju katseid' })
  })
})

describe('POST /api/v1/auth/login isikukood password login', () => {
  it('logs in with isikukood and password, sets both session cookies and starts a live session', async () => {
    const userId = seedUser({ isikukoodHash: hash(VALID_ISIKUKOOD) })
    seedPasswordCredential(userId, PASSWORD)

    const response = await loginRoute(
      loginRequest({ identifier: VALID_ISIKUKOOD, password: PASSWORD }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    expect(String(body.user?.id)).toBe(userId)

    const cookies = response.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true)
    expect(cookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true)
    expect(liveSessionCount(userId)).toBe(1)
  })

  it('rejects a wrong password with the neutral 401 and starts no session', async () => {
    const userId = seedUser({ isikukoodHash: hash(VALID_ISIKUKOOD) })
    seedPasswordCredential(userId, PASSWORD)

    const response = await loginRoute(
      loginRequest({ identifier: VALID_ISIKUKOOD, password: 'ValeSalasona1!' }),
    )
    expect(response.status).toBe(401)
    // Exact match: no extra key (e.g. a suspended code) may leak here.
    expect(await response.json()).toEqual({ error: NEUTRAL_ERROR })
    expect(response.headers.getSetCookie()).toEqual([])
    expect(liveSessionCount(userId)).toBe(0)
  })

  it('logs in by email for an account without an isikukood credential', async () => {
    const userId = seedUser({ email: 'ainult@email.ee' })
    seedPasswordCredential(userId, PASSWORD)

    const response = await loginRoute(
      loginRequest({ identifier: 'ainult@email.ee', password: PASSWORD }),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    expect(String(body.user?.id)).toBe(userId)
    expect(response.headers.getSetCookie()).toHaveLength(2)
  })
})
