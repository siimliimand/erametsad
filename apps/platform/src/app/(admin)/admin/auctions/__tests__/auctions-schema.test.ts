import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { createCoreRepositories, nodeIsikukoodCodec, type CoreRepositories } from '@/lib/data/repositories'

/**
 * Task 5.1 schema additions on `auctions` (change admin-spec-gap-fixes):
 * migration 0018 promotes the lot-level area/volume scalars out of the
 * deadlines JSON into nullable `area_ha`/`volume_m3` REAL columns, and the
 * deadlines JSON keeps carrying the step-3 kooskõlastused/väljaveoteed codes.
 */

const NOW = '2026-01-01T00:00:00.000Z'

const DRIZZLE_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../../..',
  'drizzle',
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
    process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'auction-schema-test-key'
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
})

afterEach(() => {
  testDb.close()
})

describe('auctions area/volume columns (migration 0018)', () => {
  it('adds area_ha and volume_m3 as nullable real columns defaulting to null', () => {
    const columns = testDb.raw.prepare(`PRAGMA table_info('auctions')`).all() as {
      name: string
      type: string
      notnull: number
      dflt_value: string | null
    }[]
    const area = columns.find((column) => column.name === 'area_ha')
    const volume = columns.find((column) => column.name === 'volume_m3')
    expect(area).toMatchObject({ type: 'REAL', notnull: 0, dflt_value: null })
    expect(volume).toMatchObject({ type: 'REAL', notnull: 0, dflt_value: null })
  })

  it('round-trips area and volume through the repository create/update path', async () => {
    const created = await repos.create({
      collection: 'auctions',
      data: {
        title: 'Raieõigus Vormsi',
        slug: 'raieoigus-vormsi',
        objectType: 'raieoigus',
        minBidCents: 50_000,
        areaHa: 12.5,
        volumeM3: 300,
        deadlines: { storageLocationApproval: 'buyer', removalRoads: 'seller' },
      },
    })
    expect(created.areaHa).toBe(12.5)
    expect(created.volumeM3).toBe(300)

    const stored = await repos.findByID({ collection: 'auctions', id: created.id })
    expect(stored?.areaHa).toBe(12.5)
    expect(stored?.volumeM3).toBe(300)
    expect(stored?.deadlines).toMatchObject({
      storageLocationApproval: 'buyer',
      removalRoads: 'seller',
    })

    await repos.update({
      collection: 'auctions',
      id: created.id,
      data: {
        areaHa: 13.75,
        deadlines: { storageLocationApproval: 'approved', removalRoads: 'buyer' },
      },
    })
    const updated = await repos.findByID({ collection: 'auctions', id: created.id })
    expect(updated?.areaHa).toBe(13.75)
    expect(updated?.volumeM3).toBe(300)
    expect(updated?.deadlines).toMatchObject({
      storageLocationApproval: 'approved',
      removalRoads: 'buyer',
    })
  })

  it('leaves area and volume null when a lot has no measures', async () => {
    const created = await repos.create({
      collection: 'auctions',
      data: {
        title: 'Kinnistu Kuressaare',
        slug: 'kinnistu-kuressaare',
        objectType: 'kinnistu',
        type: 'sealed',
        minBidCents: 10_000,
      },
    })
    expect(created.areaHa).toBeNull()
    expect(created.volumeM3).toBeNull()
  })

  it('backfills area_ha/volume_m3 from legacy deadlines JSON without touching the JSON', () => {
    const staged = new Database(':memory:')
    try {
      for (const fileName of migrationFileNames().filter((name) => name < '0018_')) {
        for (const statement of migrationStatements(fileName)) {
          staged.exec(statement)
        }
      }

      const insertLegacy = staged.prepare(
        `INSERT INTO auctions (id, title, slug, object_type, min_bid_cents, deadlines, created_at, updated_at)
         VALUES (?, 'T', ?, 'raieoigus', 1000, ?, ?, ?)`,
      )
      insertLegacy.run('a1', 'a1', JSON.stringify({ areaHa: 3.5, volumeM3: 250.5, loggingDeadline: '2027-12-31' }), NOW, NOW)
      insertLegacy.run('a2', 'a2', JSON.stringify({ loggingDeadline: '2027-12-31' }), NOW, NOW)
      insertLegacy.run('a3', 'a3', 'not-json', NOW, NOW)
      insertLegacy.run('a4', 'a4', null, NOW, NOW)

      for (const statement of migrationStatements(
        migrationFileNames().find((name) => name.startsWith('0018_')) ?? '',
      )) {
        staged.exec(statement)
      }

      const rows = staged
        .prepare(`SELECT id, area_ha, volume_m3, deadlines FROM auctions ORDER BY id`)
        .all() as { id: string; area_ha: number | null; volume_m3: number | null; deadlines: string | null }[]
      expect(rows).toHaveLength(4)
      const byId = new Map(rows.map((row) => [row.id, row]))
      expect(byId.get('a1')).toMatchObject({ area_ha: 3.5, volume_m3: 250.5 })
      expect(JSON.parse(byId.get('a1')?.deadlines ?? '{}')).toMatchObject({
        areaHa: 3.5,
        volumeM3: 250.5,
        loggingDeadline: '2027-12-31',
      })
      expect(byId.get('a2')).toMatchObject({ area_ha: null, volume_m3: null })
      expect(byId.get('a3')).toMatchObject({ area_ha: null, volume_m3: null })
      expect(byId.get('a4')).toMatchObject({ area_ha: null, volume_m3: null })
    } finally {
      staged.close()
    }
  })
})
