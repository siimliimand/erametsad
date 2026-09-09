import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable(
  'settings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgName: text('org_name'),
    orgRegCode: text('org_reg_code'),
    orgVatCode: text('org_vat_code'),
    orgAddress: text('org_address'),
    supportEmail: text('support_email'),
    supportPhone: text('support_phone'),
    aliasDomain: text('alias_domain'),
    feePercent: integer('fee_percent').notNull().default(3),
    // Quick-auction fee override; null falls back to the default feePercent.
    quickAuctionFeePercent: integer('quick_auction_fee_percent'),
    // Minimum service fee in euro cents; 0 disables the floor.
    minimumFeeCents: integer('minimum_fee_cents').notNull().default(0),
    vatPercent: integer('vat_percent').notNull().default(22),
    antiSnipeDurationMinutes: integer('anti_snipe_duration_minutes').notNull().default(5),
    autobidderEnabled: integer('autobidder_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    minAuctionDurationHours: integer('min_auction_duration_hours').notNull().default(1),
    alapakkumineEnabled: integer('alapakkumine_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    maintenanceEnabled: integer('maintenance_enabled', { mode: 'boolean' })
      .notNull()
      .default(false),
    sealedRevisionCap: integer('sealed_revision_cap').notNull().default(3),
    featureFlags: text('feature_flags'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    check('settings_fee_percent_check', sql`${t.feePercent} >= 0 AND ${t.feePercent} <= 100`),
    check(
      'settings_quick_auction_fee_percent_check',
      sql`${t.quickAuctionFeePercent} >= 0 AND ${t.quickAuctionFeePercent} <= 10`,
    ),
    check('settings_minimum_fee_cents_check', sql`${t.minimumFeeCents} >= 0`),
  ],
)
