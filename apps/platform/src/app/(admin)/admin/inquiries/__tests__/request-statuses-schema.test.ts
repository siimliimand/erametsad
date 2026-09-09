import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 8.4 schema change on `service_requests` (change
 * admin-spec-gap-fixes): migration 0022 widens the status CHECK to
 * teostatud and suletud while keeping the original two states.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertRequest(status: string): void {
  testDb.raw
    .prepare(
      `INSERT INTO service_requests (id, type, payload, status, consent_at, form_name, created_at, updated_at)
       VALUES ('r1', 'kava', '{}', ?, ?, 'metsamajanduskava', ?, ?)`,
    )
    .run(status, NOW, NOW, NOW)
}

describe('service request status CHECK (migration 0022)', () => {
  it.each(['new', 'routed', 'teostatud', 'suletud'])('accepts the %s status', (status) => {
    expect(() => {
      insertRequest(status)
    }).not.toThrow()
    const row = testDb.raw
      .prepare(`SELECT status FROM service_requests WHERE id = 'r1'`)
      .get() as { status: string }
    expect(row.status).toBe(status)
  })

  it('defaults the status to new', () => {
    testDb.raw
      .prepare(
        `INSERT INTO service_requests (id, type, payload, consent_at, form_name, created_at, updated_at)
         VALUES ('r1', 'kava', '{}', ?, 'metsamajanduskava', ?, ?)`,
      )
      .run(NOW, NOW, NOW)
    const row = testDb.raw
      .prepare(`SELECT status FROM service_requests WHERE id = 'r1'`)
      .get() as { status: string }
    expect(row.status).toBe('new')
  })

  it('rejects an unknown status', () => {
    expect(() => {
      insertRequest('kustutatud')
    }).toThrow()
  })

  it('preserves rows through the status transition', () => {
    insertRequest('routed')
    testDb.raw.prepare(`UPDATE service_requests SET status = 'teostatud' WHERE id = 'r1'`).run()
    const row = testDb.raw
      .prepare(`SELECT status, payload FROM service_requests WHERE id = 'r1'`)
      .get() as { status: string; payload: string }
    expect(row).toMatchObject({ status: 'teostatud', payload: '{}' })
  })
})
