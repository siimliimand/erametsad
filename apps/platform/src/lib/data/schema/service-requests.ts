import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const serviceRequestTypes = ['kava', 'hooldusraie', 'istutamine'] as const
export type ServiceRequestType = (typeof serviceRequestTypes)[number]

export const serviceRequestStatuses = ['new', 'routed'] as const
export type ServiceRequestStatus = (typeof serviceRequestStatuses)[number]

export const serviceRequests = sqliteTable(
  'service_requests',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: text('type', { enum: serviceRequestTypes }).notNull(),
    payload: text('payload').notNull(),
    attachments: text('attachments'),
    routedTo: text('routed_to'),
    status: text('status', { enum: serviceRequestStatuses }).notNull().default('new'),
    consentAt: text('consent_at').notNull(),
    formName: text('form_name').notNull(),
    pageSlug: text('page_slug'),
    ipHash: text('ip_hash'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    index('service_requests_type_idx').on(t.type),
    index('service_requests_status_idx').on(t.status),
    index('service_requests_created_at_idx').on(t.createdAt),
    check('service_requests_type_check', sql`${t.type} IN ${sql.raw(inList(serviceRequestTypes))}`),
    check('service_requests_status_check', sql`${t.status} IN ${sql.raw(inList(serviceRequestStatuses))}`),
  ],
)
