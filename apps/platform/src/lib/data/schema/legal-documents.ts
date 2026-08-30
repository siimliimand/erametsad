import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { contentStatuses } from './content'
import { inList } from './shared'

export const legalDocumentTypes = ['terms', 'privacy', 'cookies', 'contract'] as const
export type LegalDocumentType = (typeof legalDocumentTypes)[number]

export const legalDocuments = sqliteTable(
  'legal_documents',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    type: text('type', { enum: legalDocumentTypes }),
    // Payload richText; stored as TEXT per the jsonb mapping rule.
    content: text('content').notNull(),
    version: text('version'),
    effectiveDate: text('effective_date'),
    publishedAt: text('published_at'),
    status: text('status', { enum: contentStatuses }).notNull().default('draft'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('legal_documents_slug_unique').on(t.slug),
    index('legal_documents_type_idx').on(t.type),
    check(
      'legal_documents_type_check',
      sql`${t.type} IN ${sql.raw(inList(legalDocumentTypes))}`,
    ),
    check(
      'legal_documents_status_check',
      sql`${t.status} IN ${sql.raw(inList(contentStatuses))}`,
    ),
  ],
)
