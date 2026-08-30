import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const faqCategories = sqliteTable(
  'faq_categories',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    // Payload number used only for display ordering; integer is sufficient.
    order: integer('order').notNull().default(0),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [uniqueIndex('faq_categories_slug_unique').on(t.slug)],
)
