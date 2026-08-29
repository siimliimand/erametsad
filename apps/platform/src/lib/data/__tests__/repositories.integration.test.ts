import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createSessionRecord,
  findSessionByAccessToken,
  getUserSession,
  listUserSessions,
  purgeExpiredSessions,
  revokeSession,
  revokeUserSessions,
  updateUserProfileId,
} from '../../auth/session'
import { setD1ForTests } from '../../db'
import { publicContext, userContext, type GuardContext } from '../guards'
import {
  GuardAccessError,
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../repositories'
import type { auctionStatuses, userRoles, userStatuses } from '../schema'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from './sqlite'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'

type Role = (typeof userRoles)[number]
type UserStatus = (typeof userStatuses)[number]
type AuctionStatus = (typeof auctionStatuses)[number]

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
})

afterEach(() => {
  setD1ForTests(null)
  testDb.close()
})

function guarded(context: GuardContext): CoreRepositories {
  return createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
    guardContext: context,
  })
}

async function seedUser(
  id: string,
  data: {
    email?: string
    role?: Role
    status?: UserStatus
    phone?: string | null
    isikukood?: string
  } = {},
): Promise<void> {
  await repos.create({
    collection: 'users',
    data: {
      id,
      email: data.email ?? `${id}@example.com`,
      ...(data.role !== undefined ? { role: data.role } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.phone !== undefined ? { phone: data.phone } : {}),
      ...(data.isikukood !== undefined ? { isikukood: data.isikukood } : {}),
    },
  })
}

async function seedAuction(
  id: string,
  data: { status?: AuctionStatus; specialist?: string | null } = {},
): Promise<void> {
  await repos.create({
    collection: 'auctions',
    data: {
      id,
      title: `Auction ${id}`,
      slug: `slug-${id}`,
      objectType: 'raieoigus',
      minBidCents: 10_000,
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.specialist !== undefined ? { specialist: data.specialist } : {}),
    },
  })
}

interface SeedBid {
  auction: string
  user: string
  amountCents: number
  status?: string
  ipHash?: string | null
}

async function seedBid(id: string, data: SeedBid): Promise<void> {
  await repos.create({
    collection: 'bids',
    data: {
      id,
      auction: data.auction,
      user: data.user,
      amountCents: data.amountCents,
      type: 'open',
      source: 'manual',
      status: data.status ?? 'leading',
      ...(data.ipHash !== undefined ? { ipHash: data.ipHash } : {}),
    },
  })
}

describe('repository find operators against SQLite', () => {
  beforeEach(async () => {
    await seedAuction('auction-1')
    await seedUser('bidder-1')
    await seedUser('bidder-2')
    await seedBid('bid-low', { auction: 'auction-1', user: 'bidder-1', amountCents: 1_000 })
    await seedBid('bid-mid', { auction: 'auction-1', user: 'bidder-2', amountCents: 2_000, ipHash: 'hash-2' })
    await seedBid('bid-high', { auction: 'auction-1', user: 'bidder-1', amountCents: 3_000, status: 'outbid' })
  })

  async function findIds(where: Record<string, unknown>): Promise<string[]> {
    const result = await repos.find({ collection: 'bids', where: where as never, sort: 'amountCents' })
    return result.docs.map((doc) => doc.id)
  }

  it('equals matches one value', async () => {
    expect(await findIds({ amountCents: { equals: 2_000 } })).toEqual(['bid-mid'])
  })

  it('not_equals excludes one value', async () => {
    expect(await findIds({ amountCents: { not_equals: 2_000 } })).toEqual(['bid-low', 'bid-high'])
  })

  it('exists checks null and not-null', async () => {
    expect(await findIds({ ipHash: { exists: true } })).toEqual(['bid-mid'])
    expect(await findIds({ ipHash: { exists: false } })).toEqual(['bid-low', 'bid-high'])
  })

  it('in matches any listed value and empty in matches nothing', async () => {
    expect(await findIds({ amountCents: { in: [1_000, 3_000] } })).toEqual(['bid-low', 'bid-high'])
    expect(await findIds({ amountCents: { in: [] } })).toEqual([])
  })

  it('less_than_equal bounds the range inclusively', async () => {
    expect(await findIds({ amountCents: { less_than_equal: 2_000 } })).toEqual(['bid-low', 'bid-mid'])
  })

  it('and narrows across fields, including the auction alias', async () => {
    expect(
      await findIds({
        and: [{ auction: { equals: 'auction-1' } }, { amountCents: { equals: 3_000 } }],
      }),
    ).toEqual(['bid-high'])
  })

  it('or widens across conditions', async () => {
    expect(
      await findIds({
        or: [{ amountCents: { equals: 1_000 } }, { status: { equals: 'leading' } }],
      }),
    ).toEqual(['bid-low', 'bid-mid'])
  })
})

