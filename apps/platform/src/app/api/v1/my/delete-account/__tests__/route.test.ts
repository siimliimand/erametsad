import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(),
}))

import { POST as deleteAccountRoute } from '@/app/api/v1/my/delete-account/route'
import { createSession, revokeSession } from '@/lib/auth/session'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  createCoreRepositories,
  deletedEmailTombstone,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'
import { verifyAuditChain } from '@/lib/data/repositories/audit-chain'
import { getRepositories } from '@/lib/data/runtime'
import { setD1ForTests } from '@/lib/db'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'delete-account-route-test-jwt-secret'
process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'delete-account-route-test-key'

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

function deleteRequest(
  body: Record<string, unknown>,
  accessToken?: string,
): NextRequest {
  return new NextRequest(`${BASE}/my/delete-account`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { cookie: `access_token=${accessToken}` } : {}),
    },
  })
}

function userRow(userId: string): Record<string, unknown> | undefined {
  return testDb.raw
    .prepare(
      'SELECT email, name, phone, status, isikukood_encrypted, password_hash FROM users WHERE id = ?',
    )
    .get(userId) as Record<string, unknown> | undefined
}

function liveSessionCount(userId: string): number {
  const row = testDb.raw
    .prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ? AND revoked_at IS NULL')
    .get(userId) as { n: number }
  return row.n
}

function auditRows(userId: string): { action: string; reason: string | null; session_id: string | null }[] {
  return testDb.raw
    .prepare(
      "SELECT action, reason, session_id FROM audit_entries WHERE entity_id = ? AND action = 'user-self-deletion'",
    )
    .all(userId) as { action: string; reason: string | null; session_id: string | null }[]
}

async function seedUser(): Promise<string> {
  const userId = crypto.randomUUID()
  await repos.create({
    collection: 'users',
    data: {
      id: userId,
      email: 'mari@example.ee',
      name: 'Mari Maasikas',
      phone: '+372 5123 4567',
      passwordHash: 'hash',
      isikukood: '30000000003',
    },
  })
  await repos.create({
    collection: 'profile',
    data: { userId, type: 'private', displayName: 'Mari Maasikas' },
  })
  return userId
}

async function seedAuction(status: 'active' | 'ended'): Promise<string> {
  const auctionId = crypto.randomUUID()
  await repos.create({
    collection: 'auctions',
    data: {
      id: auctionId,
      title: 'Metsa oksjon',
      slug: `slug-${auctionId}`,
      objectType: 'raieoigus',
      status,
      type: 'open',
      minBidCents: 10_000,
      endsAt: '2099-01-01T00:00:00Z',
    },
  })
  return auctionId
}

async function seedBid(userId: string, auctionId: string): Promise<void> {
  await repos.create({
    collection: 'bids',
    data: {
      auction: auctionId,
      user: userId,
      amountCents: 15_000,
      type: 'open',
      source: 'manual',
      status: 'leading',
    },
  })
}

describe('POST /api/v1/my/delete-account auth', () => {
  it('answers 401 without an access token', async () => {
    const response = await deleteAccountRoute(deleteRequest({ confirmation: 'KUSTUTA' }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: 'Autentimine ebaõnnestus' })
  })

  it('answers 401 for an access token from a revoked session', async () => {
    const userId = await seedUser()
    const { accessToken, sessionId } = await createSession(userId, 'private')
    await revokeSession(sessionId)

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )
    expect(response.status).toBe(401)
    expect(userRow(userId)?.status).toBe('active')
  })
})

describe('POST /api/v1/my/delete-account confirmation', () => {
  it('rejects a missing or wrong typed confirmation and keeps the account', async () => {
    const userId = await seedUser()
    const { accessToken } = await createSession(userId, 'private')

    for (const confirmation of [undefined, 'kustuta', 'KUSTUTATUD', '']) {
      const body =
        confirmation === undefined ? {} : { confirmation }
      const response = await deleteAccountRoute(deleteRequest(body, accessToken))
      expect(response.status).toBe(400)
      expect(await response.json()).toEqual({ error: 'Kinnituseks kirjuta KUSTUTA' })
    }

    expect(userRow(userId)?.email).toBe('mari@example.ee')
    expect(liveSessionCount(userId)).toBe(1)
    expect(auditRows(userId)).toHaveLength(0)
  })
})

