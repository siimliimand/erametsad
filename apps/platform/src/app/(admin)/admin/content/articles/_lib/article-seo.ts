import type { ArticleCategory } from '@/lib/data/schema'

/**
 * Pure helpers for the article SEO panel (spec delta admin-ui: 60/160
 * counters, SERP and Open-Graph previews) and the category labels shared
 * by the form and the list. The preview builders fall back to the
 * article's own fields so a half-filled form still shows a realistic
 * preview, matching how search engines and OG readers substitute content.
 */

export const articleCategoryLabels: Record<ArticleCategory, string> = {
  uudised: 'Uudised',
  'klientide-lood': 'Klientide lood',
}

export const SEO_TITLE_MAX = 60
export const SEO_DESCRIPTION_MAX = 160

export interface SeoCounter {
  length: number
  max: number
  over: boolean
}

export function seoCounter(value: string | null | undefined, max: number): SeoCounter {
  const length = value?.length ?? 0
  return { length, max, over: length > max }
}

/** First value that survives trim with characters left; empty string otherwise. */
function firstText(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return ''
}

function normalizeImageId(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  if (trimmed) {
    return trimmed
  }
  return null
}

export interface SerpPreview {
  url: string
  title: string
  description: string
}

export function serpPreview(input: {
  slug?: string | null | undefined
  title?: string | null | undefined
  seoTitle?: string | null | undefined
  excerpt?: string | null | undefined
  seoDescription?: string | null | undefined
}): SerpPreview {
  return {
    url: `erametsad.ee/artiklid/${firstText(input.slug, '…')}`,
    title: firstText(input.seoTitle, input.title, 'Artikli pealkiri'),
    description: firstText(input.seoDescription, input.excerpt, 'Artikli lühikirjeldus…'),
  }
}

export interface OgPreview {
  siteName: string
  title: string
  description: string
  imageId: string | null
}

export function ogPreview(input: {
  title?: string | null | undefined
  seoTitle?: string | null | undefined
  excerpt?: string | null | undefined
  seoDescription?: string | null | undefined
  ogImageId?: string | null | undefined
}): OgPreview {
  return {
    siteName: 'Erametsad',
    title: firstText(input.seoTitle, input.title, 'Artikli pealkiri'),
    description: firstText(input.seoDescription, input.excerpt, 'Artikli lühikirjeldus…'),
    imageId: normalizeImageId(input.ogImageId),
  }
}
