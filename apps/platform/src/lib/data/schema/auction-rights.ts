import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { auctionObjectTypes, inList } from './shared'
import { users } from './users'

export const auctionRights = sqliteTable(
  'auction_rights',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    objectType: text('object_type', { enum: auctionObjectTypes }).notNull(),
    grantedBy: text('granted_by')
      .notNull()
      .references(() => users.id),
    grantedAt: text('granted_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('auction_rights_user_object_idx').on(t.userId, t.objectType),
    check(
      'auction_rights_object_type_check',
      sql`${t.objectType} IN ${sql.raw(inList(auctionObjectTypes))}`,
    ),
  ],
)
