import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const userStatus = ['active', 'suspended'] as const
export const auctionStatus = [
  'draft',
  'scheduled',
  'active',
  'ended',
  'unsold',
  'contract',
  'completed',
  'archived',
] as const

export type UserStatus = (typeof userStatus)[number]
export type AuctionStatus = (typeof auctionStatus)[number]

function inList(values: readonly string[]): string {
  return `('${values.join("', '")}')`
}

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status', { enum: userStatus }).notNull().default('active'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('users_email_unique').on(t.email),
    check('users_status_check', sql`${t.status} IN ${sql.raw(inList(userStatus))}`),
  ],
)

export const auctions = sqliteTable(
  'auctions',
  {
    id: text('id').primaryKey(),
    sellerId: text('seller_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    status: text('status', { enum: auctionStatus }).notNull().default('draft'),
    startingPriceCents: integer('starting_price_cents').notNull(),
    currentPriceCents: integer('current_price_cents').notNull(),
    endsAt: text('ends_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('auctions_seller_idx').on(t.sellerId),
    check('auctions_status_check', sql`${t.status} IN ${sql.raw(inList(auctionStatus))}`),
    check(
      'auctions_prices_check',
      sql`${t.startingPriceCents} >= 0 AND ${t.currentPriceCents} >= ${t.startingPriceCents}`,
    ),
  ],
)

export const bids = sqliteTable(
  'bids',
  {
    id: text('id').primaryKey(),
    auctionId: text('auction_id')
      .notNull()
      .references(() => auctions.id),
    bidderId: text('bidder_id')
      .notNull()
      .references(() => users.id),
    amountCents: integer('amount_cents').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('bids_auction_idx').on(t.auctionId),
    check('bids_amount_check', sql`${t.amountCents} > 0`),
  ],
)
