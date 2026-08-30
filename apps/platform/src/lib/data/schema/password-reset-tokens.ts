import { index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { users } from './users'

// One row per forgot-password request. Only the SHA-256 hash of the one-time
// token is stored, so a database leak cannot reset any account; the raw token
// exists only in the emailed link. The single-use guarantee is enforced by the
// UPDATE ... WHERE used_at IS NULL AND expires_at > now statement in
// src/lib/auth/reset-tokens.ts, not by reads.
export const passwordResetTokens = sqliteTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    tokenHash: text('token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    usedAt: text('used_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('password_reset_tokens_token_hash_unique').on(t.tokenHash),
    index('password_reset_tokens_user_id_idx').on(t.userId),
  ],
)
