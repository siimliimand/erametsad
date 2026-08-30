import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as changePasswordRoute } from '@/app/api/v1/auth/change-password/route'
import { POST as loginRoute } from '@/app/api/v1/auth/login/route'
import { signAccessToken } from '@/lib/auth/jwt'
import { hashCredentialPassword, verifyCredentialPassword } from '@/lib/auth/password'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'change-password-route-test-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'
const NEW_PASSWORD = 'UusParool1!'
const OLD_PASSWORD = 'VanaParool1!'

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
function changeRequest(
  body: Record<string, unknown>,
  userId: string,
): NextRequest {
  nextIp += 1
  const ip = `10.1.0.${String(nextIp)}`
  return new NextRequest(`${BASE}/auth/change-password`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      cookie: `access_token=${signAccessToken({ userId, role: 'private' })}`,
    },
  })
}

interface CreatedUser {
  id: string
}

// Register-shaped user: the register route now creates accounts with
// authMethod 'eid' and no credential columns.
async function createUser(
  overrides: { passwordHash?: string | null; passwordSalt?: string | null } = {},
): Promise<CreatedUser> {
  const id = crypto.randomUUID()
  await repos.create({
    collection: 'users',
    data: {
      id,
      email: `${id}@example.ee`,
      authMethod: 'eid',
      passwordHash: overrides.passwordHash ?? null,
      passwordSalt: overrides.passwordSalt ?? null,
    },
  })
  return { id }
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

describe('POST /api/v1/auth/change-password first-time set', () => {
  // The register flow's ?first=1 path: a fresh passwordless account sets its
  // first password without oldPassword, then logs in with that password.
  it('sets the password without oldPassword for a user with no stored credential', async () => {
    const user = await createUser()
    const response = await changePasswordRoute(changeRequest({ newPassword: NEW_PASSWORD }, user.id))

    expect(response.status).toBe(200)
    const body = (await response.json()) as { message?: unknown }
    expect(typeof body.message).toBe('string')

    const stored = storedCredentials(user.id)
    expect(stored?.password_hash).toEqual(expect.any(String))
    expect(stored?.password_salt).toEqual(expect.any(String))
    expect(
      verifyCredentialPassword(NEW_PASSWORD, stored?.password_hash ?? null, stored?.password_salt ?? null),
    ).toBe(true)

    // The set password is the account's only credential and logs in.
    const loginResponse = await loginRoute(
      new NextRequest(`${BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ identifier: `${user.id}@example.ee`, password: NEW_PASSWORD }),
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': `10.2.0.${String(nextIp + 1)}`,
        },
      }),
    )
    expect(loginResponse.status).toBe(200)
    const loginBody = (await loginResponse.json()) as { user?: { id?: unknown } }
    expect(String(loginBody.user?.id)).toBe(user.id)
  })

  it('succeeds even when the client sends an oldPassword it could not have verified', async () => {
    const user = await createUser()
    const response = await changePasswordRoute(
      changeRequest({ oldPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD }, user.id),
    )

    expect(response.status).toBe(200)
    expect(
      verifyCredentialPassword(
        NEW_PASSWORD,
        storedCredentials(user.id)?.password_hash ?? null,
        storedCredentials(user.id)?.password_salt ?? null,
      ),
    ).toBe(true)
  })

  it('enforces the password policy on the first-time path', async () => {
    const user = await createUser()
    const response = await changePasswordRoute(changeRequest({ newPassword: 'lühike' }, user.id))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Parool peab olema vähemalt 10 tähemärki',
    })
    const stored = storedCredentials(user.id)
    expect(stored?.password_hash).toBeNull()
    expect(stored?.password_salt).toBeNull()
  })
})

describe('POST /api/v1/auth/change-password with an existing password', () => {
  async function createWithPassword(): Promise<CreatedUser> {
    const credentials = hashCredentialPassword(OLD_PASSWORD)
    return createUser({ passwordHash: credentials.hash, passwordSalt: credentials.salt })
  }

  it('rejects a wrong oldPassword and keeps the stored password', async () => {
    const user = await createWithPassword()
    const before = storedCredentials(user.id)
    const response = await changePasswordRoute(
      changeRequest({ oldPassword: 'ValeParool1!', newPassword: NEW_PASSWORD }, user.id),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Vale vana parool' })
    const after = storedCredentials(user.id)
    expect(after?.password_hash).toBe(before?.password_hash)
    expect(after?.password_salt).toBe(before?.password_salt)
  })

  it('still demands oldPassword when only newPassword is sent', async () => {
    const user = await createWithPassword()
    const before = storedCredentials(user.id)
    const response = await changePasswordRoute(changeRequest({ newPassword: NEW_PASSWORD }, user.id))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Vana ja uus parool on kohustuslikud',
    })
    expect(storedCredentials(user.id)?.password_hash).toBe(before?.password_hash)
  })

  it('changes the password when the correct oldPassword is presented', async () => {
    const user = await createWithPassword()
    const response = await changePasswordRoute(
      changeRequest({ oldPassword: OLD_PASSWORD, newPassword: NEW_PASSWORD }, user.id),
    )

    expect(response.status).toBe(200)
    const stored = storedCredentials(user.id)
    expect(
      verifyCredentialPassword(NEW_PASSWORD, stored?.password_hash ?? null, stored?.password_salt ?? null),
    ).toBe(true)
    expect(
      verifyCredentialPassword(OLD_PASSWORD, stored?.password_hash ?? null, stored?.password_salt ?? null),
    ).toBe(false)
  })

  it('enforces the password policy on the change path', async () => {
    const user = await createWithPassword()
    const before = storedCredentials(user.id)
    const response = await changePasswordRoute(
      changeRequest({ oldPassword: OLD_PASSWORD, newPassword: 'lühike' }, user.id),
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Parool peab olema vähemalt 10 tähemärki',
    })
    expect(storedCredentials(user.id)?.password_hash).toBe(before?.password_hash)
  })
})

describe('POST /api/v1/auth/change-password session handling', () => {
  it('requires an access token', async () => {
    nextIp += 1
    const request = new NextRequest(`${BASE}/auth/change-password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword: NEW_PASSWORD }),
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': `10.1.1.${String(nextIp)}`,
      },
    })
    const response = await changePasswordRoute(request)
    expect(response.status).toBe(401)
  })

  it('revokes sessions and clears the session cookies on success', async () => {
    const user = await createUser()
    const response = await changePasswordRoute(changeRequest({ newPassword: NEW_PASSWORD }, user.id))

    expect(response.status).toBe(200)
    const cookies = response.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true)
    const rows = testDb.raw
      .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND revoked_at IS NULL')
      .get(user.id) as { n: number }
    expect(rows.n).toBe(0)
  })
})
