import { index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { users } from './users'

export const auditEntries = sqliteTable(
  'audit_entries',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    actorId: text('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: text('before'),
    after: text('after'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('audit_entries_entity_idx').on(t.entityType, t.entityId),
    index('audit_entries_actor_idx').on(t.actorId),
  ],
)
