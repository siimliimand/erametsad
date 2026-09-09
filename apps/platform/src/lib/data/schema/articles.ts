import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { contentStatuses } from './content'
import { media } from './media'
import { inList } from './shared'

export const articleCategories = ['uudised', 'klientide-lood'] as const
export type ArticleCategory = (typeof articleCategories)[number]

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    category: text('category', { enum: articleCategories }).notNull().default('uudised'),
    excerpt: text('excerpt'),
    // Payload richText; stored as TEXT per the jsonb mapping rule.
    content: text('content'),
    featuredImageId: text('featured_image_id').references(() => media.id),
    author: text('author'),
    // Plain text ref to specialists.id, as in auctions.specialist_id.
    authorSpecialistId: text('author_specialist_id'),
    // Payload 'seo' group flattened into columns for direct reads.
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    ogImageId: text('og_image_id').references(() => media.id),
    canonicalUrl: text('canonical_url'),
    robotsIndex: integer('robots_index', { mode: 'boolean' }).notNull().default(true),
    publishedAt: text('published_at'),
    // Payload text hasMany; stored as a JSON array in TEXT.
    tags: text('tags'),
    status: text('status', { enum: contentStatuses }).notNull().default('draft'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('articles_slug_unique').on(t.slug),
    index('articles_status_idx').on(t.status),
    index('articles_author_specialist_idx').on(t.authorSpecialistId),
    check('articles_status_check', sql`${t.status} IN ${sql.raw(inList(contentStatuses))}`),
    check('articles_category_check', sql`${t.category} IN ${sql.raw(inList(articleCategories))}`),
  ],
)
