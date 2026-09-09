import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 4.4 schema (change admin-spec-gap-fixes): migration 0024 creates
 * maintenance_windows with a scope CHECK (portal/admin/all) and an
 * ends-after-starts range CHECK.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertWindow(overrides: Record<string, string> = {}): void {
  const values = {
    id: 'w1',
    startsAt: '2026-10-01T08:00:00.000Z',
    endsAt: '2026-10-01T12:00:00.000Z',
    scope: 'portal',
    note: 'hooldus',
    ...overrides,
  }
  testDb.raw
    .prepare(
      `INSERT INTO maintenance_windows
        (id, starts_at, ends_at, scope, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(values.id, values.startsAt, values.endsAt, values.scope, values.note, NOW, NOW)
}

describe('maintenance_windows (migration 0024)', () => {
  it.each(['portal', 'admin', 'all'])('accepts the %s scope', (scope) => {
    expect(() => {
      insertWindow({ scope })
    }).not.toThrow()
    const row = testDb.raw
      .prepare(`SELECT scope FROM maintenance_windows WHERE id = 'w1'`)
      .get() as { scope: string }
    expect(row.scope).toBe(scope)
  })

  it('rejects an unknown scope', () => {
    expect(() => {
      insertWindow({ scope: 'kõik' })
    }).toThrow()
  })

  it('defaults the scope to portal', () => {
    testDb.raw
      .prepare(
        `INSERT INTO maintenance_windows (id, starts_at, ends_at, created_at, updated_at)
         VALUES ('w1', ?, ?, ?, ?)`,
      )
      .run('2026-10-01T08:00:00.000Z', '2026-10-01T12:00:00.000Z', NOW, NOW)
    const row = testDb.raw
      .prepare(`SELECT scope FROM maintenance_windows WHERE id = 'w1'`)
      .get() as { scope: string }
    expect(row.scope).toBe('portal')
  })

  it('rejects a window that ends before it starts', () => {
    expect(() => {
      insertWindow({ startsAt: '2026-10-01T12:00:00.000Z', endsAt: '2026-10-01T08:00:00.000Z' })
    }).toThrow()
  })

  it('rejects a zero-length window', () => {
    expect(() => {
      insertWindow({ startsAt: '2026-10-01T08:00:00.000Z', endsAt: '2026-10-01T08:00:00.000Z' })
    }).toThrow()
  })
})
