import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { contentStatuses } from './content'
import { media } from './media'
import { inList } from './shared'

export const testimonials = sqliteTable(
  'testimonials',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    role: text('role'),
    content: text('content').notNull(),
    avatarId: text('avatar_id').references(() => media.id),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    // Optional 1-5 star rating from the client.
    rating: integer('rating'),
    status: text('status', { enum: contentStatuses }).notNull().default('draft'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [check('testimonials_status_check', sql`${t.status} IN ${sql.raw(inList(contentStatuses))}`)],
)
