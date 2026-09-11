import { unzipSync } from 'fflate'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { GET as exportRoute } from '@/app/api/v1/my/export/route'
import { createSession, revokeSession } from '@/lib/auth/session'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'export-route-test-jwt-secret'
process.env.ISIKUKOOD_ENCRYPTION_KEY = process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'export-route-test-key'

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

function exportRequest(accessToken?: string): NextRequest {
  return new NextRequest(`${BASE}/my/export`, {
    ...(accessToken ? { headers: { cookie: `access_token=${accessToken}` } } : {}),
  })
}

function decodeEntry(files: ReturnType<typeof unzipSync>, name: string): unknown {
  return JSON.parse(new TextDecoder().decode(files[name]))
}

async function seedExportData(): Promise<{ userId: string; accessToken: string }> {
  const userId = crypto.randomUUID()
  const otherId = crypto.randomUUID()
  const auctionId = crypto.randomUUID()
  await repos.create({
    collection: 'users',
    data: {
      id: userId,
      email: 'mari@example.ee',
      name: 'Mari Maasikas',
      phone: '+372 5123 4567',
      passwordHash: 'leak-canary-password-hash',
      isikukood: '30000000003',
    },
  })
  await repos.create({ collection: 'users', data: { id: otherId, email: 'teine@example.ee' } })
  await repos.create({
    collection: 'profile',
    data: {
      userId,
      type: 'private',
      displayName: 'Mari Maasikas',
      notificationPreferences: { 'bid.outbid': { channels: ['in_app'] } },
    },
  })
  await repos.create({
    collection: 'auctions',
    data: {
      id: auctionId,
      title: 'Metsa oksjon',
      slug: `slug-${auctionId}`,
      objectType: 'raieoigus',
      status: 'active',
      type: 'open',
      minBidCents: 10_000,
      endsAt: '2099-01-01T00:00:00Z',
    },
  })
  await repos.create({
    collection: 'bids',
    data: {
      auction: auctionId,
      user: userId,
      amountCents: 15_000,
      type: 'open',
      source: 'manual',
      status: 'leading',
      ipHash: 'ip-hash-mari',
    },
  })
  // A foreign bid whose ipHash must not pull someone else's consent rows in.
  await repos.create({
    collection: 'bids',
    data: {
      auction: auctionId,
      user: otherId,
      amountCents: 12_000,
      type: 'open',
      source: 'manual',
      status: 'outbid',
      ipHash: 'ip-hash-teine',
    },
  })
  await repos.create({
    collection: 'autobidders',
    data: { user: userId, auction: auctionId, maxAmountCents: 20_000 },
  })
  await repos.create({
    collection: 'auction-rights',
    data: { user: userId, objectType: 'raieoigus', grantedBy: otherId, grantedAt: new Date().toISOString() },
  })
  await repos.create({
    collection: 'consent-log',
    data: {
      choice: 'custom',
      categories: { necessary: true, statistics: false },
      ipHash: 'ip-hash-mari',
    },
  })
  await repos.create({
    collection: 'consent-log',
    data: {
      choice: 'accepted',
      categories: { necessary: true, statistics: true },
      ipHash: 'ip-hash-teine',
    },
  })
  await repos.create({
    collection: 'service-requests',
    data: {
      type: 'kava',
      payload: {
        type: 'kava',
        contact: { name: 'Mari Maasikas', phone: '+372 5123 4567', email: 'mari@example.ee' },
        phone: '+372 5123 4567',
        cadastres: ['12345:001:0001'],
      },
      consentAt: new Date().toISOString(),
      formName: 'kava',
    },
  })
  await repos.create({
    collection: 'service-requests',
    data: {
      type: 'kava',
      payload: {
        type: 'kava',
        contact: { name: 'Teine Tuul', phone: '+372 5999 9999', email: 'teine@example.ee' },
        phone: '+372 5999 9999',
        cadastres: ['54321:001:0001'],
      },
      consentAt: new Date().toISOString(),
      formName: 'kava',
    },
  })
  await repos.create({
    collection: 'rights-request',
    data: { user: userId, objectType: 'raieoigus', status: 'pending' },
  })

  const { accessToken } = await createSession(userId, 'private')
  return { userId, accessToken }
}

