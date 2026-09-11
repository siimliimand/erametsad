import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as testNotificationRoute } from '@/app/api/v1/my/notifications/test/route'
import { createSession, revokeSession } from '@/lib/auth/session'
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
import {
  setEmailBindingForTests,
  type EmailSenderBinding,
} from '@/lib/notifications/email-sender'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'notifications-test-route-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'

const TRANSPORT_ENV_KEYS = [
  'CLOUDFLARE_EMAIL_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'SMTP_HOST',
] as const

const savedTransportEnv: Record<string, string | undefined> = {}

let testDb: SqliteTestDb
let repos: CoreRepositories
let sentMessages: { to: string | string[]; subject: string; html: string }[]

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of TRANSPORT_ENV_KEYS) {
    savedTransportEnv[key] = process.env[key]
    // The sender treats every variable by truthiness; '' reads as unset and
    // keeps the cloudflare-api/smtp transports out of the chain.
    process.env[key] = ''
  }
  delete process.env.SMTP_FROM
  sentMessages = []

  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  vi.mocked(getRepositories).mockImplementation(() => Promise.resolve(repos))
  setD1ForTests(testDb.d1)
})

afterEach(() => {
  setEmailBindingForTests(null)
  for (const key of TRANSPORT_ENV_KEYS) process.env[key] = savedTransportEnv[key] ?? ''
  setD1ForTests(null)
  testDb.close()
})

function testNotificationRequest(accessToken: string): NextRequest {
  return new NextRequest(`${BASE}/my/notifications/test`, {
    method: 'POST',
    headers: { cookie: `access_token=${accessToken}` },
  })
}

function successBinding(): EmailSenderBinding {
  return {
    send: async (message) => {
      sentMessages.push({ to: message.to, subject: message.subject, html: message.html })
      return { messageId: 'test-binding-1' }
    },
  }
}

async function createUser(email?: string): Promise<string> {
  const id = crypto.randomUUID()
  await repos.create({
    collection: 'users',
    data: { id, email: email ?? `${id}@example.ee` },
  })
  return id
}

describe('POST /api/v1/my/notifications/test auth', () => {
  it('answers 401 without an access token', async () => {
    const response = await testNotificationRoute(
      new NextRequest(`${BASE}/my/notifications/test`, { method: 'POST' }),
    )
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Autentimine ebaõnnestus' })
  })

  it('answers 401 for an access token from a revoked session', async () => {
    const userId = await createUser()
    const { accessToken, sessionId } = await createSession(userId, 'private')
    await revokeSession(sessionId)

    const response = await testNotificationRoute(testNotificationRequest(accessToken))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Autentimine ebaõnnestus' })
  })
})

describe('POST /api/v1/my/notifications/test happy path', () => {
  it('sends one sample email to the user address through the binding', async () => {
    const email = `${crypto.randomUUID()}@example.ee`
    const userId = await createUser(email)
    const { accessToken } = await createSession(userId, 'private')
    setEmailBindingForTests(successBinding())

    const response = await testNotificationRoute(testNotificationRequest(accessToken))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', transport: 'email-binding' })
    expect(sentMessages).toHaveLength(1)
    expect(sentMessages[0]?.to).toEqual([email])
    expect(sentMessages[0]?.subject).toBe('Test-teavitus')
    expect(sentMessages[0]?.html).toContain('Näidisoksjon')
  })
})

describe('POST /api/v1/my/notifications/test rate limit', () => {
  it('answers 429 on the second send within one minute and skips sending', async () => {
    const userId = await createUser()
    const { accessToken } = await createSession(userId, 'private')
    setEmailBindingForTests(successBinding())

    const first = await testNotificationRoute(testNotificationRequest(accessToken))
    expect(first.status).toBe(200)

    const second = await testNotificationRoute(testNotificationRequest(accessToken))
    expect(second.status).toBe(429)
    const body = (await second.json()) as { error?: string }
    expect(body.error).toContain('ühe korra minutis')
    expect(sentMessages).toHaveLength(1)
  })
})

describe('POST /api/v1/my/notifications/test send failure', () => {
  it('answers 502 with the real error when no transport can deliver', async () => {
    const userId = await createUser()
    const { accessToken } = await createSession(userId, 'private')
    // No binding, no API credentials, no SMTP_HOST: the chain fails closed.
    setEmailBindingForTests(null)

    const response = await testNotificationRoute(testNotificationRequest(accessToken))

    expect(response.status).toBe(502)
    const body = (await response.json()) as { error?: string }
    expect(body.error).toContain('Test-teavituse saatmine ebaõnnestus')
    expect(body.error).toContain('No email transport available')
  })
})
