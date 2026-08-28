import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { counties } from './counties'

export const parishes = sqliteTable(
  'parishes',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    code: text('code'),
    countyId: text('county_id')
      .notNull()
      .references(() => counties.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('parishes_county_idx').on(t.countyId)],
)
