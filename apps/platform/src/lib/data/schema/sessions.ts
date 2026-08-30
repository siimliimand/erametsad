import { sql } from 'drizzle-orm'
import { check, index, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { inList } from './shared'
import { userRoles, users } from './users'

// One row per login session, i.e. per refresh-token family: the row carries
// the current refresh hash (reuse of any older hash kills the family via
// revoked_at) and the hash of the newest access token minted for it. Access
// tokens embed the session id claim, so same-second issuances for one user
// can never collide on the unique access_token_hash index.
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),
    role: text('role', { enum: userRoles }).notNull(),
    profileId: text('profile_id'),
    tokenFamily: text('token_family').notNull(),
    accessTokenHash: text('access_token_hash').notNull(),
    refreshTokenHash: text('refresh_token_hash').notNull(),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [
    uniqueIndex('sessions_access_token_hash_unique').on(t.accessTokenHash),
    index('sessions_user_id_idx').on(t.userId),
    check('sessions_role_check', sql`${t.role} IN ${sql.raw(inList(userRoles))}`),
  ],
)
