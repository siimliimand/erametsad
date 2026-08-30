import { NextRequest } from 'next/server'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }))

vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: sendMailMock })) },
}))

vi.mock('@/env', () => ({
  env: {
    SMTP_HOST: 'localhost',
    SMTP_PORT: 1025,
    SMTP_USER: '',
    SMTP_PASS: '',
    SMTP_FROM: 'noreply@erametsad.ee',
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as forgotPasswordRoute } from '@/app/api/v1/auth/forgot-password/route'
import { consumeResetToken } from '@/lib/auth/reset-tokens'
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

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'forgot-password-route-test-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'
// Checksum-valid: weights 1..9,1 give 75 % 11 = 9, matching the last digit.
const VALID_ISIKUKOOD = '32708100019'
// The emailed link must point at this existing (portal) page route.
const RESET_TOKEN_PAGE = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../(portal)/reset-password/[token]/page.tsx',
)

let testDb: SqliteTestDb
let repos: CoreRepositories

function seedUser(overrides: { email?: string; isikukoodHash?: string } = {}): string {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  testDb.raw
    .prepare(
      'INSERT INTO users (id, email, isikukood_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    )
    .run(id, overrides.email ?? 'kodu@example.ee', overrides.isikukoodHash ?? null, now, now)
  return id
}

// authRateLimiter buckets by x-forwarded-for (5 requests per minute), so
// every test posts from its own address.
function forgotRequest(identifier: string, ip = '10.0.0.1'): NextRequest {
  return new NextRequest(`${BASE}/auth/forgot-password`, {
    method: 'POST',
    body: JSON.stringify({ identifier }),
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
  })
}

function sentEmail(): { to?: string; subject?: string; text?: string } {
  expect(sendMailMock).toHaveBeenCalledTimes(1)
  return (sendMailMock.mock.calls[0] as [{ to?: string; subject?: string; text?: string }])[0]
}

function sentLink(): URL {
  const link = sentEmail().text?.match(/https?:\/\/\S+/)?.[0]
  if (!link) throw new Error('reset email contains no link')
  return new URL(link)
}

beforeEach(() => {
  vi.clearAllMocks()
  sendMailMock.mockResolvedValue({})
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

describe('POST /api/v1/auth/forgot-password reset link', () => {
  it('emails a /reset-password/<token> link that matches the existing page route', async () => {
    const email = 'kodu@example.ee'
    const userId = seedUser({ email })

    const response = await forgotPasswordRoute(forgotRequest(email, '10.0.0.1'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message: 'Kui konto on olemas, saadeti parooli lähtestamise link e-posti aadressile',
    })

    expect(sentEmail().to).toBe(email)
    const url = sentLink()

    // Regression: the token is a path segment, never a query parameter.
    expect(url.pathname).toMatch(/^\/reset-password\/[\da-f]+$/)
    expect(url.search).toBe('')
    expect(existsSync(RESET_TOKEN_PAGE)).toBe(true)
    // The token in the link must resolve to the requested account.
    expect(await consumeResetToken(url.pathname.split('/')[2] ?? '')).toBe(userId)
  })

  it('matches users by isikukood hash and emails the same link shape', async () => {
    seedUser({ email: 'kood@example.ee', isikukoodHash: hash(VALID_ISIKUKOOD) })

    const response = await forgotPasswordRoute(forgotRequest(VALID_ISIKUKOOD, '10.0.0.2'))
    expect(response.status).toBe(200)

    expect(new URL(sentLink().href).pathname).toMatch(/^\/reset-password\/[\da-f]+$/)
  })

  it('returns the neutral message and sends no email for an unknown identifier', async () => {
    const response = await forgotPasswordRoute(forgotRequest('puudub@example.ee', '10.0.0.3'))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      message: 'Kui konto on olemas, saadeti parooli lähtestamise link e-posti aadressile',
    })
    expect(sendMailMock).not.toHaveBeenCalled()
  })
})
