import { eq } from 'drizzle-orm'

import { profiles, users } from '../schema'
import type { CoreDatabase } from './repository'

/**
 * D7 (change portal-parity-gap-closure): account deletion anonymizes, it
 * does not drop the row. Bids, contracts, consent log entries, and the
 * audit chain reference the user and are append-only, so the row must
 * survive; only the personal fields die. One helper serves the future
 * self-service deletion endpoint and any admin flow, so the wipe shape
 * cannot drift between callers.
 */

/** Tombstone address for an anonymized account; unique per user id. */
export function deletedEmailTombstone(userId: string): string {
  return `deleted-${userId}@invalid.local`
}

export interface AnonymizeUserOptions {
  now?: () => string
}

/**
 * Wipes the personal fields of one user in place: name and phone on the
 * account, the profile's personal fields (profiles has no address columns;
 * displayName/companyName/companyRegCode/phone are its PII), the
 * isikukood ciphertext columns and hash, and the password credential
 * columns. Email becomes the tombstone, status becomes 'deleted'. The row
 * itself, its bids, and its consents stay untouched; sessions are the
 * caller's concern (the deletion endpoint revokes them).
 */
export async function anonymizeUser(
  db: CoreDatabase,
  userId: string,
  options: AnonymizeUserOptions = {},
): Promise<void> {
  const timestamp = (options.now ?? (() => new Date().toISOString()))()
  await db
    .update(users)
    .set({
      email: deletedEmailTombstone(userId),
      name: null,
      phone: null,
      status: 'deleted',
      isikukoodEncrypted: null,
      isikukoodIv: null,
      isikukoodAuthTag: null,
      isikukoodHash: null,
      passwordHash: null,
      passwordSalt: null,
      updatedAt: timestamp,
    })
    .where(eq(users.id, userId))
  await db
    .update(profiles)
    .set({
      displayName: null,
      phone: null,
      companyName: null,
      companyRegCode: null,
      updatedAt: timestamp,
    })
    .where(eq(profiles.userId, userId))
}
