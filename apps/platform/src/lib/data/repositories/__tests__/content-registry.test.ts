import { getTableColumns } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'

import { statisticsSnapshots } from '../../schema'
import { UnknownCollectionError } from '../errors'
import {
  contentCollections,
  coreCollections,
  getCollectionConfig,
  type ContentCollectionSlug,
} from '../registry'

const contentSlugs = Object.keys(contentCollections) as ContentCollectionSlug[]

describe('contentCollections registry', () => {
  it('covers the 13 content collections', () => {
    expect(Object.keys(contentCollections).sort()).toEqual(
      [
        'articles',
        'counties',
        'faq-categories',
        'faq-items',
        'legal-documents',
        'media',
        'pages',
        'parishes',
        'partner-services',
        'redirects',
        'specialists',
        'statistics-snapshots',
        'testimonials',
      ].sort(),
    )
  })

  it('keeps the core registry at the 17 core collections', () => {
    expect(Object.keys(coreCollections)).toHaveLength(17)
    expect(contentSlugs).toHaveLength(13)
  })

  it('maps every slug to a table whose columns include the id', () => {
    for (const [slug, config] of Object.entries(contentCollections)) {
      const columns = getTableColumns(config.table)
      expect(columns.id, slug).toBeDefined()
    }
  })

  it('resolves relation aliases to real schema columns', () => {
    for (const [slug, config] of Object.entries(contentCollections)) {
      const columns = getTableColumns(config.table)
      for (const alias of Object.values(config.aliases)) {
        expect(alias in columns, `${slug}: ${alias}`).toBe(true)
      }
    }
  })

  it('declares the content TEXT-JSON fields and leaves richText columns raw', () => {
    expect(contentCollections.articles.jsonFields).toEqual({ tags: 'array' })
    expect(contentCollections.pages.jsonFields).toEqual({ layout: 'json' })
    const richTextOwners = [
      'articles',
      'faq-items',
      'legal-documents',
      'specialists',
    ] as ContentCollectionSlug[]
    for (const slug of richTextOwners) {
      const jsonKeys = Object.keys(contentCollections[slug].jsonFields)
      expect(jsonKeys, slug).not.toContain('content')
      expect(jsonKeys, slug).not.toContain('answer')
      expect(jsonKeys, slug).not.toContain('bio')
    }
  })

  it('maps statistics_snapshots.eur to the real eur_cents column only', () => {
    expect(contentCollections['statistics-snapshots'].moneyFields).toEqual({ eur: 'eurCents' })
    expect(contentCollections.articles.moneyFields).toBeUndefined()
    const columns = getTableColumns(statisticsSnapshots)
    expect('eurCents' in columns).toBe(true)
    for (const [slug, config] of Object.entries({ ...coreCollections, ...contentCollections })) {
      for (const column of Object.values(config.moneyFields ?? {})) {
        const own = getTableColumns(config.table) as Record<string, unknown>
        expect(column in own, slug).toBe(true)
      }
    }
  })

  it('runs no users or template hooks on content collections', () => {
    for (const [slug, config] of Object.entries(contentCollections)) {
      expect(config.isikukood, slug).toBe(false)
      expect(config.templateActivation, slug).toBe(false)
    }
  })

  it('resolves every core and content slug through the merged lookup', () => {
    for (const slug of [...Object.keys(coreCollections), ...contentSlugs]) {
      expect(getCollectionConfig(slug).table, slug).toBeDefined()
    }
    expect(() => getCollectionConfig('nope')).toThrow(UnknownCollectionError)
  })

  it('uses the expected table per content slug', () => {
    expect(getCollectionConfig('articles').table).toBe(contentCollections.articles.table)
    expect(getCollectionConfig('statistics-snapshots').table).toBe(statisticsSnapshots)
  })
})
