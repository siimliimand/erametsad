import { describe, expect, it } from 'vitest'

import {
  MAX_IMPORT_ITEMS,
  articleImportSchema,
  pageImportSchema,
  parseImportPayload,
  planArticleUpserts,
  planPageUpserts,
  resolvePublishedAt,
  sampleImportFile,
  summarize,
  toExportArticle,
  toExportPage,
  type ExistingEntity,
} from './import-export'

import type { ArticleDoc, PageDoc } from '@/lib/data/repositories'

const NOW = '2026-08-29T10:00:00.000Z'

describe('parseImportPayload', () => {
  it('routes a bare array to the selected entity (articles)', () => {
    const result = parseImportPayload([{ title: 'A', slug: 'a' }], 'articles')
    expect(result).toEqual({
      ok: true,
      parsed: { articles: [{ title: 'A', slug: 'a' }], pages: [] },
    })
  })

  it('routes a bare array to the selected entity (pages)', () => {
    const result = parseImportPayload([{ title: 'P', slug: 'p' }], 'pages')
    expect(result).toEqual({
      ok: true,
      parsed: { articles: [], pages: [{ title: 'P', slug: 'p' }] },
    })
  })

  it('accepts the grouped articles/pages object', () => {
    const payload = { articles: [{ slug: 'a' }], pages: [{ slug: 'p' }] }
    expect(parseImportPayload(payload, 'articles')).toEqual({
      ok: true,
      parsed: { articles: [{ slug: 'a' }], pages: [{ slug: 'p' }] },
    })
  })

  it('accepts a grouped object with only one key', () => {
    const result = parseImportPayload({ pages: [{ slug: 'p' }] }, 'articles')
    expect(result.ok && result.parsed.pages).toHaveLength(1)
    expect(result.ok && result.parsed.articles).toHaveLength(0)
  })

  it('rejects a payload that is neither array nor object', () => {
    const result = parseImportPayload('jablko', 'articles')
    expect(result.ok).toBe(false)
  })

  it('rejects a grouped object with a non-array field', () => {
    const result = parseImportPayload({ articles: 'jablko' }, 'articles')
    expect(result.ok).toBe(false)
  })

  it('rejects an unknown entity selector for a bare array', () => {
    const result = parseImportPayload([{ slug: 'a' }], 'posts')
    expect(result.ok).toBe(false)
  })

  it('rejects a file with zero items', () => {
    const result = parseImportPayload([], 'articles')
    expect(result.ok).toBe(false)
  })

  it('rejects more than the item cap', () => {
    const items = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, i) => ({ slug: `s-${String(i)}` }))
    const result = parseImportPayload(items, 'articles')
    expect(result.ok).toBe(false)
  })

  it('accepts exactly the item cap', () => {
    const items = Array.from({ length: MAX_IMPORT_ITEMS }, (_, i) => ({ slug: `s-${String(i)}` }))
    const result = parseImportPayload(items, 'articles')
    expect(result.ok).toBe(true)
  })
})

