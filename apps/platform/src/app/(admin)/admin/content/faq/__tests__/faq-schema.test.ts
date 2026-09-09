import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 3.3 schema additions on `faq_categories` and `faq_items`
 * (change admin-spec-gap-fixes): the migration 0016 columns exist,
 * `active` defaults to on, and `short_answer` stays nullable.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertCategory(): void {
  testDb.raw
    .prepare(
      `INSERT INTO faq_categories (id, title, slug, created_at, updated_at)
       VALUES ('c1', 'Oksjon', 'oksjon', ?, ?)`,
    )
    .run(NOW, NOW)
}

function insertItem(): void {
  testDb.raw
    .prepare(
      `INSERT INTO faq_items (id, question, answer, category_id, created_at, updated_at)
       VALUES ('i1', 'Kas metsa saab müüa?', '<p>Jah.</p>', 'c1', ?, ?)`,
    )
    .run(NOW, NOW)
}

function categoryRow(): Record<string, unknown> {
  return testDb.raw
    .prepare('SELECT active FROM faq_categories WHERE id = \'c1\'')
    .get() as Record<string, unknown>
}

function itemRow(): Record<string, unknown> {
  return testDb.raw
    .prepare(
      `SELECT active, short_answer, answer FROM faq_items WHERE id = 'i1'`,
    )
    .get() as Record<string, unknown>
}

describe('faq schema additions (migration 0016)', () => {
  it('defaults active to on for categories and items', () => {
    insertCategory()
    insertItem()
    expect(categoryRow()).toMatchObject({ active: 1 })
    expect(itemRow()).toMatchObject({ active: 1 })
  })

  it('keeps short_answer nullable and stores the full answer', () => {
    insertCategory()
    insertItem()
    expect(itemRow()).toMatchObject({ short_answer: null, answer: '<p>Jah.</p>' })
  })

  it('persists a short answer and an active toggle on update', () => {
    insertCategory()
    insertItem()
    testDb.raw
      .prepare(
        `UPDATE faq_items SET short_answer = 'Jah.', active = 0 WHERE id = 'i1'`,
      )
      .run()
    expect(itemRow()).toMatchObject({ short_answer: 'Jah.', active: 0 })
  })

  it('supports deactivating a category', () => {
    insertCategory()
    testDb.raw.prepare(`UPDATE faq_categories SET active = 0 WHERE id = 'c1'`).run()
    expect(categoryRow()).toMatchObject({ active: 0 })
  })
})
