import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 3.1 schema additions on `articles` (change admin-spec-gap-fixes):
 * the migration 0015 columns exist and the category CHECK constraint
 * rejects out-of-enum values (spec scenario "Article category constraint").
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertArticle(): void {
  testDb.raw
    .prepare(
      `INSERT INTO articles (id, title, slug, status, created_at, updated_at)
       VALUES ('a1', 'Metsa müügi juhend', 'metsa-muugi-juhend', 'draft', ?, ?)`,
    )
    .run(NOW, NOW)
}

function insertArticleWithCategory(category: string, slug: string): void {
  testDb.raw
    .prepare(
      `INSERT INTO articles (id, title, slug, category, status, created_at, updated_at)
       VALUES (?, 'T', ?, ?, 'draft', ?, ?)`,
    )
    .run(`a-${slug}`, slug, category, NOW, NOW)
}

function articleRow(): Record<string, unknown> {
  return testDb.raw
    .prepare(
      `SELECT category, robots_index, seo_title, seo_description, og_image_id,
              canonical_url, author_specialist_id
       FROM articles WHERE id = 'a1'`,
    )
    .get() as Record<string, unknown>
}

describe('articles schema additions (migration 0015)', () => {
  it('defaults category to uudised and robots_index to indexed', () => {
    insertArticle()
    expect(articleRow()).toMatchObject({ category: 'uudised', robots_index: 1 })
  })

  it('accepts every documented category value', () => {
    for (const category of ['uudised', 'klientide-lood']) {
      insertArticleWithCategory(category, category)
    }
    const count = testDb.raw.prepare('SELECT count(*) AS n FROM articles').get() as {
      n: number
    }
    expect(count.n).toBe(2)
  })

  it('rejects a category outside the enum with the CHECK constraint', () => {
    expect(() => { insertArticleWithCategory('blogi', 'blogi'); }).toThrow(/CHECK/)
  })

  it('rejects an out-of-enum category on update as well', () => {
    insertArticle()
    expect(
      () =>
        testDb.raw
          .prepare(`UPDATE articles SET category = 'murulaat' WHERE id = 'a1'`)
          .run(),
    ).toThrow(/CHECK/)
  })

  it('adds the SEO and author columns as nullable text', () => {
    insertArticle()
    expect(articleRow()).toMatchObject({
      seo_title: null,
      seo_description: null,
      og_image_id: null,
      canonical_url: null,
      author_specialist_id: null,
    })
  })
})
