import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '../../__tests__/sqlite'
import { hashAuditEntry, verifyAuditChain } from '../audit-chain'
import { createCoreRepositories, nodeIsikukoodCodec, type CoreRepositories } from '../index'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'

/**
 * Migration 0020 added the era columns (reason, session_id, ip_hash,
 * user_agent) as nullable TEXT. These tests pin the era tolerance of the
 * hash chain: rows written before the migration carry no era values and
 * their stored hashes cover the original 10-field canonical array, while
 * rows written after (with any era value) hash over the 14-field array.
 * A chain mixing both shapes must verify end to end.
 */

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
  })
})

afterEach(() => {
  testDb.close()
})

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

interface LegacySeed {
  id: string
  action: string
  after: string | null
}

/** Inserts a row with exactly the pre-migration columns and no chain values. */
function seedLegacyRow(seed: LegacySeed): void {
  testDb.raw
    .prepare(
      'INSERT INTO audit_entries (id, action, "after", created_at, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?)',
    )
    .run(
      seed.id,
      seed.action,
      seed.after,
      '2026-09-01T09:00:00.000Z',
      '2026-09-01T09:00:00.000Z',
    )
}

interface RawLegacyRow {
  id: string
  actor_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  before: string | null
  after: string | null
  created_at: string
  updated_at: string
  prev_hash: string | null
  hash: string | null
}

/**
 * Chains every unchained row in rowid order, the way the backfill script
 * does. Legacy rows are read without the era columns, mirroring the
 * pre-migration reader shape.
 */
async function chainUnchainedRows(): Promise<void> {
  const rows = testDb.raw
    .prepare(
      'SELECT id, actor_id, action, entity_type, entity_id, "before", "after", ' +
        'created_at, updated_at, prev_hash, hash FROM audit_entries ORDER BY rowid',
    )
    .all() as RawLegacyRow[]
  const update = testDb.raw.prepare(
    'UPDATE audit_entries SET prev_hash = ?, hash = ? WHERE id = ?',
  )
  let head: string | null = null
  for (const row of rows) {
    if (row.hash !== null) {
      head = row.hash
      continue
    }
    const hash = await hashAuditEntry(
      {
        id: row.id,
        actorId: row.actor_id,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id,
        before: row.before,
        after: row.after,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        prevHash: row.prev_hash,
        hash: row.hash,
      },
      head,
    )
    update.run(head, hash, row.id)
    head = hash
  }
}

interface EraChainColumns {
  prev_hash: string | null
  hash: string | null
  reason: string | null
  session_id: string | null
  ip_hash: string | null
  user_agent: string | null
}

function readEraRow(id: string): EraChainColumns {
  const row = testDb.raw
    .prepare(
      'SELECT prev_hash, hash, reason, session_id, ip_hash, user_agent ' +
        'FROM audit_entries WHERE id = ?',
    )
    .get(id) as EraChainColumns | undefined
  if (!row) {
    throw new Error(`no audit entry with id ${id}`)
  }
  return row
}

describe('mixed-era audit chain verification', () => {
  it('hashes a row without era values exactly as the pre-migration canonicalization', async () => {
    const row = {
      id: 'entry-legacy',
      actorId: 'user-1',
      action: 'settings.save',
      entityType: 'settings',
      entityId: 'global',
      before: '{"kmkr":"EE100"}',
      after: '{"kmkr":"EE101"}',
      createdAt: '2026-09-01T09:00:00.000Z',
      updatedAt: '2026-09-01T09:00:00.000Z',
    }
    // The exact 10-field formula used before migration 0020 existed.
    const legacyCanonical = JSON.stringify([
      row.id,
      row.actorId,
      row.action,
      row.entityType,
      row.entityId,
      row.before,
      row.after,
      row.createdAt,
      row.updatedAt,
      null,
    ])

    expect(await hashAuditEntry({ ...row, hash: null }, null)).toBe(
      await sha256Hex(legacyCanonical),
    )
  })

  it('verifies a chain of legacy row, new-era row, and legacy row', async () => {
    seedLegacyRow({ id: 'entry-l1', action: 'user.login', after: '{"ok":true}' })
    await chainUnchainedRows()
    const newEra = await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'settings.save',
        entityType: 'settings',
        entityId: 'global',
        after: { kmkr: 'EE101' },
        reason: 'KMKR number updated',
        sessionId: 'sess-123',
        ipHash: 'a'.repeat(64),
        userAgent: 'desktop-app',
      },
    })
    seedLegacyRow({ id: 'entry-l2', action: 'auction.publish', after: '{"auctionId":"a-1"}' })
    await chainUnchainedRows()

    const verification = await verifyAuditChain(testDb.database)
    expect(verification).toEqual({
      ok: true,
      checked: 3,
      total: 3,
      problem: null,
    })

    // The new-era row's era values reached the hash: recomputing with the
    // pre-migration 10-field formula must produce a different digest.
    const stored = readEraRow(newEra.id)
    expect(stored.hash).not.toBeNull()
    expect(stored.reason).toBe('KMKR number updated')
    const legacyRecompute = await hashAuditEntry(
      {
        id: newEra.id,
        actorId: null,
        action: 'settings.save',
        entityType: 'settings',
        entityId: 'global',
        before: null,
        after: JSON.stringify({ kmkr: 'EE101' }),
        createdAt: newEra.createdAt,
        updatedAt: newEra.updatedAt,
        prevHash: stored.prev_hash,
        hash: null,
      },
      stored.prev_hash,
    )
    expect(legacyRecompute).not.toBe(stored.hash)
  })

  it('verifies a new-era genesis followed by a legacy row', async () => {
    await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'settings.save',
        reason: 'Fee override',
        ipHash: 'b'.repeat(64),
      },
    })
    seedLegacyRow({ id: 'entry-l2', action: 'bid_admit', after: null })
    await chainUnchainedRows()

    const verification = await verifyAuditChain(testDb.database)
    expect(verification).toEqual({
      ok: true,
      checked: 2,
      total: 2,
      problem: null,
    })
  })

  it('verifies post-migration rows written without any era values', async () => {
    seedLegacyRow({ id: 'entry-l1', action: 'user.login', after: null })
    await chainUnchainedRows()
    await repos.create({
      collection: 'audit-entry',
      data: { action: 'auction.publish', entityType: 'auction', entityId: 'a-1' },
    })

    const verification = await verifyAuditChain(testDb.database)
    expect(verification).toEqual({
      ok: true,
      checked: 2,
      total: 2,
      problem: null,
    })
  })

  it('reports a hash mismatch when a new-era row reason is rewritten', async () => {
    const entry = await repos.create({
      collection: 'audit-entry',
      data: { action: 'settings.save', reason: 'original reason' },
    })
    testDb.raw
      .prepare('UPDATE audit_entries SET reason = ? WHERE id = ?')
      .run('forged reason', entry.id)

    const verification = await verifyAuditChain(testDb.database)
    expect(verification.ok).toBe(false)
    expect(verification.problem).toEqual({
      id: entry.id,
      index: 0,
      reason: 'hash_mismatch',
    })
  })

  it('reports a hash mismatch when era values are erased from a new-era row', async () => {
    const entry = await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'settings.save',
        reason: 'original reason',
        sessionId: 'sess-1',
      },
    })
    testDb.raw
      .prepare('UPDATE audit_entries SET reason = NULL, session_id = NULL WHERE id = ?')
      .run(entry.id)

    const verification = await verifyAuditChain(testDb.database)
    expect(verification.ok).toBe(false)
    expect(verification.problem).toEqual({
      id: entry.id,
      index: 0,
      reason: 'hash_mismatch',
    })
  })
})
