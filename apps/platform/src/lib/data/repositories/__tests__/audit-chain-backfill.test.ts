import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '../../__tests__/sqlite'
import { hashAuditEntry, verifyChainRows, type AuditChainRow } from '../audit-chain'

/**
 * scripts/backfill-audit-chain.ts is CLI-only (its plan loop is not
 * exported), so these tests replicate its minimal wiring over the same
 * exported primitives the script uses: hashAuditEntry chaining in rowid ASC
 * order from the last already-chained row, then verifyChainRows over the
 * stored rows. The fixture shape mirrors the script's SELECT columns.
 */

interface FixtureRow {
  id: string
  action: string
  after: string | null
  createdAt: string
  updatedAt: string
}

const FIXTURE_ROWS: readonly FixtureRow[] = [
  {
    id: 'entry-1',
    action: 'user.login',
    after: '{"ok":true}',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'entry-2',
    action: 'auction.publish',
    after: '{"auctionId":"a-1"}',
    createdAt: '2026-09-01T09:05:00.000Z',
    updatedAt: '2026-09-01T09:05:00.000Z',
  },
  {
    id: 'entry-3',
    action: 'bid_admit',
    after: null,
    createdAt: '2026-09-01T09:10:00.000Z',
    updatedAt: '2026-09-01T09:10:00.000Z',
  },
]

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

const SELECT_CHAIN_SQL =
  'SELECT id, actor_id, action, entity_type, entity_id, "before", "after", ' +
  'created_at, updated_at, prev_hash, hash FROM audit_entries ORDER BY rowid'

function readChainRows(db: SqliteTestDb): AuditChainRow[] {
  const rows = db.raw.prepare(SELECT_CHAIN_SQL).all() as Record<string, unknown>[]
  return rows.map((raw) => ({
    id: String(raw.id),
    actorId: (raw.actor_id as string | null) ?? null,
    action: String(raw.action),
    entityType: (raw.entity_type as string | null) ?? null,
    entityId: (raw.entity_id as string | null) ?? null,
    before: (raw.before as string | null) ?? null,
    after: (raw.after as string | null) ?? null,
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
    prevHash: (raw.prev_hash as string | null) ?? null,
    hash: (raw.hash as string | null) ?? null,
  }))
}

function seedFixture(db: SqliteTestDb, rows: readonly FixtureRow[]): void {
  const statement = db.raw.prepare(
    'INSERT INTO audit_entries (id, action, "after", created_at, updated_at) ' +
      'VALUES (?, ?, ?, ?, ?)',
  )
  for (const row of rows) {
    statement.run(row.id, row.action, row.after, row.createdAt, row.updatedAt)
  }
}

function fixtureIdAt(index: number): string {
  const id = FIXTURE_ROWS[index]?.id
  if (id === undefined) {
    throw new Error(`no fixture row at index ${String(index)}`)
  }
  return id
}

interface BackfillUpdate {
  id: string
  prevHash: string | null
  hash: string
}

async function backfillUnchainedRows(db: SqliteTestDb): Promise<BackfillUpdate[]> {
  const updates: BackfillUpdate[] = []
  let head: string | null = null
  for (const row of readChainRows(db)) {
    if (row.hash !== null) {
      head = row.hash
      continue
    }
    const hash = await hashAuditEntry(row, head)
    updates.push({ id: row.id, prevHash: head, hash })
    head = hash
  }
  const statement = db.raw.prepare(
    'UPDATE audit_entries SET prev_hash = ?, hash = ? ' +
      'WHERE id = ? AND prev_hash IS NULL AND hash IS NULL',
  )
  for (const update of updates) {
    statement.run(update.prevHash, update.hash, update.id)
  }
  return updates
}

describe('audit chain backfill determinism', () => {
  it('chains every unchained fixture row so the stored chain verifies OK', async () => {
    seedFixture(testDb, FIXTURE_ROWS)

    const updates = await backfillUnchainedRows(testDb)

    expect(updates.map((update) => update.id)).toEqual(['entry-1', 'entry-2', 'entry-3'])
    expect(updates[0]?.prevHash).toBeNull()
    expect(updates[1]?.prevHash).toBe(updates[0]?.hash)
    expect(updates[2]?.prevHash).toBe(updates[1]?.hash)

    const verification = await verifyChainRows(readChainRows(testDb))
    expect(verification).toEqual({
      ok: true,
      checked: FIXTURE_ROWS.length,
      total: FIXTURE_ROWS.length,
      problem: null,
    })
  })

  it('yields identical hashes when the same fixture is backfilled twice', async () => {
    seedFixture(testDb, FIXTURE_ROWS)
    const secondDb = createSqliteTestDb()
    try {
      seedFixture(secondDb, FIXTURE_ROWS)

      const firstRun = await backfillUnchainedRows(testDb)
      const secondRun = await backfillUnchainedRows(secondDb)

      expect(secondRun).toEqual(firstRun)
      expect(firstRun).toHaveLength(FIXTURE_ROWS.length)
      expect(new Set(firstRun.map((update) => update.hash)).size).toBe(FIXTURE_ROWS.length)

      const secondVerification = await verifyChainRows(readChainRows(secondDb))
      expect(secondVerification.ok).toBe(true)
    } finally {
      secondDb.close()
    }
  })

  it('rewrites nothing when every row is already chained', async () => {
    seedFixture(testDb, FIXTURE_ROWS)
    const firstRun = await backfillUnchainedRows(testDb)
    const chainedBefore = readChainRows(testDb)

    const secondRun = await backfillUnchainedRows(testDb)

    expect(secondRun).toEqual([])
    expect(readChainRows(testDb)).toEqual(chainedBefore)
    expect(firstRun).toHaveLength(FIXTURE_ROWS.length)
  })

  it('continues an interrupted run from the last chained row with identical hashes', async () => {
    seedFixture(testDb, FIXTURE_ROWS)
    const fullRun = await backfillUnchainedRows(testDb)

    // Simulate a partial run: only the first row stayed chained.
    const reset = testDb.raw.prepare(
      'UPDATE audit_entries SET prev_hash = NULL, hash = NULL WHERE id != ?',
    )
    reset.run(fixtureIdAt(0))

    const resumedRun = await backfillUnchainedRows(testDb)

    expect(resumedRun.map((update) => update.id)).toEqual(['entry-2', 'entry-3'])
    expect(resumedRun).toEqual(fullRun.slice(1))
    expect(resumedRun[0]?.prevHash).toBe(fullRun[0]?.hash)

    const verification = await verifyChainRows(readChainRows(testDb))
    expect(verification.ok).toBe(true)
  })
})
