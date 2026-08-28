import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { media } from './media'

export const testimonials = sqliteTable(
  'testimonials',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    role: text('role'),
    content: text('content').notNull(),
    avatarId: text('avatar_id').references(() => media.id),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
)
