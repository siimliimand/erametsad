import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 3.6 schema additions on `media` (change admin-spec-gap-fixes):
 * migration 0026 adds nullable `focal_x`/`focal_y` REAL columns with
 * 0..1 CHECK constraints.
 */

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertMedia(id: string, focalX: number | null, focalY: number | null): boolean {
  try {
    testDb.raw
      .prepare(
        `INSERT INTO media (id, filename, alt, focal_x, focal_y, created_at, updated_at)
         VALUES (?, 'pilt.jpg', 'Mets', ?, ?, '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z')`,
      )
      .run(id, focalX, focalY)
    return true
  } catch {
    return false
  }
}

function focalRow(id: string): { focal_x: number | null; focal_y: number | null } {
  return testDb.raw.prepare('SELECT focal_x, focal_y FROM media WHERE id = ?').get(id) as {
    focal_x: number | null
    focal_y: number | null
  }
}

describe('media focal point columns (migration 0026)', () => {
  it('stores and reads back 0..1 fractions', () => {
    expect(insertMedia('m-1', 0.35, 0.75)).toBe(true)
    expect(focalRow('m-1')).toEqual({ focal_x: 0.35, focal_y: 0.75 })
  })

  it('keeps the columns nullable for the center default', () => {
    expect(insertMedia('m-2', null, null)).toBe(true)
    expect(focalRow('m-2')).toEqual({ focal_x: null, focal_y: null })
  })

  it('rejects coordinates outside 0..1', () => {
    expect(insertMedia('m-3', -0.1, 0.5)).toBe(false)
    expect(insertMedia('m-4', 0.5, 1.5)).toBe(false)
  })
})