describe('articleImportSchema', () => {
  it('parses a full article and fills defaults', () => {
    const parsed = articleImportSchema.parse({
      title: ' Metsa müügi juhend ',
      slug: 'metsa-muugi-juhend',
    })
    expect(parsed.title).toBe('Metsa müügi juhend')
    expect(parsed.status).toBe('draft')
    expect(parsed.tags).toEqual([])
    expect(parsed.publishedAt).toBeUndefined()
  })

  it('rejects a missing title with an Estonian reason', () => {
    const result = articleImportSchema.safeParse({ slug: 'a' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toBe('Pealkiri on kohustuslik.')
  })

  it('rejects a whitespace-only slug', () => {
    const result = articleImportSchema.safeParse({ title: 'A', slug: '   ' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toBe('URL-nimi on kohustuslik.')
  })

  it('rejects an unknown status', () => {
    const result = articleImportSchema.safeParse({ title: 'A', slug: 'a', status: 'archived' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Olek peab olema "draft" või "published".')
    }
  })

  it('rejects an unknown field with an Estonian reason', () => {
    const { invalid } = planArticleUpserts([{ title: 'A', slug: 'a', seoTitle: 'x' }], new Map(), NOW)
    expect(invalid[0]?.reason).toBe('Tundmatud väljad: seoTitle.')
  })

  it('rejects tags that are not an array of strings', () => {
    const result = articleImportSchema.safeParse({ title: 'A', slug: 'a', tags: 'mets' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Sildid peavad olema sõnede massiiv.')
    }
  })
})

describe('pageImportSchema', () => {
  it('parses a page and passes layout through as any JSON', () => {
    const layout = [{ hero: { heading: 'Osta mets' } }]
    const parsed = pageImportSchema.parse({ title: 'P', slug: 'p', layout })
    expect(parsed.layout).toEqual(layout)
    expect(parsed.status).toBe('draft')
  })

  it('rejects an article-only field with an Estonian reason', () => {
    const { invalid } = planPageUpserts([{ title: 'P', slug: 'p', author: 'A' }], new Map(), NOW)
    expect(invalid[0]?.reason).toBe('Tundmatud väljad: author.')
  })
})

describe('planArticleUpserts', () => {
  const existing = new Map<string, ExistingEntity>([
    ['olemas', { id: 'art-1', publishedAt: '2026-01-01T00:00:00.000Z' }],
  ])

  it('plans a create for a new slug and stamps publishedAt when publishing', () => {
    const { plans, invalid } = planArticleUpserts(
      [{ title: 'Uus', slug: 'uus', status: 'published' }],
      existing,
      NOW,
    )
    expect(invalid).toEqual([])
    expect(plans).toHaveLength(1)
    expect(plans[0]?.action).toBe('create')
    expect(plans[0]?.existingId).toBeNull()
    expect(plans[0]?.data.publishedAt).toBe(NOW)
  })

  it('plans an update by slug for an existing slug', () => {
    const { plans } = planArticleUpserts(
      [{ title: 'Muudetud', slug: 'olemas', status: 'draft' }],
      existing,
      NOW,
    )
    expect(plans[0]?.action).toBe('update')
    expect(plans[0]?.existingId).toBe('art-1')
  })

  it('marks the second occurrence of a duplicate slug invalid', () => {
    const { plans, invalid } = planArticleUpserts(
      [
        { title: 'Esimene', slug: 'duubel' },
        { title: 'Teine', slug: 'duubel' },
      ],
      existing,
      NOW,
    )
    expect(plans).toHaveLength(1)
    expect(invalid).toHaveLength(1)
    expect(invalid[0]?.reason).toContain('esineb failis mitu korda')
  })

  it('marks a non-object item invalid with an Estonian reason', () => {
    const { invalid } = planArticleUpserts(['jablko'], existing, NOW)
    expect(invalid[0]?.reason).toBe('Kirje peab olema JSON-objekt.')
  })
})

describe('planPageUpserts', () => {
  it('keeps an existing publishedAt when the item omits it', () => {
    const existing = new Map<string, ExistingEntity>([
      ['kontakt', { id: 'pg-1', publishedAt: '2025-05-05T00:00:00.000Z' }],
    ])
    const { plans } = planPageUpserts(
      [{ title: 'Kontakt', slug: 'kontakt', status: 'published' }],
      existing,
      NOW,
    )
    expect(plans[0]?.data.publishedAt).toBe('2025-05-05T00:00:00.000Z')
  })

  it('resolves a draft create to a null publishedAt', () => {
    const { plans } = planPageUpserts([{ title: 'Uus', slug: 'uus-leht' }], new Map(), NOW)
    expect(plans[0]?.data.publishedAt).toBeNull()
  })
})

describe('resolvePublishedAt', () => {
  it('prefers an explicitly imported value', () => {
    expect(resolvePublishedAt('draft', '2024-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z', NOW))
      .toBe('2024-01-01T00:00:00.000Z')
  })

  it('stamps now for a first publish', () => {
    expect(resolvePublishedAt('published', null, null, NOW)).toBe(NOW)
  })

  it('returns null for a draft with no history', () => {
    expect(resolvePublishedAt('draft', null, null, NOW)).toBeNull()
  })
})

describe('export transforms', () => {
  it('strips id/createdAt/updatedAt from an article and keeps editable fields', () => {
    const doc: ArticleDoc = {
      id: 'a1',
      title: 'Artikkel',
      slug: 'artikkel',
      status: 'published',
      excerpt: 'Kokkuvõte',
      content: 'Sisu',
      featuredImageId: null,
      author: 'Autor',
      publishedAt: '2026-02-02T00:00:00.000Z',
      tags: ['mets'],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-02-02T00:00:00.000Z',
    }
    const exported = toExportArticle(doc)
    expect(exported).toEqual({
      title: 'Artikkel',
      slug: 'artikkel',
      status: 'published',
      excerpt: 'Kokkuvõte',
      content: 'Sisu',
      featuredImageId: null,
      author: 'Autor',
      publishedAt: '2026-02-02T00:00:00.000Z',
      tags: ['mets'],
    })
  })

  it('strips id/createdAt/updatedAt/seoOgImageId from a page', () => {
    const doc: PageDoc = {
      id: 'p1',
      title: 'Leht',
      slug: 'leht',
      status: 'draft',
      layout: { blocks: [] },
      seoTitle: null,
      seoDescription: 'Kirjeldus',
      seoOgImageId: null,
      publishedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    }
    const exported = toExportPage(doc)
    expect(exported).toEqual({
      title: 'Leht',
      slug: 'leht',
      status: 'draft',
      layout: { blocks: [] },
      seoTitle: null,
      seoDescription: 'Kirjeldus',
      publishedAt: null,
    })
  })
})

describe('sampleImportFile', () => {
  it('passes both entity schemas', () => {
    for (const article of sampleImportFile.articles) {
      expect(articleImportSchema.safeParse(article).success).toBe(true)
    }
    for (const page of sampleImportFile.pages) {
      expect(pageImportSchema.safeParse(page).success).toBe(true)
    }
  })
})

describe('summarize', () => {
  it('counts created, updated, and failed outcomes including dry-run variants', () => {
    const summary = summarize([
      { entity: 'articles', index: 1, slug: 'a', title: 'A', outcome: 'created' },
      { entity: 'articles', index: 2, slug: 'b', title: 'B', outcome: 'would-create' },
      { entity: 'pages', index: 1, slug: 'c', title: 'C', outcome: 'would-update' },
      { entity: 'pages', index: 2, slug: 'd', title: 'D', outcome: 'invalid' },
      { entity: 'pages', index: 3, slug: 'e', title: 'E', outcome: 'failed' },
    ])
    expect(summary).toEqual({ created: 2, updated: 1, failed: 2 })
  })
})
