import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const contractTemplateTypes = ['framework', 'auction'] as const
export type ContractTemplateType = (typeof contractTemplateTypes)[number]

export const contractTemplates = sqliteTable(
  'contract_templates',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: text('name').notNull(),
    type: text('type', { enum: contractTemplateTypes }).notNull(),
    version: text('version').notNull(),
    placeholders: text('placeholders'),
    // FK lands in task 2.3 when the media table exists.
    docxFileId: text('docx_file_id'),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    // The active-template hook queries by type plus active.
    index('contract_templates_type_active_idx').on(t.type, t.active),
    check(
      'contract_templates_type_check',
      sql`${t.type} IN ${sql.raw(inList(contractTemplateTypes))}`,
    ),
  ],
)
