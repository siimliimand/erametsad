import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as changePasswordRoute } from '@/app/api/v1/auth/change-password/route'
import { POST as loginRoute } from '@/app/api/v1/auth/login/route'
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
// Meets the shared password policy (10+ chars, upper, number, symbol).
const FIRST_PASSWORD = 'UusParool1!'

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
    consents: {
      terms: consentAt,
      privacy: consentAt,
      marketing: '1970-01-01T00:00:00.000Z',
    },
    ...overrides,
  }
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

function bearerCookie(cookies: string[], name: string): string {
  const cookie = cookies.find((value) => value.startsWith(`${name}=`))
  if (cookie === undefined) throw new Error(`cookie not found: ${name}`)
  return (cookie.split(';')[0] ?? '').slice(name.length + 1)
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

describe('POST /api/v1/auth/register session issuance', () => {
  it('issues a live session and sets both session cookies on success', async () => {
    const response = await registerRoute(
      registerRequest(validBody({ identifier: 'sessioon@example.ee' }), '10.0.1.1'),
    )
    expect(response.status).toBe(200)

    const cookies = response.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true)
    expect(cookies.some((cookie) => cookie.startsWith('refresh_token='))).toBe(true)

    const body = (await response.json()) as {
      user?: { id?: unknown }
      profile?: { id?: unknown }
    }
    const userId = String(body.user?.id)
    const profileId = String(body.profile?.id)

    const row = testDb.raw
      .prepare('SELECT user_id, profile_id, revoked_at FROM sessions WHERE user_id = ?')
      .get(userId) as
      | { user_id: string; profile_id: string | null; revoked_at: string | null }
      | undefined
    expect(row?.profile_id).toBe(profileId)
    expect(row?.revoked_at).toBeNull()
  })
})

describe('POST /api/v1/auth/register phone persistence', () => {
  it('persists a valid phone on the profile', async () => {
    const response = await registerRoute(
      registerRequest(
        validBody({ identifier: 'telefon@example.ee', phone: '+37251234567' }),
        '10.0.2.1',
      ),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    const row = testDb.raw
      .prepare('SELECT phone FROM profiles WHERE user_id = ?')
      .get(String(body.user?.id)) as { phone: string | null } | undefined
    expect(row?.phone).toBe('+37251234567')
  })

  it('rejects a phone that fails the Estonian format with 400', async () => {
    const response = await registerRoute(
      registerRequest(validBody({ phone: '51234567' }), '10.0.2.2'),
    )
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Vigane telefoninumber' })
    expect(userCount()).toBe(0)
  })

  it('leaves the phone column unset when no phone is sent', async () => {
    const response = await registerRoute(
      registerRequest(validBody({ identifier: 'ilmatelefon@example.ee' }), '10.0.2.3'),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    const row = testDb.raw
      .prepare('SELECT phone FROM profiles WHERE user_id = ?')
      .get(String(body.user?.id)) as { phone: string | null } | undefined
    expect(row?.phone).toBeNull()
  })
})

describe('POST /api/v1/auth/register passwordless accounts', () => {
  it('creates the account without a stored credential', async () => {
    const response = await registerRoute(
      registerRequest(validBody({ identifier: 'paroolita@example.ee' }), '10.0.3.1'),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    const stored = storedCredentials(String(body.user?.id))
    expect(stored?.password_hash).toBeNull()
    expect(stored?.password_salt).toBeNull()
  })

  it('ignores a password that a client still sends in the payload', async () => {
    const response = await registerRoute(
      registerRequest(
        validBody({ identifier: 'salasona@example.ee', password: 'paastunudSalasana1!' }),
        '10.0.3.2',
      ),
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { user?: { id?: unknown } }
    const stored = storedCredentials(String(body.user?.id))
    expect(stored?.password_hash).toBeNull()
    expect(stored?.password_salt).toBeNull()
  })

  it('rejects the payload without identifier with 400', async () => {
    const body = validBody()
    delete body.identifier
    const response = await registerRoute(registerRequest(body, '10.0.3.3'))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'Puuduvad kohustuslikud väljad' })
  })
})

describe('POST /api/v1/auth/register first-set and password login flow', () => {
  // The realistic new-user path: register passwordless, set the first
  // password with only newPassword (the ?first=1 contract), then log in
  // with that password.
  it('registers, sets the first password and logs in with it', async () => {
    const registerResponse = await registerRoute(
      registerRequest(validBody({ identifier: 'esimene@example.ee' }), '10.0.4.1'),
    )
    expect(registerResponse.status).toBe(200)
    const registered = (await registerResponse.json()) as { user?: { id?: unknown } }
    const userId = String(registered.user?.id)
    expect(storedCredentials(userId)?.password_hash).toBeNull()

    const accessToken = bearerCookie(registerResponse.headers.getSetCookie(), 'access_token')
    const changeResponse = await changePasswordRoute(
      new NextRequest(`${BASE}/auth/change-password`, {
        method: 'POST',
        body: JSON.stringify({ newPassword: FIRST_PASSWORD }),
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.0.4.2',
          cookie: `access_token=${accessToken}`,
        },
      }),
    )
    expect(changeResponse.status).toBe(200)

    const credentials = storedCredentials(userId)
    expect(credentials?.password_hash).toEqual(expect.any(String))
    expect(credentials?.password_salt).toEqual(expect.any(String))

    // The new password is now the account's only credential and logs in.
    const loginResponse = await loginRoute(
      new NextRequest(`${BASE}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ identifier: 'esimene@example.ee', password: FIRST_PASSWORD }),
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': '10.0.4.9',
        },
      }),
    )
    expect(loginResponse.status).toBe(200)
    const loginBody = (await loginResponse.json()) as { user?: { id?: unknown } }
    expect(String(loginBody.user?.id)).toBe(userId)
  })
})
