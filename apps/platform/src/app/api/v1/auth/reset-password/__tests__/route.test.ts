import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { revokeAllUserSessionsMock } = vi.hoisted(() => ({
  revokeAllUserSessionsMock: vi.fn(),
}))

vi.mock('@/lib/auth/session', () => ({
  revokeAllUserSessions: revokeAllUserSessionsMock,
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as resetPasswordRoute } from '@/app/api/v1/auth/reset-password/route'
import { verifyCredentialPassword } from '@/lib/auth/password'
import { createResetToken } from '@/lib/auth/reset-tokens'
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

const BASE = 'http://localhost:3000/api/v1'
// Checksum-valid: weights 1..9,1 give 75 % 11 = 9, matching the last digit.
const VALID_ISIKUKOOD = '32708100019'
const NEW_PASSWORD = 'UusParool1!'
const WEAK_PASSWORD = 'lühike'

let testDb: SqliteTestDb
let repos: CoreRepositories
let nextIp = 0
const isikukoodKeyBackup = process.env.ISIKUKOOD_ENCRYPTION_KEY

beforeEach(() => {
  vi.clearAllMocks()
  revokeAllUserSessionsMock.mockResolvedValue(undefined)
  process.env.ISIKUKOOD_ENCRYPTION_KEY = isikukoodKeyBackup ?? 'reset-password-route-test-key'
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
function resetRequest(body: Record<string, unknown>): NextRequest {
  nextIp += 1
  return new NextRequest(`${BASE}/auth/reset-password`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.6.0.${String(nextIp)}`,
    },
  })
}

async function createUser(overrides: { isikukood?: string } = {}): Promise<string> {
  const id = crypto.randomUUID()
  await repos.create({
    collection: 'users',
    data: {
      id,
      email: `${id}@example.ee`,
      ...(overrides.isikukood !== undefined ? { isikukood: overrides.isikukood } : {}),
    },
  })
  return id
}

async function tokenFor(userId: string): Promise<string> {
  return createResetToken(userId, testDb.database)
}

function storedCredentials(userId: string): {
  password_hash: string | null
  password_salt: string | null
} | undefined {
  return testDb.raw
    .prepare('SELECT password_hash, password_salt FROM users WHERE id = ?')
    .get(userId) as
    | { password_hash: string | null; password_salt: string | null }
    | undefined
}

describe('POST /api/v1/auth/reset-password policy enforcement', () => {
  it('rejects a weak password with 400 and keeps the token usable', async () => {
    const userId = await createUser()
    const token = await tokenFor(userId)

    const weak = await resetPasswordRoute(resetRequest({ token, password: WEAK_PASSWORD }))
    expect(weak.status).toBe(400)
    expect(await weak.json()).toEqual({ error: 'Parool peab olema vähemalt 10 tähemärki' })
    expect(storedCredentials(userId)?.password_hash).toBeNull()

    // The weak attempt must not have burned the single-use link.
    const strong = await resetPasswordRoute(resetRequest({ token, password: NEW_PASSWORD }))
    expect(strong.status).toBe(200)
    expect(revokeAllUserSessionsMock).toHaveBeenCalledWith(userId)
  })

  it('rejects a password equal to the isikukood with 400', async () => {
    const userId = await createUser({ isikukood: VALID_ISIKUKOOD })
    const token = await tokenFor(userId)

    const response = await resetPasswordRoute(resetRequest({ token, password: VALID_ISIKUKOOD }))
    expect(response.status).toBe(400)
    // The static pre-check (sent without the isikukood) rejects an
    // all-digit code before the dedicated notIsikukood rule can run.
    expect(await response.json()).toEqual({ error: 'Paroolis peab olema vähemalt üks suurtäht' })
    expect(storedCredentials(userId)?.password_hash).toBeNull()
    expect(revokeAllUserSessionsMock).not.toHaveBeenCalled()
  })
})

describe('POST /api/v1/auth/reset-password success', () => {
  it('resets the password and revokes the user sessions', async () => {
    const userId = await createUser()
    const token = await tokenFor(userId)

    const response = await resetPasswordRoute(resetRequest({ token, password: NEW_PASSWORD }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ message: 'Parool on edukalt lähtestatud' })

    expect(revokeAllUserSessionsMock).toHaveBeenCalledTimes(1)
    expect(revokeAllUserSessionsMock).toHaveBeenCalledWith(userId)

    const stored = storedCredentials(userId)
    expect(
      verifyCredentialPassword(
        NEW_PASSWORD,
        stored?.password_hash ?? null,
        stored?.password_salt ?? null,
      ),
    ).toBe(true)
  })

  it('rejects an unknown token with the neutral 400 and revokes nothing', async () => {
    const userId = await createUser()

    // Token-shaped (96 hex chars) but never issued, so no row matches.
    const response = await resetPasswordRoute(
      resetRequest({ token: 'ab'.repeat(48), password: NEW_PASSWORD }),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Lähtestamise link on aegunud või juba kasutatud',
    })
    expect(revokeAllUserSessionsMock).not.toHaveBeenCalled()
    expect(storedCredentials(userId)?.password_hash).toBeNull()
  })
})