const EXPORT_ENTRIES = [
  'autobidid.json',
  'kasutaja.json',
  'nõusolekud.json',
  'oiguste-taotlused.json',
  'oksjonioigused.json',
  'pakkumised.json',
  'profiilid.json',
  'sessioonid.json',
  'teenustellimused.json',
  'teavituste-eelistused.json',
]

describe('GET /api/v1/my/export', () => {
  it('answers 401 without an access token', async () => {
    const response = await exportRoute(exportRequest())
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Autentimine ebaõnnestus' })
  })

  it('answers 401 for an access token from a revoked session', async () => {
    const { userId } = await seedExportData()
    const { accessToken, sessionId } = await createSession(userId, 'private')
    await revokeSession(sessionId)

    const response = await exportRoute(exportRequest(accessToken))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Autentimine ebaõnnestus' })
  })

  it('streams a ZIP whose entries cover bids, consents and profile data', async () => {
    const { accessToken } = await seedExportData()

    const response = await exportRoute(exportRequest(accessToken))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    expect(response.headers.get('content-disposition')).toMatch(
      /filename="erametsad-andmed-\d{4}-\d{2}-\d{2}\.zip"/,
    )

    const bytes = new Uint8Array(await response.arrayBuffer())
    const files = unzipSync(bytes)
    expect(Object.keys(files).sort()).toEqual([...EXPORT_ENTRIES].sort())

    const user = decodeEntry(files, 'kasutaja.json') as Record<string, unknown>
    expect(user.email).toBe('mari@example.ee')
    for (const banned of [
      'isikukood',
      'isikukoodEncrypted',
      'isikukoodIv',
      'isikukoodAuthTag',
      'isikukoodHash',
      'passwordHash',
      'passwordSalt',
    ]) {
      expect(user).not.toHaveProperty(banned)
    }

    const bids = decodeEntry(files, 'pakkumised.json') as Record<string, unknown>[]
    expect(bids).toHaveLength(1)
    expect(bids[0]?.amountCents).toBe(15_000)
    expect(bids[0]).not.toHaveProperty('identitySnapshot')

    const consents = decodeEntry(files, 'nõusolekud.json') as Record<string, unknown>[]
    expect(consents).toHaveLength(1)
    expect(consents[0]?.choice).toBe('custom')

    const profiles = decodeEntry(files, 'profiilid.json') as Record<string, unknown>[]
    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.displayName).toBe('Mari Maasikas')

    const preferences = decodeEntry(files, 'teavituste-eelistused.json') as Record<
      string,
      unknown
    >[]
    expect(preferences).toHaveLength(1)
    expect(preferences[0]?.notificationPreferences).toEqual({ 'bid.outbid': { channels: ['in_app'] } })

    const autobidders = decodeEntry(files, 'autobidid.json') as Record<string, unknown>[]
    expect(autobidders).toHaveLength(1)
    expect(autobidders[0]?.maxAmountCents).toBe(20_000)

    const rights = decodeEntry(files, 'oksjonioigused.json') as Record<string, unknown>[]
    expect(rights).toHaveLength(1)
    expect(rights[0]?.objectType).toBe('raieoigus')

    const sessions = decodeEntry(files, 'sessioonid.json') as Record<string, unknown>[]
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.current).toBe(true)

    const serviceRequests = decodeEntry(files, 'teenustellimused.json') as Record<string, unknown>[]
    expect(serviceRequests).toHaveLength(1)
    const payload = serviceRequests[0]?.payload as Record<string, unknown>
    expect((payload.contact as Record<string, unknown>).email).toBe('mari@example.ee')

    const rightsRequests = decodeEntry(files, 'oiguste-taotlused.json') as Record<string, unknown>[]
    expect(rightsRequests).toHaveLength(1)
    expect(rightsRequests[0]?.status).toBe('pending')

    // Credential material and isikukood plaintext never reach the archive.
    const text = new TextDecoder().decode(bytes)
    expect(text).not.toContain('leak-canary-password-hash')
    expect(text).not.toContain('30000000003')
  })

  it('rate-limits repeated exports per user', async () => {
    const { userId } = await seedExportData()
    const { accessToken } = await createSession(userId, 'private')

    for (let i = 0; i < 5; i++) {
      const response = await exportRoute(exportRequest(accessToken))
      expect(response.status).toBe(200)
    }

    const blocked = await exportRoute(exportRequest(accessToken))
    expect(blocked.status).toBe(429)
    expect(await blocked.json()).toEqual({ error: 'Liiga palju päringuid' })
  })
})
