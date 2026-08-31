export interface ArticleCategory {
  slug: string
  label: string
  /**
   * The articles schema has no category column — categories are carried as
   * designated tags (the only grouping field the CMS and seed define).
   */
  tag: string
}

export const ARTICLE_CATEGORIES: readonly ArticleCategory[] = [
  { slug: 'uudised', label: 'Uudised', tag: 'uudised' },
  { slug: 'klientide-lood', label: 'Kliendilood', tag: 'kliendilood' },
  { slug: 'kasutustingimused', label: 'Kasutustingimused', tag: 'kasutustingimused' },
]

export function findArticleCategory(slug: string): ArticleCategory | undefined {
  return ARTICLE_CATEGORIES.find((category) => category.slug === slug)
}
