import Database from 'better-sqlite3'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { createCoreRepositories, nodeIsikukoodCodec, type CoreRepositories } from '@/lib/data/repositories'

/**
 * D1 (change portal-parity-gap-closure): the indexed `cut_deadline_year`
 * column on `auctions`, backfilled by migration 0028 from the deadlines
 * JSON (tolerant key set loggingDeadline/logging/raie, as the lot dossier
 * reads it) and recomputed on the repository write path.
 */

const NOW = '2026-01-01T00:00:00.000Z'

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
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
})

afterEach(() => {
  testDb.close()
})

async function createAuction(
  id: string,
  data: { deadlines?: unknown; cutDeadlineYear?: number | null } = {},
) {
  return repos.create({
    collection: 'auctions',
    data: {
      id,
      title: `Auction ${id}`,
      slug: `slug-${id}`,
      objectType: 'raieoigus',
      minBidCents: 10_000,
      ...(data.deadlines !== undefined ? { deadlines: data.deadlines } : {}),
      ...(data.cutDeadlineYear !== undefined ? { cutDeadlineYear: data.cutDeadlineYear } : {}),
    },
  })
}

describe('migration 0028 cut_deadline_year backfill', () => {
  it('backfills the year from the tolerant deadlines keys and covers the column with an index', () => {
    const staged = new Database(':memory:')
    try {
      // Stage the world strictly before 0028: applying later migrations
      // (if any land) would assume this migration already ran.
      const before = migrationFileNames().filter((name) => name < '0028_')
      for (const fileName of before) {
        for (const statement of migrationStatements(fileName)) {
          staged.exec(statement)
        }
      }

      const insertLegacy = staged.prepare(
        `INSERT INTO auctions (id, title, slug, object_type, min_bid_cents, deadlines, created_at, updated_at)
         VALUES (?, 'T', ?, 'raieoigus', 1000, ?, ?, ?)`,
      )
      insertLegacy.run('a1', 'a1', JSON.stringify({ loggingDeadline: '2031-12-31' }), NOW, NOW)
      insertLegacy.run('a2', 'a2', JSON.stringify({ logging: '2030-06-15' }), NOW, NOW)
      insertLegacy.run('a3', 'a3', JSON.stringify({ raie: '2029-01-01' }), NOW, NOW)
      insertLegacy.run('a4', 'a4', JSON.stringify({ loggingDeadline: '' }), NOW, NOW)
      insertLegacy.run('a5', 'a5', 'not-json', NOW, NOW)
      insertLegacy.run('a6', 'a6', null, NOW, NOW)
      insertLegacy.run('a7', 'a7', JSON.stringify({ loggingDeadline: '31.12.2031' }), NOW, NOW)
      insertLegacy.run('a8', 'a8', JSON.stringify({ loggingDeadline: '   ' }), NOW, NOW)

      for (const statement of migrationStatements(
        migrationFileNames().find((name) => name.startsWith('0028_')) ?? '',
      )) {
        staged.exec(statement)
      }

      const rows = staged
        .prepare(`SELECT id, cut_deadline_year, deadlines FROM auctions ORDER BY id`)
        .all() as { id: string; cut_deadline_year: number | null; deadlines: string | null }[]
      const byId = new Map(rows.map((row) => [row.id, row]))
      expect(byId.get('a1')).toMatchObject({ cut_deadline_year: 2031 })
      expect(byId.get('a2')).toMatchObject({ cut_deadline_year: 2030 })
      expect(byId.get('a3')).toMatchObject({ cut_deadline_year: 2029 })
      expect(byId.get('a4')).toMatchObject({ cut_deadline_year: null })
      expect(byId.get('a5')).toMatchObject({ cut_deadline_year: null })
      expect(byId.get('a6')).toMatchObject({ cut_deadline_year: null })
      expect(byId.get('a7')).toMatchObject({ cut_deadline_year: null })
      expect(byId.get('a8')).toMatchObject({ cut_deadline_year: null })
      // The backfill reads the JSON; it never rewrites it.
      expect(JSON.parse(byId.get('a1')?.deadlines ?? '{}')).toMatchObject({
        loggingDeadline: '2031-12-31',
      })

      const indexes = staged
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'auctions'`)
        .all() as { name: string }[]
      expect(indexes.map((index) => index.name)).toContain('auctions_cut_deadline_year_idx')
    } finally {
      staged.close()
    }
  })
})

describe('cut_deadline_year repository write-path sync', () => {
  it('computes the year on create from the loggingDeadline key', async () => {
    const created = await createAuction('cut-1', {
      deadlines: { storageLocationApproval: 'buyer', loggingDeadline: '2031-12-31' },
    })
    expect(created.cutDeadlineYear).toBe(2031)

    const stored = await repos.findByID({ collection: 'auctions', id: created.id })
    expect(stored?.cutDeadlineYear).toBe(2031)
  })

  it('falls back to the logging and raie keys in dossier order', async () => {
    const byLogging = await createAuction('cut-logging', { deadlines: { logging: '2030-06-15' } })
    expect(byLogging.cutDeadlineYear).toBe(2030)
    const byRaie = await createAuction('cut-raie', { deadlines: { raie: '2029-01-01' } })
    expect(byRaie.cutDeadlineYear).toBe(2029)
  })

  it('stores null when deadlines are missing, blank, or hold no parseable date', async () => {
    const noDeadlines = await createAuction('cut-none')
    expect(noDeadlines.cutDeadlineYear).toBeNull()
    const emptyDeadlines = await createAuction('cut-empty', { deadlines: {} })
    expect(emptyDeadlines.cutDeadlineYear).toBeNull()
    const unparseable = await createAuction('cut-bad', {
      deadlines: { loggingDeadline: '31.12.2031' },
    })
    expect(unparseable.cutDeadlineYear).toBeNull()
  })

  it('recomputes the year in the same write when an admin saves a new deadline', async () => {
    const created = await createAuction('cut-2', {
      deadlines: { loggingDeadline: '2031-12-31' },
    })
    expect(created.cutDeadlineYear).toBe(2031)

    const updated = await repos.update({
      collection: 'auctions',
      id: created.id,
      data: { deadlines: { logging: '2030-06-15' } },
    })
    expect(updated.cutDeadlineYear).toBe(2030)

    // Clearing the date must clear the derived column, not leave a stale year.
    const cleared = await repos.update({
      collection: 'auctions',
      id: created.id,
      data: { deadlines: { storageLocationApproval: 'buyer' } },
    })
    expect(cleared.cutDeadlineYear).toBeNull()
  })

  it('leaves the stored year untouched when a write does not carry deadlines', async () => {
    const created = await createAuction('cut-3', {
      deadlines: { loggingDeadline: '2031-12-31' },
    })

    const updated = await repos.update({
      collection: 'auctions',
      id: created.id,
      data: { title: 'Renamed' },
    })
    expect(updated.cutDeadlineYear).toBe(2031)
  })

  it('overrides an explicitly passed cutDeadlineYear — the column is derived', async () => {
    const created = await createAuction('cut-4', {
      deadlines: { loggingDeadline: '2031-12-31' },
      cutDeadlineYear: 1999,
    })
    expect(created.cutDeadlineYear).toBe(2031)
  })
})
