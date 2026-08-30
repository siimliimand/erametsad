import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { auctionObjectTypes, inList } from './shared'
import { users } from './users'

export const auctionStatuses = [
  'draft',
  'scheduled',
  'active',
  'ended',
  'appraised',
  'unsold',
  'contract',
  'completed',
  'archived',
] as const
export type AuctionStatus = (typeof auctionStatuses)[number]

export const auctionTypes = ['open', 'sealed'] as const
export type AuctionType = (typeof auctionTypes)[number]

export const auctions = sqliteTable(
  'auctions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    status: text('status', { enum: auctionStatuses }).notNull().default('draft'),
    objectType: text('object_type', { enum: auctionObjectTypes }).notNull(),
    type: text('type', { enum: auctionTypes }).notNull().default('open'),
    isQuickAuction: integer('is_quick_auction', { mode: 'boolean' }).notNull().default(false),
    endYear: integer('end_year'),
    // FKs land in task 2.3 when the counties/parishes/specialists tables exist.
    countyId: text('county_id'),
    parishId: text('parish_id'),
    address: text('address'),
    coordinates: text('coordinates'),
    katasterLink: text('kataster_link'),
    metsaregisterLink: text('metsaregister_link'),
    cadastres: text('cadastres'),
    registryNumbers: text('registry_numbers'),
    species: text('species'),
    loggingTypes: text('logging_types'),
    compartments: text('compartments'),
    notifications: text('notifications'),
    deadlines: text('deadlines'),
    minBidCents: integer('min_bid_cents').notNull(),
    bidStepCents: integer('bid_step_cents'),
    reservePriceCents: integer('reserve_price_cents'),
    finalPriceCents: integer('final_price_cents'),
    feeOverridePercent: integer('fee_override_percent'),
    vatIncluded: integer('vat_included', { mode: 'boolean' }).notNull().default(true),
    descriptionPublic: text('description_public'),
    descriptionInternal: text('description_internal'),
    aliasEmail: text('alias_email'),
    media: text('media'),
    files: text('files'),
    packageHeader: text('package_header'),
    packageRows: text('package_rows'),
    packageColumns: text('package_columns'),
    specialistId: text('specialist_id'),
    sellerId: text('seller_id').references(() => users.id),
    // Plain text forward ref, as in Payload; an FK would be circular with bids.
    winningBid: text('winning_bid'),
    startsAt: text('starts_at'),
    endsAt: text('ends_at'),
    scheduledAt: text('scheduled_at'),
    activatedAt: text('activated_at'),
    endedAt: text('ended_at'),
    completedAt: text('completed_at'),
    appraisedAt: text('appraised_at'),
    contractAt: text('contract_at'),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('auctions_slug_unique').on(t.slug),
    index('auctions_status_ends_at_idx').on(t.status, t.endsAt),
    index('auctions_object_type_idx').on(t.objectType),
    index('auctions_seller_idx').on(t.sellerId),
    check('auctions_status_check', sql`${t.status} IN ${sql.raw(inList(auctionStatuses))}`),
    check(
      'auctions_object_type_check',
      sql`${t.objectType} IN ${sql.raw(inList(auctionObjectTypes))}`,
    ),
    check('auctions_type_check', sql`${t.type} IN ${sql.raw(inList(auctionTypes))}`),
    check(
      'auctions_prices_check',
      sql`${t.minBidCents} >= 0 AND ${t.bidStepCents} >= 0 AND ${t.reservePriceCents} >= 0 AND ${t.finalPriceCents} >= 0`,
    ),
  ],
)
