import { desc, sql } from 'drizzle-orm'

import { auditEntries } from '../schema'
import type { CoreDatabase } from './repository'

/**
 * Canonical hash input for one audit entry: the stored field values in a
 * fixed array order, JSON.stringify-ed once. Concretely
 * `JSON.stringify([id, actorId, action, entityType, entityId, before, after,
 * createdAt, updatedAt, prevHash])` where before/after enter as their stored
 * TEXT-JSON strings and every absent value is JSON null. Fixed order plus
 * JSON escaping keeps the serialization stable across runs, so independent
 * verification only needs this file and the stored rows.
 */
function canonicalEntryString(values: Record<string, unknown>): string {
  return JSON.stringify([
    values.id ?? null,
    values.actorId ?? null,
    values.action ?? null,
    values.entityType ?? null,
    values.entityId ?? null,
    values.before ?? null,
    values.after ?? null,
    values.createdAt ?? null,
    values.updatedAt ?? null,
    values.prevHash ?? null,
  ])
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(input),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

/**
 * Extends the encoded audit-entry values with prevHash (hash of the current
 * chain head; null for the genesis entry) and hash. The log is append-only:
 * callers must not update or delete the row afterwards.
 *
 * Race note: two concurrent creates can read the same head and produce two
 * entries with a shared prevHash (a fork). Current writers are ordinary
 * request paths, not one serialized writer; a unique constraint on prev_hash
 * or a single-writer DO would close this and is deliberately left open here.
 */
export async function chainAuditEntry(
  db: CoreDatabase,
  values: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const head = await db
    .select({ hash: auditEntries.hash })
    .from(auditEntries)
    .orderBy(desc(sql`rowid`))
    .limit(1)
  const prevHash = head[0]?.hash ?? null
  // The id may still be undefined ($defaultFn runs at insert time); pin it so
  // the hash always covers the id that is actually stored.
  const id =
    typeof values.id === 'string' && values.id ? values.id : crypto.randomUUID()
  const withId = { ...values, id }
  const hash = await sha256Hex(canonicalEntryString({ ...withId, prevHash }))
  return { ...withId, prevHash, hash }
}
