import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { contentStatuses } from './content'
import { media } from './media'

export const articles = sqliteTable(
  'articles',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    excerpt: text('excerpt'),
    // Payload richText; stored as TEXT per the jsonb mapping rule.
    content: text('content'),
    featuredImageId: text('featured_image_id').references(() => media.id),
    author: text('author'),
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
  ],
)
