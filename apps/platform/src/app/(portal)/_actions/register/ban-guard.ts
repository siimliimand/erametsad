// Isikukood-level registration guard for the permanent ban (task 8.4). The
// ban marker is the append-only `user.ban` audit entry on the matched user
// row, so the check never stores ban state outside the audit trail.

import { hash } from '@/lib/crypto'
import type { CoreRepositories } from '@/lib/data/repositories'

/** Neutral rejection copy: it must not confirm that a ban exists. */
export const BANNED_ISIKUKOOD_ERROR = 'Registreerimine ei õnnestunud. Probleemi korral pöörduge toe poole.'

/**
 * Returns the neutral rejection message when the isikukood belongs to a
 * banned user, or null when registration may proceed. Matched by the stored
 * isikukood hash, exactly like login and eID completion.
 */
export async function isikukoodBanError(
  repositories: CoreRepositories,
  isikukood: string,
): Promise<string | null> {
  const isikukoodHash = hash(isikukood)
  const { docs: matches } = await repositories.find({
    collection: 'users',
    where: { isikukoodHash: { equals: isikukoodHash } },
    limit: 1,
  })
  if (matches.length === 0) {
    return null
  }

  const { docs: bans } = await repositories.find({
    collection: 'audit-entry',
    where: {
      and: [
        { entityType: { equals: 'user' } },
        { entityId: { in: matches.map((user) => user.id) } },
        { action: { equals: 'user.ban' } },
      ],
    },
    limit: 1,
  })
  return bans.length > 0 ? BANNED_ISIKUKOOD_ERROR : null
}
