import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const redirectTypes = ['301', '302'] as const
export type RedirectType = (typeof redirectTypes)[number]

export const redirects = sqliteTable(
  'redirects',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    from: text('from').notNull(),
    to: text('to').notNull(),
    type: text('type', { enum: redirectTypes }).notNull().default('301'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('redirects_from_idx').on(t.from),
    check('redirects_type_check', sql`${t.type} IN ${sql.raw(inList(redirectTypes))}`),
  ],
)
