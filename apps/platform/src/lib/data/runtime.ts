import { drizzle } from 'drizzle-orm/d1'

import type { AccessTokenPayload } from '../auth/jwt'
import { getD1Database } from '../db'
import { GUARD_ROLES, publicContext, userContext, type GuardContext, type GuardRole } from './guards'
import { createCoreRepositories, nodeIsikukoodCodec, type CoreRepositories } from './repositories'
import * as schema from './schema'

/**
 * Per-request repositories over the D1 `DB` binding. Called without a
 * guard context the repositories run as a trusted system caller — the
 * semantics of the Payload local API calls this layer replaces (the local
 * API bypasses access control by default). Pass a guard context to
 * enforce the ported Payload access rules for a user or public caller.
 */
export async function getRepositories(guard?: GuardContext): Promise<CoreRepositories> {
  const d1 = await getD1Database()
  // The runtime DbDatabase declaration in src/lib/db.ts is narrower than
  // drizzle's D1Database type (no run/raw/first); the driver only needs
  // prepare/bind/all/batch for the statements repositories issue.
  const database = drizzle(d1 as unknown as Parameters<typeof drizzle>[0], { schema })
  return createCoreRepositories(database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: (statements) => database.batch(statements),
    ...(guard !== undefined ? { guardContext: guard } : {}),
  })
}

function toGuardRole(role: string): GuardRole {
  return GUARD_ROLES.includes(role as GuardRole) ? (role as GuardRole) : 'guest'
}

/**
 * Maps a verified access-token payload onto a guard context the way routes
 * read the session (access_token cookie verified with verifyAccessToken):
 * a valid token becomes that user, anything else a public caller.
 */
export function sessionGuardContext(token: AccessTokenPayload | null): GuardContext {
  if (!token) return publicContext
  return userContext(token.userId, toGuardRole(token.role))
}