describe('POST /api/v1/my/delete-account active-participation guard', () => {
  it('refuses while a bid sits on an active auction and leaves the account intact', async () => {
    const userId = await seedUser()
    const auctionId = await seedAuction('active')
    await seedBid(userId, auctionId)
    const { accessToken } = await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error?: unknown }
    expect(typeof body.error).toBe('string')
    expect(body.error).toContain('aktiivsed pakkumised')
    expect(userRow(userId)?.status).toBe('active')
    expect(userRow(userId)?.email).toBe('mari@example.ee')
    expect(liveSessionCount(userId)).toBe(1)
    expect(auditRows(userId)).toHaveLength(0)
  })

  it('refuses while a live autobidder exists, even on a non-active auction', async () => {
    const userId = await seedUser()
    const auctionId = await seedAuction('ended')
    await repos.create({
      collection: 'autobidders',
      data: { user: userId, auction: auctionId, maxAmountCents: 20_000 },
    })
    const { accessToken } = await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error?: unknown }
    expect(body.error).toContain('autobidid')
    expect(userRow(userId)?.status).toBe('active')
  })

  it('refuses while a pending contract awaits the signature', async () => {
    const userId = await seedUser()
    const template = await repos.create({
      collection: 'contract-templates',
      data: { name: 'Müügileping', type: 'auction', version: '1.0' },
    })
    const auctionId = await seedAuction('ended')
    await repos.create({
      collection: 'contracts',
      data: { template: template.id, lot: auctionId, signedBy: userId, status: 'prepared' },
    })
    const { accessToken } = await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )

    expect(response.status).toBe(409)
    const body = (await response.json()) as { error?: unknown }
    expect(body.error).toContain('allkirjastamata lepingud')
    expect(userRow(userId)?.status).toBe('active')
  })

  it('ignores a signed contract and a bid on an ended auction', async () => {
    const userId = await seedUser()
    const template = await repos.create({
      collection: 'contract-templates',
      data: { name: 'Müügileping', type: 'auction', version: '1.0' },
    })
    const auctionId = await seedAuction('ended')
    await repos.create({
      collection: 'contracts',
      data: {
        template: template.id,
        lot: auctionId,
        signedBy: userId,
        status: 'signed',
        signedAt: '2026-01-01T00:00:00.000Z',
      },
    })
    await seedBid(userId, auctionId)
    const { accessToken } = await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )
    expect(response.status).toBe(200)
  })
})

describe('POST /api/v1/my/delete-account success', () => {
  it('anonymizes the user, revokes every session and clears the cookies', async () => {
    const userId = await seedUser()
    const auctionId = await seedAuction('ended')
    await seedBid(userId, auctionId)
    const current = await createSession(userId, 'private')
    await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, current.accessToken),
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok' })

    const row = userRow(userId)
    expect(row?.email).toBe(deletedEmailTombstone(userId))
    expect(row?.status).toBe('deleted')
    expect(row?.name).toBeNull()
    expect(row?.phone).toBeNull()
    expect(row?.isikukood_encrypted).toBeNull()
    expect(row?.password_hash).toBeNull()
    const profile = testDb.raw
      .prepare('SELECT display_name FROM profiles WHERE user_id = ?')
      .get(userId) as { display_name: string | null } | undefined
    expect(profile?.display_name).toBeNull()

    // The current session dies with the rest; the response clears the
    // cookies so the next document load is signed out.
    expect(liveSessionCount(userId)).toBe(0)
    const cookies = response.headers.getSetCookie()
    expect(cookies.some((cookie) => cookie.startsWith('access_token='))).toBe(true)

    // Append-only ledger: the bid row survives its owner's deletion.
    const bids = testDb.raw
      .prepare('SELECT COUNT(*) AS n FROM bids WHERE user_id = ?')
      .get(userId) as { n: number }
    expect(bids.n).toBe(1)
  })

  it('writes one user-self-deletion audit entry bound to the dying session', async () => {
    const userId = await seedUser()
    const { accessToken, sessionId } = await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )
    expect(response.status).toBe(200)

    const rows = auditRows(userId)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.reason).toBe('user-self-deletion')
    expect(rows[0]?.session_id).toBe(sessionId)
  })

  it('chains the audit entry into the verifiable hash chain', async () => {
    const userId = await seedUser()
    const { accessToken } = await createSession(userId, 'private')

    const response = await deleteAccountRoute(
      deleteRequest({ confirmation: 'KUSTUTA' }, accessToken),
    )
    expect(response.status).toBe(200)

    const verification = await verifyAuditChain(testDb.database)
    expect(verification.ok).toBe(true)
  })
})
