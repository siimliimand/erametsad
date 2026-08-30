import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { auctionObjectTypes, inList } from './shared'
import { users } from './users'

export const rightsRequestStatuses = ['pending', 'approved', 'rejected'] as const
export type RightsRequestStatus = (typeof rightsRequestStatuses)[number]

export const rightsRequests = sqliteTable(
  'rights_requests',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    objectType: text('object_type', { enum: auctionObjectTypes }).notNull(),
    status: text('status', { enum: rightsRequestStatuses }).notNull().default('pending'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('rights_requests_user_object_status_idx').on(t.userId, t.objectType, t.status),
    check(
      'rights_requests_status_check',
      sql`${t.status} IN ${sql.raw(inList(rightsRequestStatuses))}`,
    ),
    check(
      'rights_requests_object_type_check',
      sql`${t.objectType} IN ${sql.raw(inList(auctionObjectTypes))}`,
    ),
  ],
)
