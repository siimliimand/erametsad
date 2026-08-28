import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { auctions } from './auctions'
import { inList } from './shared'
import { users } from './users'

export const bidTypes = ['open', 'sealed'] as const
export type BidType = (typeof bidTypes)[number]

export const bidSources = ['manual', 'autobidder'] as const
export type BidSource = (typeof bidSources)[number]

export const bidStatuses = [
  'leading',
  'outbid',
  'won',
  'lost',
  'pending_approval',
  'rejected',
] as const
export type BidStatus = (typeof bidStatuses)[number]

export const bids = sqliteTable(
  'bids',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    auctionId: text('auction_id')
      .notNull()
      .references(() => auctions.id),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    amountCents: integer('amount_cents').notNull(),
    type: text('type', { enum: bidTypes }).notNull(),
    source: text('source', { enum: bidSources }).notNull(),
    status: text('status', { enum: bidStatuses }).notNull(),
    identitySnapshot: text('identity_snapshot'),
    ipHash: text('ip_hash'),
    idempotencyKey: text('idempotency_key'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('bids_auction_created_idx').on(t.auctionId, t.createdAt),
    index('bids_user_idx').on(t.userId),
    uniqueIndex('bids_idempotency_key_unique').on(t.idempotencyKey),
    check('bids_type_check', sql`${t.type} IN ${sql.raw(inList(bidTypes))}`),
    check('bids_source_check', sql`${t.source} IN ${sql.raw(inList(bidSources))}`),
    check('bids_status_check', sql`${t.status} IN ${sql.raw(inList(bidStatuses))}`),
    check('bids_amount_check', sql`${t.amountCents} >= 0`),
  ],
)
