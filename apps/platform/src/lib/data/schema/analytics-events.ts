import { sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Append-only analytics log. Event names are free-form on purpose: this is
// a raw feed for later aggregation, not a normalized fact table. No
// updates, no deletes: the repository is only ever used with create/find.
export const analyticsEvents = sqliteTable('analytics_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  // Free-form event name, e.g. 'cookie_consent', 'nav_click'.
  name: text('name').notNull(),
  // JSON-encoded props object.
  props: text('props'),
  // Salted SHA-256, same computeIpHash digest as consent_log.ip_hash.
  ipHash: text('ip_hash').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
