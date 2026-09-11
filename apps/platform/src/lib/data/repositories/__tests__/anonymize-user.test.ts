import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { verifyCredentialPassword } from '@/lib/auth/password'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import {
  anonymizeUser,
  createCoreRepositories,
  deletedEmailTombstone,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '@/lib/data/repositories'

/**
 * D7 (change portal-parity-gap-closure): `deleted` joins the user status
 * enum (migration 0029 CHECK rebuild) and the shared anonymization helper
 * wipes personal fields while the row, its bids, and its consents stay.
 */

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../drizzle',
)

function migrationStatements(fileName: string): string[] {
  const content = readFileSync(path.join(DRIZZLE_DIR, fileName), 'utf8')
  return content
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter((statement) => statement !== '')
}

function migrationFileNames(): string[] {
  return readdirSync(DRIZZLE_DIR)
    .filter((name) => /^\d{4}_.*\.sql$/.test(name))
    .sort()
}

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  process.env.ISIKUKOOD_ENCRYPTION_KEY =
    process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'anonymize-test-key'
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
})

afterEach(() => {
  testDb.close()
})

async function seedFullUser(id: string): Promise<void> {
  await repos.create({
    collection: 'users',
    data: {
      id,
      email: `${id}@example.com`,
      name: 'Mari Maasikas',
      phone: '+372 555 0001',
      isikukood: '38702019999',
    },
  })
  // The credential columns are written by the seed/auth paths, not by the
  // repository create surface; set them directly.
  await repos.update({
    collection: 'users',
    id,
    data: { passwordHash: 'aa'.repeat(64), passwordSalt: 'bb'.repeat(32) },
  })
}

describe('deleted user status (migration 0029 CHECK)', () => {
  it('accepts status deleted through the repository update path', async () => {
    await seedFullUser('status-del')
    const updated = await repos.update({
      collection: 'users',
      id: 'status-del',
      data: { status: 'deleted' },
    })
    expect(updated.status).toBe('deleted')
  })

  it('preserves rows, accepts deleted, and still rejects unknown statuses', () => {
    const staged = new Database(':memory:')
    try {
      // Stage the world strictly before 0029; later migrations (if any
      // land) would assume this migration already ran.
      for (const fileName of migrationFileNames().filter((name) => name < '0029_')) {
        for (const statement of migrationStatements(fileName)) {
          staged.exec(statement)
        }
      }
      staged
        .prepare(
          `INSERT INTO users (id, email, name, status, created_at, updated_at)
           VALUES ('u1', 'u1@example.com', 'Mari', 'active', '2026-01-01', '2026-01-01')`,
        )
        .run()

      for (const statement of migrationStatements(
        migrationFileNames().find((name) => name.startsWith('0029_')) ?? '',
      )) {
        staged.exec(statement)
      }

      const row = staged
        .prepare(`SELECT email, status FROM users WHERE id = 'u1'`)
        .get() as { email: string; status: string }
      expect(row).toMatchObject({ email: 'u1@example.com', status: 'active' })

      staged
        .prepare(`UPDATE users SET status = 'deleted' WHERE id = 'u1'`)
        .run()
      expect(
        (staged.prepare(`SELECT status FROM users WHERE id = 'u1'`).get() as { status: string })
          .status,
      ).toBe('deleted')

      expect(() =>
        staged.prepare(`UPDATE users SET status = 'bogus' WHERE id = 'u1'`).run(),
      ).toThrow()

      // The email unique index must have been recreated with the rebuild.
      expect(() =>
        staged
          .prepare(
            `INSERT INTO users (id, email, status, created_at, updated_at)
             VALUES ('u2', 'u1@example.com', 'active', '2026-01-01', '2026-01-01')`,
          )
          .run(),
      ).toThrow()
    } finally {
      staged.close()
    }
  })
})

describe('anonymizeUser helper', () => {
  it('wipes personal fields, tombstones the email, keeps the row and its bids', async () => {
    await seedFullUser('victim-1')
    await repos.create({
      collection: 'profile',
      data: {
        type: 'private',
        userId: 'victim-1',
        displayName: 'Mari Maasikas',
        phone: '+372 555 0001',
      },
    })
    await repos.create({
      collection: 'auctions',
      data: {
        id: 'auction-keep',
        title: 'Auction auction-keep',
        slug: 'slug-auction-keep',
        objectType: 'raieoigus',
        minBidCents: 10_000,
      },
    })
    await repos.create({
      collection: 'bids',
      data: {
        id: 'bid-keep',
        auction: 'auction-keep',
        user: 'victim-1',
        amountCents: 5_000,
        type: 'open',
        source: 'manual',
        status: 'leading',
      },
    })

    await anonymizeUser(testDb.database, 'victim-1')

    const user = (await repos.findByID({ collection: 'users', id: 'victim-1' })) as Record<
      string,
      unknown
    > | null
    expect(user).not.toBeNull()
    expect(user?.email).toBe(deletedEmailTombstone('victim-1'))
    expect(user?.status).toBe('deleted')
    expect(user?.name).toBeNull()
    expect(user?.phone).toBeNull()
    expect(user?.isikukoodEncrypted).toBeNull()
    expect(user?.isikukoodIv).toBeNull()
    expect(user?.isikukoodAuthTag).toBeNull()
    expect(user?.isikukoodHash).toBeNull()
    expect(user?.passwordHash).toBeNull()
    expect(user?.passwordSalt).toBeNull()

    const profile = await repos.find({ collection: 'profile', where: { user: { equals: 'victim-1' } } })
    expect(profile.docs).toHaveLength(1)
    const wipedProfile = profile.docs[0] as Record<string, unknown>
    expect(wipedProfile.displayName).toBeNull()
    expect(wipedProfile.phone).toBeNull()
    expect(wipedProfile.companyName).toBeNull()
    expect(wipedProfile.companyRegCode).toBeNull()

    // Bid integrity: append-only rows must survive with their reference.
    const bids = await repos.find({ collection: 'bids', where: { user: { equals: 'victim-1' } } })
    expect(bids.docs).toHaveLength(1)
    expect(bids.docs[0]?.id).toBe('bid-keep')
  })

  it('leaves a deleted account unable to authenticate', async () => {
    await seedFullUser('victim-2')
    const before = (await repos.findByID({ collection: 'users', id: 'victim-2' })) as Record<
      string,
      unknown
    >
    expect(before.isikukoodHash).not.toBeNull()

    await anonymizeUser(testDb.database, 'victim-2')

    const user = (await repos.findByID({ collection: 'users', id: 'victim-2' })) as Record<
      string,
      unknown
    > | null
    // Password login: verifyCredentialPassword fails on null hash/salt —
    // the exact call the login route makes before issuing a session.
    expect(
      verifyCredentialPassword(
        'correct-horse',
        (user?.passwordHash as string | null) ?? null,
        (user?.passwordSalt as string | null) ?? null,
      ),
    ).toBe(false)
    // eID login resolves users by isikukood hash; the hash is gone, so the
    // lookup finds no row.
    expect(user?.isikukoodHash).toBeNull()
  })
})
