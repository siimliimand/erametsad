import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'
import { users } from './users'

// Where the closure applies: portal (public site), admin (back office),
// or all. The middleware gate currently blocks public routes only.
export const maintenanceScopes = ['portal', 'admin', 'all'] as const
export type MaintenanceScope = (typeof maintenanceScopes)[number]

/**
 * Planned maintenance windows shown as the "Aknad" table in Seaded.
 * Saving a window whose range contains an auction end is blocked by the
 * action-level conflict checker unless the operator force-confirms.
 */
export const maintenanceWindows = sqliteTable(
  'maintenance_windows',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    startsAt: text('starts_at').notNull(),
    endsAt: text('ends_at').notNull(),
    scope: text('scope', { enum: maintenanceScopes }).notNull().default('portal'),
    createdBy: text('created_by').references(() => users.id),
    note: text('note'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('maintenance_windows_starts_idx').on(t.startsAt),
    check(
      'maintenance_windows_scope_check',
      sql`${t.scope} IN ${sql.raw(inList(maintenanceScopes))}`,
    ),
    check('maintenance_windows_range_check', sql`${t.endsAt} > ${t.startsAt}`),
  ],
)
