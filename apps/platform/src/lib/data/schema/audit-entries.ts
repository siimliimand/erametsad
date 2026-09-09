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
    // Append-only hash chain: prevHash is the previous row's hash (null on
    // the genesis entry); hash covers the canonical entry serialization plus
    // prevHash (repositories/audit-chain.ts). Nullable because rows written
    // before the chain existed have neither value.
    prevHash: text('prev_hash'),
    hash: text('hash'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
    // Era columns (migration 0020): nullable so rows written before the
    // migration stay valid and keep verifying against the hash chain.
    reason: text('reason'),
    sessionId: text('session_id'),
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
  },
  (t) => [
    index('audit_entries_entity_idx').on(t.entityType, t.entityId),
    index('audit_entries_actor_idx').on(t.actorId),
  ],
)
