import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { auctions } from './auctions'
import { inList } from './shared'
import { users } from './users'

export const autobidderStatuses = ['active', 'paused', 'expired'] as const
export type AutobidderStatus = (typeof autobidderStatuses)[number]

export const autobidders = sqliteTable(
  'autobidders',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    auctionId: text('auction_id')
      .notNull()
      .references(() => auctions.id),
    maxAmountCents: integer('max_amount_cents').notNull(),
    status: text('status', { enum: autobidderStatuses }).notNull().default('active'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('autobidders_auction_idx').on(t.auctionId),
    // Encodes the collection hook invariant: at most one active autobidder per user and auction.
    uniqueIndex('autobidders_user_auction_active_unique')
      .on(t.userId, t.auctionId)
      .where(sql`${t.status} = 'active'`),
    check('autobidders_status_check', sql`${t.status} IN ${sql.raw(inList(autobidderStatuses))}`),
    check('autobidders_max_amount_check', sql`${t.maxAmountCents} >= 0`),
  ],
)
