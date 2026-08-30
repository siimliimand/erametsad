import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { inList, notificationChannels } from './shared'
import { users } from './users'

export const subscriptionFrequencies = ['immediate', 'daily', 'weekly'] as const
export type SubscriptionFrequency = (typeof subscriptionFrequencies)[number]

export const subscriptionStatuses = ['active', 'unsubscribed'] as const
export type SubscriptionStatus = (typeof subscriptionStatuses)[number]

export const auctionSubscriptions = sqliteTable(
  'auction_subscriptions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id').references(() => users.id),
    filterJson: text('filter_json'),
    channel: text('channel', { enum: notificationChannels }),
    frequency: text('frequency', { enum: subscriptionFrequencies }),
    unsubscribeToken: text('unsubscribe_token'),
    status: text('status', { enum: subscriptionStatuses }).notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('auction_subscriptions_user_idx').on(t.userId),
    uniqueIndex('auction_subscriptions_unsubscribe_token_unique').on(t.unsubscribeToken),
    check(
      'auction_subscriptions_channel_check',
      sql`${t.channel} IN ${sql.raw(inList(notificationChannels))}`,
    ),
    check(
      'auction_subscriptions_frequency_check',
      sql`${t.frequency} IN ${sql.raw(inList(subscriptionFrequencies))}`,
    ),
    check(
      'auction_subscriptions_status_check',
      sql`${t.status} IN ${sql.raw(inList(subscriptionStatuses))}`,
    ),
  ],
)
