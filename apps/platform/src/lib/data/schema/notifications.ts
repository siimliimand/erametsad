import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList, notificationChannels } from './shared'
import { users } from './users'

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    event: text('event').notNull(),
    channel: text('channel', { enum: notificationChannels }),
    title: text('title'),
    body: text('body'),
    payload: text('payload'),
    readAt: text('read_at'),
    sentAt: text('sent_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('notifications_user_read_idx').on(t.userId, t.readAt),
    check(
      'notifications_channel_check',
      sql`${t.channel} IN ${sql.raw(inList(notificationChannels))}`,
    ),
  ],
)
