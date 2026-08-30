import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { media } from './media'

// Payload slug is the singular 'specialist'; the table name is plural to
// match the specialist_id / assigned_specialist_id columns from task 2.2.
export const specialists = sqliteTable(
  'specialists',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    role: text('role'),
    phone: text('phone'),
    email: text('email'),
    photoId: text('photo_id').references(() => media.id),
    // Payload richText; stored as TEXT and rendered by the admin UI.
    bio: text('bio'),
    region: text('region'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('specialists_slug_unique').on(t.slug)],
)
