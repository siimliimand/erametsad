import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const leadStatuses = ['new', 'contacted', 'qualified', 'contract', 'disqualified'] as const
export type LeadStatus = (typeof leadStatuses)[number]

export const leads = sqliteTable(
  'leads',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    formName: text('form_name').notNull(),
    pageSlug: text('page_slug'),
    contactName: text('contact_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    cadastr: text('cadastr'),
    consentAt: text('consent_at').notNull(),
    source: text('source'),
    status: text('status', { enum: leadStatuses }).notNull().default('new'),
    ipHash: text('ip_hash'),
    // FK lands in task 2.3 when the specialists table exists.
    assignedSpecialistId: text('assigned_specialist_id'),
    internalComment: text('internal_comment'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('leads_status_idx').on(t.status),
    index('leads_assigned_specialist_idx').on(t.assignedSpecialistId),
    check('leads_status_check', sql`${t.status} IN ${sql.raw(inList(leadStatuses))}`),
  ],
)
