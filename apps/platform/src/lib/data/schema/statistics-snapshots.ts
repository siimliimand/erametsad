import { sql } from 'drizzle-orm'
import { check, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { auctionObjectTypes, inList } from './shared'

export const statisticsSnapshots = sqliteTable(
  'statistics_snapshots',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    date: text('date').notNull(),
    objectType: text('object_type', { enum: auctionObjectTypes }).notNull(),
    count: integer('count').notNull(),
    // Hectares and cubic metres are not money; REAL keeps their decimals.
    area: real('area'),
    volume: real('volume'),
    // Payload 'eur' money field; integer cents per the mapping rule.
    eurCents: integer('eur_cents').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('statistics_snapshots_date_object_type_unique').on(t.date, t.objectType),
    check(
      'statistics_snapshots_object_type_check',
      sql`${t.objectType} IN ${sql.raw(inList(auctionObjectTypes))}`,
    ),
    check(
      'statistics_snapshots_values_check',
      sql`${t.count} >= 0 AND ${t.area} >= 0 AND ${t.volume} >= 0 AND ${t.eurCents} >= 0`,
    ),
  ],
)
