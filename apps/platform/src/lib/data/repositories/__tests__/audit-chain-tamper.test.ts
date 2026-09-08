import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '../../__tests__/sqlite'
import {
  verifyAuditChain,
  verifyChainRows,
  type AuditChainBreakReason,
  type AuditChainRow,
  type AuditChainVerification,
} from '../audit-chain'
import { createCoreRepositories, nodeIsikukoodCodec, type CoreRepositories } from '../index'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'

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

interface AuditWrite {
  action: string
  entityId: string
  after: Record<string, unknown>
}

const WRITES: readonly AuditWrite[] = [
  { action: 'user.login', entityId: 'u-1', after: { step: 1 } },
  { action: 'auction.publish', entityId: 'a-1', after: { step: 2 } },
  { action: 'auction.schedule', entityId: 'a-1', after: { step: 3 } },
  { action: 'bid_admit', entityId: 'b-1', after: { step: 4 } },
]

let entryIds: string[] = []

async function writeChainedEntries(): Promise<void> {
  const ids: string[] = []
  for (const write of WRITES) {
    const entry = await repos.create({
      collection: 'audit-entry',
      data: { ...write },
    })
    ids.push(entry.id)
  }
  entryIds = ids
}

function idAt(index: number): string {
  const id = entryIds[index]
  if (id === undefined) {
    throw new Error(`no audit entry at index ${String(index)}`)
  }
  return id
}

type TamperedColumn = 'action' | 'before' | 'after' | 'prev_hash' | 'hash'

function tamper(id: string, column: TamperedColumn, value: string | null): void {
  testDb.raw
    .prepare(`UPDATE audit_entries SET "${column}" = ? WHERE id = ?`)
    .run(value, id)
}

function expectBreak(
  verification: AuditChainVerification,
  id: string,
  index: number,
  reason: AuditChainBreakReason,
): void {
  expect(verification.ok).toBe(false)
  expect(verification.problem).toEqual({ id, index, reason })
  expect(verification.checked).toBe(index)
  expect(verification.total).toBe(entryIds.length)
}

describe('verifyAuditChain tamper detection', () => {
  beforeEach(async () => {
    await writeChainedEntries()
  })

  it('reports ok for an intact chain', async () => {
    const verification = await verifyAuditChain(testDb.database)
    expect(verification).toEqual({
      ok: true,
      checked: WRITES.length,
      total: WRITES.length,
      problem: null,
    })
  })

  it('reports a hash mismatch when a mid-chain payload is rewritten', async () => {
    tamper(idAt(1), 'after', JSON.stringify({ step: 999 }))

    const verification = await verifyAuditChain(testDb.database)
    expectBreak(verification, idAt(1), 1, 'hash_mismatch')
  })

  it('reports a hash mismatch when a mid-chain action is rewritten', async () => {
    tamper(idAt(2), 'action', 'auction.cancel')

    const verification = await verifyAuditChain(testDb.database)
    expectBreak(verification, idAt(2), 2, 'hash_mismatch')
  })

  it('reports a hash mismatch when the last entry payload is rewritten', async () => {
    tamper(idAt(3), 'before', JSON.stringify({ smuggled: true }))

    const verification = await verifyAuditChain(testDb.database)
    expectBreak(verification, idAt(3), 3, 'hash_mismatch')
  })

  it('reports a prevHash mismatch when a mid-chain link is rewritten', async () => {
    tamper(idAt(2), 'prev_hash', 'f'.repeat(64))

    const verification = await verifyAuditChain(testDb.database)
    expectBreak(verification, idAt(2), 2, 'prev_hash_mismatch')
  })

  it('reports a missing hash when an entry was never chained', async () => {
    tamper(idAt(1), 'hash', null)

    const verification = await verifyAuditChain(testDb.database)
    expectBreak(verification, idAt(1), 1, 'missing_hash')
  })
})

describe('verifyChainRows pure verification', () => {
  it('reports ok for an empty chain', async () => {
    expect(await verifyChainRows([])).toEqual({
      ok: true,
      checked: 0,
      total: 0,
      problem: null,
    })
  })

  it('rejects a first row that already claims a prevHash', async () => {
    const row: AuditChainRow = {
      id: 'row-1',
      actorId: null,
      action: 'user.login',
      entityType: null,
      entityId: null,
      before: null,
      after: null,
      createdAt: '2026-09-01T09:00:00.000Z',
      updatedAt: '2026-09-01T09:00:00.000Z',
      prevHash: 'f'.repeat(64),
      hash: 'a'.repeat(64),
    }

    const verification = await verifyChainRows([row])
    expect(verification.ok).toBe(false)
    expect(verification.problem).toEqual({
      id: 'row-1',
      index: 0,
      reason: 'prev_hash_mismatch',
    })
  })
})
