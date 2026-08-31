import { sql } from 'drizzle-orm'
import { check, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'

export const newsletterStatuses = ['pending', 'confirmed', 'unsubscribed'] as const
export type NewsletterStatus = (typeof newsletterStatuses)[number]

// Double opt-in: only the SHA-256 hash of the single-use token is stored,
// so a database leak cannot confirm or unsubscribe any address. The hash is
// nulled on use, which makes both the confirm and unsubscribe links
// single-use; nulls do not collide in the unique index.
export const newsletterSubscribers = sqliteTable(
  'newsletter_subscribers',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    email: text('email').notNull(),
    status: text('status', { enum: newsletterStatuses }).notNull().default('pending'),
    tokenHash: text('token_hash'),
    confirmedAt: text('confirmed_at'),
    unsubscribedAt: text('unsubscribed_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('newsletter_subscribers_email_unique').on(t.email),
    uniqueIndex('newsletter_subscribers_token_hash_unique').on(t.tokenHash),
    check(
      'newsletter_subscribers_status_check',
      sql`${t.status} IN ${sql.raw(inList(newsletterStatuses))}`,
    ),
  ],
)
