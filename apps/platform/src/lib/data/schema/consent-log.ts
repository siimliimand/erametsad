import { sql } from 'drizzle-orm'
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const consentChoices = ['accepted', 'rejected', 'custom'] as const
export type ConsentChoice = (typeof consentChoices)[number]

// Append-only record of banner decisions. No updates, no deletes: the
// repository is only ever used with create/find.
export const consentLog = sqliteTable(
  'consent_log',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    choice: text('choice', { enum: consentChoices }).notNull(),
    // Per-category map, e.g. { necessary: true, analytics: false }.
    categories: text('categories'),
    // Salted SHA-256, same computeIpHash digest as leads.ip_hash.
    ipHash: text('ip_hash').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('consent_log_choice_check', sql`${t.choice} IN ${sql.raw(inList(consentChoices))}`),
  ],
)
