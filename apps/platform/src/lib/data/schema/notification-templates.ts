import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'
import { users } from './users'

// Templates cover the two outbound channels only; in_app messages are
// composed in code (notifications/service.ts) and have no subject line.
export const templateChannels = ['email', 'sms'] as const
export type TemplateChannel = (typeof templateChannels)[number]

/**
 * One row per template version: an edit inserts a new row with the next
 * version and deactivates the previous one, so history stays in the table
 * and restore copies an old row forward. The partial unique index keeps
 * exactly one active version per (event, channel) group.
 */
export const notificationTemplates = sqliteTable(
  'notification_templates',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    event: text('event').notNull(),
    channel: text('channel', { enum: templateChannels }).notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    version: integer('version').notNull().default(1),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    updatedBy: text('updated_by').references(() => users.id),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('notification_templates_event_channel_idx').on(t.event, t.channel),
    uniqueIndex('notification_templates_active_idx')
      .on(t.event, t.channel)
      .where(sql`active = 1`),
    check(
      'notification_templates_channel_check',
      sql`${t.channel} IN ${sql.raw(inList(templateChannels))}`,
    ),
    check('notification_templates_version_check', sql`${t.version} >= 1`),
  ],
)
