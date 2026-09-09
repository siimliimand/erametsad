import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 3.5 schema addition on `redirects` (change admin-spec-gap-fixes):
 * migration 0025 adds the `hits` counter with a 0 default so the middleware
 * resolver can increment it with a single UPDATE.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertRedirect(id: string, hits?: number): boolean {
  try {
    testDb.raw
      .prepare(
        hits === undefined
          ? `INSERT INTO redirects (id, "from", "to", type, created_at, updated_at)
             VALUES (?, '/vana', '/uus', '301', ?, ?)`
          : `INSERT INTO redirects (id, "from", "to", type, hits, created_at, updated_at)
             VALUES (?, '/vana', '/uus', '301', ?, ?, ?)`,
      )
      .run(...(hits === undefined ? [id, NOW, NOW] : [id, hits, NOW, NOW]))
    return true
  } catch {
    return false
  }
}

describe('redirects hits column (migration 0025)', () => {
  it('defaults hits to 0 and persists increments', () => {
    expect(insertRedirect('r-1')).toBe(true)
    expect(testDb.raw.prepare('SELECT hits FROM redirects WHERE id = ?').get('r-1')).toEqual({
      hits: 0,
    })

    testDb.raw
      .prepare('UPDATE redirects SET hits = hits + 1 WHERE "from" = ?')
      .run('/vana')
    testDb.raw
      .prepare('UPDATE redirects SET hits = hits + 1 WHERE "from" = ?')
      .run('/vana')
    expect(testDb.raw.prepare('SELECT hits FROM redirects WHERE id = ?').get('r-1')).toEqual({
      hits: 2,
    })
  })

  it('accepts an explicit starting value', () => {
    expect(insertRedirect('r-2', 7)).toBe(true)
    expect(testDb.raw.prepare('SELECT hits FROM redirects WHERE id = ?').get('r-2')).toEqual({
      hits: 7,
    })
  })
})
