import { sql } from 'drizzle-orm'
import { check, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const counties = sqliteTable(
  'counties',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    code: text('code').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('counties_code_unique').on(t.code),
    // Estonian maakond codes are exactly two letters (HH, HI, ...).
    check('counties_code_length_check', sql`length(${t.code}) = 2`),
  ],
)
