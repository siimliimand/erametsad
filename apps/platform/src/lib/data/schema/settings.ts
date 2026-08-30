import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const settings = sqliteTable(
  'settings',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    orgName: text('org_name'),
    orgRegCode: text('org_reg_code'),
    orgAddress: text('org_address'),
    feePercent: integer('fee_percent').notNull().default(3),
    vatPercent: integer('vat_percent').notNull().default(22),
    antiSnipeDurationMinutes: integer('anti_snipe_duration_minutes').notNull().default(5),
    alapakkumineEnabled: integer('alapakkumine_enabled', { mode: 'boolean' })
      .notNull()
      .default(true),
    sealedRevisionCap: integer('sealed_revision_cap').notNull().default(3),
    featureFlags: text('feature_flags'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [check('settings_fee_percent_check', sql`${t.feePercent} >= 0 AND ${t.feePercent} <= 100`)],
)