describe('repository sort against SQLite', () => {
  beforeEach(async () => {
    await seedAuction('auction-1')
    await seedUser('bidder-1')
    await seedUser('bidder-2')
    await seedBid('bid-b', { auction: 'auction-1', user: 'bidder-2', amountCents: 2_000 })
    await seedBid('bid-a', { auction: 'auction-1', user: 'bidder-1', amountCents: 3_000 })
  })

  it('sorts ascending by column and descending with a leading dash', async () => {
    const asc = await repos.find({ collection: 'bids', sort: 'amountCents' })
    expect(asc.docs.map((doc) => doc.id)).toEqual(['bid-b', 'bid-a'])
    const desc = await repos.find({ collection: 'bids', sort: '-amountCents' })
    expect(desc.docs.map((doc) => doc.id)).toEqual(['bid-a', 'bid-b'])
  })

  it('resolves aliased public fields for sorting', async () => {
    const byUser = await repos.find({ collection: 'bids', sort: 'user' })
    expect(byUser.docs.map((doc) => doc.id)).toEqual(['bid-a', 'bid-b'])
    const byAuction = await repos.find({ collection: 'bids', sort: '-auction' })
    expect(byAuction.docs).toHaveLength(2)
  })
})

describe('money boundary round-trip', () => {
  it('stores the EUR field as integer cents and decodes it back', async () => {
    const created = await repos.create({
      collection: 'statistics-snapshots',
      data: { date: '2026-01-01', objectType: 'raieoigus', count: 2, eur: 1234.56 },
    })
    expect(created.eur).toBe(1234.56)
    expect('eurCents' in created).toBe(false)

    const raw = testDb.raw
      .prepare('select eur_cents from statistics_snapshots where id = ?')
      .get(created.id) as { eur_cents: number }
    expect(raw.eur_cents).toBe(123_456)

    const read = await repos.findByID({ collection: 'statistics-snapshots', id: created.id })
    expect(read?.eur).toBe(1234.56)
    expect('eurCents' in (read ?? {})).toBe(false)
  })
})

describe('TEXT-JSON codecs', () => {
  it('encodes json and array fields to TEXT and decodes them on read', async () => {
    const coordinates = { lat: 59.4, lng: 24.7 }
    const species = ['kuusk', 'mänd']
    const deadlines = { visit: '2026-02-01' }
    const created = await repos.create({
      collection: 'auctions',
      data: {
        title: 'JSON auction',
        slug: 'json-auction',
        objectType: 'raieoigus',
        minBidCents: 1_000,
        coordinates,
        species,
        deadlines,
      },
    })
    expect(created.coordinates).toEqual(coordinates)
    expect(created.species).toEqual(species)
    expect(created.deadlines).toEqual(deadlines)

    const raw = testDb.raw
      .prepare('select coordinates, species, deadlines from auctions where id = ?')
      .get(created.id) as { coordinates: string; species: string; deadlines: string }
    expect(raw.coordinates).toBe(JSON.stringify(coordinates))
    expect(raw.species).toBe(JSON.stringify(species))
    expect(raw.deadlines).toBe(JSON.stringify(deadlines))

    const read = await repos.findByID({ collection: 'auctions', id: created.id })
    expect(read?.coordinates).toEqual(coordinates)
    expect(read?.species).toEqual(species)
    expect(read?.deadlines).toEqual(deadlines)
  })

  it('round-trips the virtual isikukood through the encrypt/decrypt hook', async () => {
    await seedUser('user-ik', { isikukood: '38001010000' })
    const raw = testDb.raw
      .prepare('select isikukood_encrypted, isikukood_hash from users where id = ?')
      .get('user-ik') as { isikukood_encrypted: string; isikukood_hash: string }
    expect(raw.isikukood_encrypted).not.toContain('38001010000')
    expect(raw.isikukood_hash).toMatch(/^[0-9a-f]{64}$/)

    const read = await repos.findByID({ collection: 'users', id: 'user-ik' })
    expect(read?.isikukood).toBe('38001010000')
  })
})

