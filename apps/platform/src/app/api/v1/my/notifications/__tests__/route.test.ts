import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { GET as notificationsRoute } from '@/app/api/v1/my/notifications/route'
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

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'notifications-route-test-jwt-secret'

const BASE = 'http://localhost:3000/api/v1'

let testDb: SqliteTestDb
let repos: CoreRepositories

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

function notificationsRequest(accessToken: string): NextRequest {
  return new NextRequest(`${BASE}/my/notifications`, {
    headers: { cookie: `access_token=${accessToken}` },
  })
}

async function createUser(): Promise<string> {
  const id = crypto.randomUUID()
  await repos.create({
    collection: 'users',
    data: { id, email: `${id}@example.ee` },
  })
  return id
}

async function seedNotification(userId: string): Promise<void> {
  await repos.create({
    collection: 'notifications',
    data: {
      userId,
      event: 'bid.outbid',
      channel: 'in_app',
      title: 'Teie pakkumus on ületatud',
      body: 'Keegi esitas suurema pakkumuse.',
      payload: { auctionId: crypto.randomUUID() },
      sentAt: new Date().toISOString(),
    },
  })
}

describe('GET /api/v1/my/notifications session resolution', () => {
  it('answers 200 for an access token from an active session', async () => {
    const userId = await createUser()
    await seedNotification(userId)
    const { accessToken } = await createSession(userId, 'private')

    const response = await notificationsRoute(notificationsRequest(accessToken))
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      items?: unknown[]
      unreadCount?: unknown
    }
    expect(body.items).toHaveLength(1)
    expect(body.unreadCount).toBe(1)
  })

  it('answers 401 for an access token from a revoked session', async () => {
    const userId = await createUser()
    const { accessToken, sessionId } = await createSession(userId, 'private')
    await revokeSession(sessionId)

    const response = await notificationsRoute(notificationsRequest(accessToken))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Autentimine ebaõnnestus' })
  })
})
