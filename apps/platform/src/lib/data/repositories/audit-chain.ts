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
/**
 * Hash input: either the encoded write values or a stored row read back
 * (AuditChainRow). Both carry the same keys; absent values are JSON null.
 */
type HashableEntry = AuditChainRow | Record<string, unknown>

function canonicalEntryString(values: HashableEntry): string {
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
/**
 * Hash for one audit entry at the given chain position. Exported so the
 * backfill script and chain verification hash with exactly the same
 * serialization as the live write path.
 */
export async function hashAuditEntry(
  values: HashableEntry,
  prevHash: string | null,
): Promise<string> {
  return sha256Hex(canonicalEntryString({ ...values, prevHash }))
}

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
  const hash = await hashAuditEntry(withId, prevHash)
  return { ...withId, prevHash, hash }
}

/**
 * One stored audit row in the shape the chain hashes. before/after are the
 * stored TEXT-JSON strings, exactly as serialized at write time — never the
 * decoded JSON values.
 */
export interface AuditChainRow {
  id: string
  actorId: string | null
  action: string
  entityType: string | null
  entityId: string | null
  before: string | null
  after: string | null
  createdAt: string
  updatedAt: string
  prevHash: string | null
  hash: string | null
}

export type AuditChainBreakReason =
  | 'missing_hash'
  | 'prev_hash_mismatch'
  | 'hash_mismatch'

export interface AuditChainVerification {
  ok: boolean
  /** Entries verified before the first break; equals total when ok. */
  checked: number
  total: number
  problem: { id: string; index: number; reason: AuditChainBreakReason } | null
}

/**
 * Walks the chain in row order, recomputing each hash. Rows are expected in
 * chronological order (rowid ASC — the order chainAuditEntry chains in);
 * every entry after the first break fails by construction. Pure over its
 * input, so the backfill script can verify an in-memory simulated chain.
 */
export async function verifyChainRows(
  rows: readonly AuditChainRow[],
): Promise<AuditChainVerification> {
  let expectedPrevHash: string | null = null
  for (const [index, row] of rows.entries()) {
    // A null prevHash is the legitimate genesis marker; only a missing hash
    // means the entry was never chained.
    if (row.hash === null) {
      return {
        ok: false,
        checked: index,
        total: rows.length,
        problem: { id: row.id, index, reason: 'missing_hash' },
      }
    }
    if (row.prevHash !== expectedPrevHash) {
      return {
        ok: false,
        checked: index,
        total: rows.length,
        problem: { id: row.id, index, reason: 'prev_hash_mismatch' },
      }
    }
    const recomputed = await hashAuditEntry(row, row.prevHash)
    if (recomputed !== row.hash) {
      return {
        ok: false,
        checked: index,
        total: rows.length,
        problem: { id: row.id, index, reason: 'hash_mismatch' },
      }
    }
    expectedPrevHash = row.hash
  }
  return { ok: true, checked: rows.length, total: rows.length, problem: null }
}

/** Verifies the stored chain over the raw (undecoded) audit rows. */
export async function verifyAuditChain(
  db: CoreDatabase,
): Promise<AuditChainVerification> {
  const rows = await db
    .select({
      id: auditEntries.id,
      actorId: auditEntries.actorId,
      action: auditEntries.action,
      entityType: auditEntries.entityType,
      entityId: auditEntries.entityId,
      before: auditEntries.before,
      after: auditEntries.after,
      createdAt: auditEntries.createdAt,
      updatedAt: auditEntries.updatedAt,
      prevHash: auditEntries.prevHash,
      hash: auditEntries.hash,
    })
    .from(auditEntries)
    .orderBy(sql`rowid`)
  return verifyChainRows(rows)
}
