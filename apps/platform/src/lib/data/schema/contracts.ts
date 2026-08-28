import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { auctions } from './auctions'
import { contractTemplates } from './contract-templates'
import { inList } from './shared'
import { users } from './users'

export const contractStatuses = ['prepared', 'sent', 'signed', 'voided'] as const
export type ContractStatus = (typeof contractStatuses)[number]

export const contracts = sqliteTable(
  'contracts',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    templateId: text('template_id')
      .notNull()
      .references(() => contractTemplates.id),
    lotId: text('lot_id')
      .notNull()
      .references(() => auctions.id),
    status: text('status', { enum: contractStatuses }).notNull().default('prepared'),
    signedAt: text('signed_at'),
    signedBy: text('signed_by').references(() => users.id),
    contentHash: text('content_hash'),
    renderedHtml: text('rendered_html'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('contracts_lot_idx').on(t.lotId),
    index('contracts_template_idx').on(t.templateId),
    check('contracts_status_check', sql`${t.status} IN ${sql.raw(inList(contractStatuses))}`),
  ],
)
