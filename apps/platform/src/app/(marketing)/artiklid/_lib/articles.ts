import { richTextToText } from './article-text'
import { ARTICLE_CATEGORIES, type ArticleCategory } from './categories'

import { getRepositories } from '@/lib/data/runtime'

export interface ArticleListItem {
  slug: string
  title: string
  excerpt: string
  contentText: string
  author: string | null
  publishedAt: string | null
  tags: string[]
}

export const ARTICLES_PER_PAGE = 9

/** tags is a decoded JSON array column: narrowed at the boundary. */
export function toStringTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((tag): tag is string => typeof tag === 'string') : []
}

// Same normalization as KkkHubSearch: NFD strip of combining marks plus
// explicit Estonian õ/ä/ö/ü mappings.
const DIACRITIC_MAP: Record<string, string> = {
  õ: 'o', ä: 'a', ö: 'o', ü: 'u',
  Õ: 'O', Ä: 'A', Ö: 'O', Ü: 'U',
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split('')
    .map((ch) => DIACRITIC_MAP[ch] ?? ch)
    .join('')
    .toLowerCase()
}

export async function loadPublishedArticles(): Promise<ArticleListItem[]> {
  const repos = await getRepositories()
  const { docs } = await repos.find({
    collection: 'articles',
    where: { status: { equals: 'published' } },
    sort: '-publishedAt',
    pagination: false,
  })
  return docs.map((doc) => {
    const contentText = doc.content ? richTextToText(doc.content) : ''
    return {
      slug: doc.slug,
      title: doc.title,
      excerpt: doc.excerpt ?? contentText,
      contentText,
      author: doc.author,
      publishedAt: doc.publishedAt,
      tags: toStringTags(doc.tags),
    }
  })
}

export function filterByCategory(
  items: ArticleListItem[],
  category: ArticleCategory,
): ArticleListItem[] {
  return items.filter((item) => item.tags.includes(category.tag))
}

/** GET /artiklid?q=<term> from the 404 search box: title/content match. */
export function searchArticles(
  items: ArticleListItem[],
  query: string,
): ArticleListItem[] {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []
  const needle = normalize(trimmed)
  return items.filter(
    (item) =>
      normalize(item.title).includes(needle) ||
      normalize(item.contentText).includes(needle),
  )
}

export interface PaginatedArticles {
  items: ArticleListItem[]
  page: number
  totalPages: number
}

export function paginateArticles(
  items: ArticleListItem[],
  pageParam: string | undefined,
): PaginatedArticles {
  const totalPages = Math.max(1, Math.ceil(items.length / ARTICLES_PER_PAGE))
  const parsed = Number.parseInt(pageParam ?? '', 10)
  const page =
    Number.isFinite(parsed) && parsed >= 1 ? Math.min(parsed, totalPages) : 1
  const start = (page - 1) * ARTICLES_PER_PAGE
  return {
    items: items.slice(start, start + ARTICLES_PER_PAGE),
    page,
    totalPages,
  }
}

/** Card category pill: a known category label wins, else the first raw tag. */
export function articleCardCategory(item: { tags: string[] }): string | undefined {
  const known = ARTICLE_CATEGORIES.find((category) => item.tags.includes(category.tag))
  return known?.label ?? item.tags[0]
}
