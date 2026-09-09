import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 3.4 schema additions on `testimonials` (change
 * admin-spec-gap-fixes): migration 0017 adds `status` with the
 * contentStatuses CHECK constraint and the optional `rating` column.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertTestimonial(status: string): void {
  testDb.raw
    .prepare(
      `INSERT INTO testimonials (id, name, content, status, created_at, updated_at)
       VALUES (?, 'Mari Mets', 'Suurepärane teenus.', ?, ?, ?)`,
    )
    .run(`t-${status}`, status, NOW, NOW)
}

function testimonialRow(id: string): Record<string, unknown> {
  return testDb.raw
    .prepare(
      `SELECT status, rating FROM testimonials WHERE id = '${id}'`,
    )
    .get() as Record<string, unknown>
}

describe('testimonials schema additions (migration 0017)', () => {
  it('keeps pre-existing rows with a draft status and no rating', () => {
    insertTestimonial('draft')
    expect(testimonialRow('t-draft')).toMatchObject({ status: 'draft', rating: null })
  })

  it('accepts every contentStatuses value', () => {
    insertTestimonial('draft')
    insertTestimonial('published')
    const count = testDb.raw.prepare('SELECT count(*) AS n FROM testimonials').get() as {
      n: number
    }
    expect(count.n).toBe(2)
    expect(testimonialRow('t-published')).toMatchObject({ status: 'published' })
  })

  it('rejects a status outside the enum with the CHECK constraint', () => {
    expect(() => { insertTestimonial('archived'); }).toThrow(/CHECK/)
  })

  it('rejects an out-of-enum status on update as well', () => {
    insertTestimonial('draft')
    expect(
      () =>
        testDb.raw
          .prepare(`UPDATE testimonials SET status = 'pending' WHERE id = 't-draft'`)
          .run(),
    ).toThrow(/CHECK/)
  })

  it('stores an optional rating and clears it back to null', () => {
    insertTestimonial('published')
    testDb.raw.prepare(`UPDATE testimonials SET rating = 5 WHERE id = 't-published'`).run()
    expect(testimonialRow('t-published')).toMatchObject({ rating: 5 })
    testDb.raw.prepare(`UPDATE testimonials SET rating = NULL WHERE id = 't-published'`).run()
    expect(testimonialRow('t-published')).toMatchObject({ rating: null })
  })
})
