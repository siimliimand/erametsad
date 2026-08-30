import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { faqCategories } from './faq-categories'

export const faqItems = sqliteTable(
  'faq_items',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    question: text('question').notNull(),
    // Payload richText; stored as TEXT per the jsonb mapping rule.
    answer: text('answer').notNull(),
    categoryId: text('category_id')
      .notNull()
      .references(() => faqCategories.id),
    order: integer('order').notNull().default(0),
    slug: text('slug'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('faq_items_category_idx').on(t.categoryId)],
)
