import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

import { pages } from './pages'

/**
 * Immutable snapshot of one page's blocks for version history and the later
 * diff/restore UI. Rows are append-only: `version` is a monotonic per-page
 * counter, `label` is an optional human-readable name shown in the restore
 * UI, and `snapshotJson` holds the full blocks payload as TEXT-JSON.
 */
export const pageVersions = sqliteTable(
  'page_versions',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    pageId: text('page_id')
      .notNull()
      .references(() => pages.id),
    version: integer('version').notNull(),
    label: text('label'),
    snapshotJson: text('snapshot_json').notNull(),
    // Snapshots never change; updatedAt mirrors createdAt because the shared
    // repository write path stamps it on every create.
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('page_versions_page_version_unique').on(t.pageId, t.version),
  ],
)
