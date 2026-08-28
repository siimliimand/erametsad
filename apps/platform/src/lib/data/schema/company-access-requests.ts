import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'
import { users } from './users'

export const companyAccessRequestStatuses = [
  'pending',
  'approved',
  'rejected',
  'held',
] as const
export type CompanyAccessRequestStatus = (typeof companyAccessRequestStatuses)[number]

export const companyAccessRequests = sqliteTable(
  'company_access_requests',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    regCode: text('reg_code').notNull(),
    companyName: text('company_name'),
    requesterName: text('requester_name'),
    requesterPhone: text('requester_phone'),
    requesterEmail: text('requester_email'),
    reason: text('reason'),
    status: text('status', { enum: companyAccessRequestStatuses }).notNull().default('pending'),
    reviewedBy: text('reviewed_by').references(() => users.id),
    reviewedAt: text('reviewed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('company_access_requests_status_idx').on(t.status),
    check(
      'company_access_requests_status_check',
      sql`${t.status} IN ${sql.raw(inList(companyAccessRequestStatuses))}`,
    ),
  ],
)