describe('guard enforcement with a user context', () => {
  beforeEach(async () => {
    await seedUser('admin-1', { role: 'admin' })
    await seedUser('user-1')
    await seedUser('user-2')
    await seedAuction('auction-pub', { status: 'active', specialist: 'user-1' })
    await seedAuction('auction-draft', { status: 'draft', specialist: 'user-1' })
    await seedBid('bid-own', { auction: 'auction-pub', user: 'user-1', amountCents: 1_000 })
    await seedBid('bid-other', { auction: 'auction-pub', user: 'user-2', amountCents: 2_000 })
  })

  it('filters own-record reads to the caller rows', async () => {
    const result = await guarded(userContext('user-1', 'private')).find({ collection: 'bids' })
    expect(result.docs.map((doc) => doc.id)).toEqual(['bid-own'])
  })

  it('denies admin-only reads to non-admin callers', async () => {
    await expect(
      guarded(userContext('user-1', 'private')).find({ collection: 'users' }),
    ).rejects.toBeInstanceOf(GuardAccessError)
  })

  it('allows admin-only reads for an admin caller', async () => {
    const result = await guarded(userContext('admin-1', 'admin')).find({ collection: 'users' })
    expect(result.docs.length).toBeGreaterThanOrEqual(3)
  })

  it('filters published reads for a public caller to active auctions', async () => {
    const result = await guarded(publicContext).find({ collection: 'auctions' })
    expect(result.docs.map((doc) => doc.id)).toEqual(['auction-pub'])
  })

  it('widens the published filter for the owning specialist', async () => {
    const result = await guarded(userContext('user-1', 'specialist')).find({
      collection: 'auctions',
      sort: 'id',
    })
    expect(result.docs.map((doc) => doc.id)).toEqual(['auction-draft', 'auction-pub'])
  })

  it('enforces deny rules even for the owning user', async () => {
    const userRepos = guarded(userContext('user-1', 'private'))
    await expect(userRepos.delete({ collection: 'bids', id: 'bid-own' })).rejects.toBeInstanceOf(
      GuardAccessError,
    )
    await expect(
      userRepos.create({ collection: 'notifications', data: { event: 'auction.won' } as never }),
    ).rejects.toBeInstanceOf(GuardAccessError)
  })
})

describe('session store CRUD over the sessions table', () => {
  beforeEach(async () => {
    setD1ForTests(testDb.d1)
    await seedUser('session-user')
  })

  function sha256(value: string): string {
    return createHash('sha256').update(value).digest('hex')
  }

  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()

  async function createSession(
    sessionId: string,
    options: { expiresAt?: string; profileId?: string } = {},
  ): Promise<void> {
    await createSessionRecord({
      sessionId,
      userId: 'session-user',
      role: 'private',
      ...(options.profileId !== undefined ? { profileId: options.profileId } : {}),
      tokenFamily: `family-${sessionId}`,
      accessToken: `access-${sessionId}`,
      refreshToken: `refresh-${sessionId}`,
      expiresAt: options.expiresAt ?? future,
    })
  }

  it('creates and reads a session row', async () => {
    await createSession('session-1')

    const record = await getUserSession('session-1')
    expect(record).toMatchObject({ userId: 'session-user', role: 'private', active: true })

    const byToken = await findSessionByAccessToken(sha256('access-session-1'))
    expect(byToken?.id).toBe('session-1')

    const listed = await listUserSessions('session-user', 'session-1')
    expect(listed).toEqual([
      { sessionId: 'session-1', createdAt: expect.any(Date) as Date, current: true },
    ])
  })

  it('updates profile ids and revocation state', async () => {
    await createSession('session-2')

    expect(await updateUserProfileId('session-user', 'profile-9')).toBe(true)
    const row = testDb.raw
      .prepare('select profile_id from sessions where id = ?')
      .get('session-2') as { profile_id: string | null }
    expect(row.profile_id).toBe('profile-9')

    await revokeSession('session-2')
    expect(await getUserSession('session-2')).toBeNull()

    await createSession('session-3')
    await revokeUserSessions('session-user')
    expect(await getUserSession('session-3')).toBeNull()
  })

  it('purges only expired sessions', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    await createSession('session-live')
    await createSession('session-expired', { expiresAt: past })

    expect(await purgeExpiredSessions()).toBe(1)
    const remaining = testDb.raw.prepare('select id from sessions').all() as { id: string }[]
    expect(remaining.map((row) => row.id)).toEqual(['session-live'])
  })
})

describe('contract-template deactivation invariant', () => {
  async function createTemplate(
    id: string,
    data: { type: 'framework' | 'auction'; active?: boolean },
  ): Promise<void> {
    await repos.create({
      collection: 'contract-templates',
      data: {
        id,
        name: `Template ${id}`,
        type: data.type,
        version: `v1-${id}`,
        ...(data.active !== undefined ? { active: data.active } : {}),
      },
    })
  }

  async function activeIds(type: string): Promise<string[]> {
    const result = await repos.find({
      collection: 'contract-templates',
      where: { and: [{ type: { equals: type } }, { active: { equals: true } }] },
      sort: 'id',
    })
    return result.docs.map((doc) => doc.id)
  }

  it('keeps exactly one active template per type across creates and updates', async () => {
    await createTemplate('tpl-a', { type: 'framework' })
    expect(await activeIds('framework')).toEqual(['tpl-a'])

    await createTemplate('tpl-b', { type: 'framework' })
    expect(await activeIds('framework')).toEqual(['tpl-b'])

    await createTemplate('tpl-c', { type: 'auction' })
    expect(await activeIds('framework')).toEqual(['tpl-b'])
    expect(await activeIds('auction')).toEqual(['tpl-c'])

    await repos.update({ collection: 'contract-templates', id: 'tpl-a', data: { active: true } })
    expect(await activeIds('framework')).toEqual(['tpl-a'])
    expect(await activeIds('auction')).toEqual(['tpl-c'])

    await createTemplate('tpl-d', { type: 'framework', active: false })
    expect(await activeIds('framework')).toEqual(['tpl-a'])
  })
})
