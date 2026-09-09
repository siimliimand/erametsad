import { describe, expect, it } from 'vitest'

import {
  articleCategoryLabels,
  ogPreview,
  SEO_DESCRIPTION_MAX,
  SEO_TITLE_MAX,
  seoCounter,
  serpPreview,
} from '../_lib/article-seo'

describe('seoCounter', () => {
  it('flags over-limit values against the cap', () => {
    expect(seoCounter('12345', 5)).toEqual({ length: 5, max: 5, over: false })
    expect(seoCounter('123456', 5)).toEqual({ length: 6, max: 5, over: true })
  })

  it('treats missing values as zero', () => {
    expect(seoCounter(null, 60)).toEqual({ length: 0, max: 60, over: false })
    expect(seoCounter(undefined, 160)).toEqual({ length: 0, max: 160, over: false })
  })

  it('keeps the spec limits 60 and 160', () => {
    expect(SEO_TITLE_MAX).toBe(60)
    expect(SEO_DESCRIPTION_MAX).toBe(160)
  })
})

describe('serpPreview', () => {
  it('prefers the SEO fields over the article fields', () => {
    const preview = serpPreview({
      slug: 'metsa-muuk',
      title: 'Artikli pealkiri',
      seoTitle: 'SEO pealkiri',
      excerpt: 'Lühikirjeldus',
      seoDescription: 'SEO kirjeldus',
    })
    expect(preview).toEqual({
      url: 'erametsad.ee/artiklid/metsa-muuk',
      title: 'SEO pealkiri',
      description: 'SEO kirjeldus',
    })
  })

  it('falls back to the article title, excerpt, and a slug placeholder', () => {
    const preview = serpPreview({ title: 'Artikli pealkiri', excerpt: 'Lühikirjeldus' })
    expect(preview.url).toBe('erametsad.ee/artiklid/…')
    expect(preview.title).toBe('Artikli pealkiri')
    expect(preview.description).toBe('Lühikirjeldus')
  })
})

describe('ogPreview', () => {
  it('carries the site name, effective copy, and the image id', () => {
    const preview = ogPreview({
      title: 'Artikli pealkiri',
      seoTitle: 'SEO pealkiri',
      seoDescription: 'SEO kirjeldus',
      ogImageId: 'media-1',
    })
    expect(preview).toEqual({
      siteName: 'Erametsad',
      title: 'SEO pealkiri',
      description: 'SEO kirjeldus',
      imageId: 'media-1',
    })
  })

  it('reports a missing OG image as null', () => {
    expect(ogPreview({ ogImageId: '  ' }).imageId).toBeNull()
    expect(ogPreview({}).imageId).toBeNull()
  })
})

describe('articleCategoryLabels', () => {
  it('labels both documented categories in Estonian', () => {
    expect(Object.keys(articleCategoryLabels).sort()).toEqual([
      'klientide-lood',
      'uudised',
    ])
    expect(articleCategoryLabels.uudised).toBe('Uudised')
    expect(articleCategoryLabels['klientide-lood']).toBe('Klientide lood')
  })
})
