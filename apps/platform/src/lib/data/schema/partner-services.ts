import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const partnerServices = sqliteTable(
  'partner_services',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    icon: text('icon'),
    link: text('link'),
    order: integer('order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('partner_services_slug_unique').on(t.slug)],
)
