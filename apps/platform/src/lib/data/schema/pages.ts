import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { contentStatuses } from './content'
import { media } from './media'

export const pages = sqliteTable(
  'pages',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    // Payload blocks; serialized whole as TEXT JSON (no queried paths).
    layout: text('layout'),
    // Payload 'seo' group flattened into columns for direct reads.
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    seoOgImageId: text('seo_og_image_id').references(() => media.id),
    publishedAt: text('published_at'),
    status: text('status', { enum: contentStatuses }).notNull().default('draft'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('pages_slug_unique').on(t.slug),
    index('pages_status_idx').on(t.status),
  ],
)
