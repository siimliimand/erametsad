import { getTableColumns } from 'drizzle-orm'
import { SQLiteSyncDialect } from 'drizzle-orm/sqlite-core'
import { describe, expect, it } from 'vitest'

import {
  articles,
  faqItems,
  legalDocuments,
  pages,
  parishes,
  redirects,
  specialists,
  statisticsSnapshots,
  testimonials,
} from '../../schema'
import { UnknownFieldError } from '../errors'
import { contentCollections } from '../registry'
import { sortExpression } from '../sort'
import { translateWhere, type WhereClause } from '../where'

const dialect = new SQLiteSyncDialect()

const tables = {
  articles,
  pages,
  'faq-items': faqItems,
  testimonials,
  'legal-documents': legalDocuments,
  redirects,
  specialists,
  'statistics-snapshots': statisticsSnapshots,
  parishes,
}

type ContentSlug = keyof typeof tables

function toSql(slug: ContentSlug, where: WhereClause | undefined) {
  const columns = getTableColumns(tables[slug])
  const condition = translateWhere(columns, where, contentCollections[slug].aliases)
  return condition ? dialect.sqlToQuery(condition) : undefined
}

describe('content where translation', () => {
  it('translates slug lookups on articles and pages', () => {
    const article = toSql('articles', { slug: { equals: 'raieoiguse-oksjonid' } })
    expect(article?.sql).toContain('"articles"."slug" = ?')
    expect(article?.params).toEqual(['raieoiguse-oksjonid'])
    const page = toSql('pages', { slug: { equals: 'kontakt' } })
    expect(page?.sql).toContain('"pages"."slug" = ?')
  })

  it('translates status equals for public read filtering', () => {
    const query = toSql('articles', { status: { equals: 'published' } })
    expect(query?.sql).toContain('"articles"."status" = ?')
    expect(query?.params).toEqual(['published'])
  })

  it('ANDs status and slug for a published slug lookup', () => {
    const query = toSql('pages', {
      and: [{ slug: { equals: 'privaatsuspoliitika' } }, { status: { equals: 'published' } }],
    })
    expect(query?.sql).toContain('"pages"."slug" = ?')
    expect(query?.sql).toContain('and')
    expect(query?.sql).toContain('"pages"."status" = ?')
    expect(query?.params).toEqual(['privaatsuspoliitika', 'published'])
  })

  it('translates the redirects from lookup', () => {
    const query = toSql('redirects', { from: { equals: '/vana-tee' } })
    expect(query?.sql).toContain('"redirects"."from" = ?')
    expect(query?.params).toEqual(['/vana-tee'])
  })

  it('ANDs from and active on redirects', () => {
    const query = toSql('redirects', {
      and: [{ from: { equals: '/vana' } }, { active: { equals: true } }],
    })
    expect(query?.sql).toContain('"redirects"."active" = ?')
    // integer-boolean columns bind 1/0 in SQLite
    expect(query?.params).toEqual(['/vana', 1])
  })

  it('resolves the faq-items category alias to category_id', () => {
    const query = toSql('faq-items', { category: { equals: 'c1' } })
    expect(query?.sql).toContain('"faq_items"."category_id" = ?')
  })

  it('resolves the parishes county alias to county_id', () => {
    const query = toSql('parishes', { county: { equals: 'county-1' } })
    expect(query?.sql).toContain('"parishes"."county_id" = ?')
  })

  it('resolves media relation aliases to id columns', () => {
    const featured = toSql('articles', { featuredImage: { equals: 'm1' } })
    expect(featured?.sql).toContain('"articles"."featured_image_id" = ?')
    const avatar = toSql('testimonials', { avatar: { equals: 'm2' } })
    expect(avatar?.sql).toContain('"testimonials"."avatar_id" = ?')
    const photo = toSql('specialists', { photo: { equals: 'm3' } })
    expect(photo?.sql).toContain('"specialists"."photo_id" = ?')
  })

  it('translates the statistics-snapshots aggregation lookup', () => {
    const query = toSql('statistics-snapshots', {
      and: [{ date: { equals: '2026-08-28' } }, { objectType: { equals: 'raieoigus' } }],
    })
    expect(query?.sql).toContain('"statistics_snapshots"."date" = ?')
    expect(query?.sql).toContain('"statistics_snapshots"."object_type" = ?')
    expect(query?.params).toEqual(['2026-08-28', 'raieoigus'])
  })

  it('translates in on the legal-documents type select', () => {
    const query = toSql('legal-documents', { type: { in: ['terms', 'privacy'] } })
    expect(query?.sql).toContain('"legal_documents"."type" in (?, ?)')
    expect(query?.params).toEqual(['terms', 'privacy'])
  })

  it('throws on an unknown content field', () => {
    expect(() => toSql('articles', { nope: { equals: 'x' } })).toThrow(UnknownFieldError)
  })

  it('does not expose the eur alias as a whereable column', () => {
    expect(() => toSql('statistics-snapshots', { eur: { equals: 10 } })).toThrow(UnknownFieldError)
  })
})

describe('content sort translation', () => {
  it('sorts articles by newest published first', () => {
    const columns = getTableColumns(articles)
    const query = dialect.sqlToQuery(sortExpression(columns, {}, '-publishedAt'))
    expect(query.sql).toContain('"articles"."published_at" desc')
  })

  it('sorts faq items by display order ascending', () => {
    const columns = getTableColumns(faqItems)
    const query = dialect.sqlToQuery(sortExpression(columns, {}, 'order'))
    expect(query.sql).toContain('"faq_items"."order" asc')
  })

  it('sorts statistics snapshots by newest date first', () => {
    const columns = getTableColumns(statisticsSnapshots)
    const query = dialect.sqlToQuery(sortExpression(columns, {}, '-date'))
    expect(query.sql).toContain('"statistics_snapshots"."date" desc')
  })

  it('resolves aliases in sort', () => {
    const columns = getTableColumns(specialists)
    const query = dialect.sqlToQuery(
      sortExpression(columns, contentCollections.specialists.aliases, 'photo'),
    )
    expect(query.sql).toContain('"specialists"."photo_id" asc')
  })

  it('throws on an unknown sort field', () => {
    const columns = getTableColumns(pages)
    expect(() => sortExpression(columns, {}, '-nope')).toThrow(UnknownFieldError)
  })
})
