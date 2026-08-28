import { sql } from 'drizzle-orm'
import { check, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'
import { users } from './users'

export const profileTypes = ['private', 'company'] as const
export type ProfileType = (typeof profileTypes)[number]

export const profileApprovalStatuses = ['pending', 'approved', 'rejected'] as const
export type ProfileApprovalStatus = (typeof profileApprovalStatuses)[number]

export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    type: text('type', { enum: profileTypes }).notNull(),
    approvalStatus: text('approval_status', { enum: profileApprovalStatuses })
      .notNull()
      .default('pending'),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    companyName: text('company_name'),
    companyRegCode: text('company_reg_code'),
    displayName: text('display_name'),
    phone: text('phone'),
    termsConsentAt: text('terms_consent_at'),
    privacyConsentAt: text('privacy_consent_at'),
    marketingConsentAt: text('marketing_consent_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('profiles_user_unique').on(t.userId),
    check('profiles_type_check', sql`${t.type} IN ${sql.raw(inList(profileTypes))}`),
    check(
      'profiles_approval_status_check',
      sql`${t.approvalStatus} IN ${sql.raw(inList(profileApprovalStatuses))}`,
    ),
  ],
)
