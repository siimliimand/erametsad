// Backfills prev_hash/hash for audit entries written before the hash chain
// existed (change admin-ui-demo-parity, task 15.2). Entries chain in rowid
// ASC order — the same order the live write path uses in
// src/lib/data/repositories/audit-chain.ts, so backfilled hashes match
// hashes produced at write time.
//
// Idempotent: rows that already carry a hash are never rewritten; the chain
// continues from the last already-chained row, so an interrupted run can be
// re-run safely and unchanged data yields identical hashes on every run.
// The full chain is verified after backfilling (or simulated, with --dry-run).
//
// Usage (from apps/platform):
//   pnpm exec tsx scripts/backfill-audit-chain.ts [--db-file <path>] [--dry-run]
// Default target is the local wrangler D1 sqlite file; --db-file points at
// any sqlite file (same convention as scripts/migrate-pg-to-d1/import-d1.ts).
// A remote D1 cannot be targeted from here; use wrangler d1 execute with a
// SQL file for that.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

import {
  hashAuditEntry,
  verifyChainRows,
  type AuditChainRow,
} from '../src/lib/data/repositories/audit-chain'

const D1_OBJECT_DIR = ['.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject']
const D1_FILE_PATTERN = /^[0-9a-f]{64}\.sqlite$/

const SELECT_SQL =
  'SELECT id, actor_id, action, entity_type, entity_id, before, after, ' +
  'created_at, updated_at, prev_hash, hash FROM audit_entries ORDER BY rowid'

interface ChainUpdate {
  id: string
  prevHash: string | null
  hash: string
}

function rowToChainRow(raw: Record<string, unknown>): AuditChainRow {
  return {
    id: String(raw.id),
    actorId: (raw.actor_id as string | null) ?? null,
    action: String(raw.action),
    entityType: (raw.entity_type as string | null) ?? null,
    entityId: (raw.entity_id as string | null) ?? null,
    before: (raw.before as string | null) ?? null,
    after: (raw.after as string | null) ?? null,
    createdAt: String(raw.created_at),
    updatedAt: String(raw.updated_at),
    prevHash: (raw.prev_hash as string | null) ?? null,
    hash: (raw.hash as string | null) ?? null,
  }
}

function discoverLocalD1File(appRoot: string): string {
  const objectDir = resolve(appRoot, ...D1_OBJECT_DIR)
  if (!existsSync(objectDir) || !statSync(objectDir).isDirectory()) {
    throw new Error(
      `No local D1 state at ${objectDir}. Run "pnpm db:migrate:local" first, or point --db-file at a sqlite file.`,
    )
  }
  const candidates = readdirSync(objectDir).filter((name) => D1_FILE_PATTERN.test(name))
  const candidate = candidates[0]
  if (candidates.length !== 1 || candidate === undefined) {
    throw new Error(
      `Expected exactly one local D1 database under ${objectDir}, found ${candidates.length}. Use --db-file to name one.`,
    )
  }
  return resolve(objectDir, candidate)
}

/**
 * Computes the updates that would chain every unhashed row. Already-chained
 * rows pin the chain head; an already-chained row whose prevHash disagrees
 * with the running head is reported as an error (fork or tampering) and
 * stops the run — append-only rows are never rewritten.
 */
async function planBackfill(
  rows: readonly AuditChainRow[],
): Promise<{ updates: ChainUpdate[]; error: string | null }> {
  const updates: ChainUpdate[] = []
  let expectedPrevHash: string | null = null
  for (const row of rows) {
    if (row.hash !== null) {
      if (row.prevHash !== expectedPrevHash) {
        return {
          updates,
          error:
            `entry ${row.id} already carries a hash but its prevHash does not match the ` +
            `current chain head (fork or tampering); refusing to continue`,
        }
      }
      expectedPrevHash = row.hash
      continue
    }
    const hash = await hashAuditEntry(row, expectedPrevHash)
    updates.push({ id: row.id, prevHash: expectedPrevHash, hash })
    expectedPrevHash = hash
  }
  return { updates, error: null }
}

function applyUpdates(db: DatabaseSync, updates: readonly ChainUpdate[]): void {
  const statement = db.prepare(
    'UPDATE audit_entries SET prev_hash = ?, hash = ? ' +
      'WHERE id = ? AND prev_hash IS NULL AND hash IS NULL',
  )
  db.exec('BEGIN')
  try {
    for (const update of updates) {
      statement.run(update.prevHash, update.hash, update.id)
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)
  const flag = (name: string): string | undefined => {
    const index = args.indexOf(name)
    return index !== -1 ? args[index + 1] : undefined
  }
  const dryRun = args.includes('--dry-run')
  const dbFile = args.includes('--db-file')
    ? resolve(process.cwd(), flag('--db-file') ?? 'scratch.sqlite')
    : discoverLocalD1File(process.cwd())

  const db = new DatabaseSync(dbFile)
  try {
    const rows = db
      .prepare(SELECT_SQL)
      .all()
      .map((raw) => rowToChainRow(raw as Record<string, unknown>))
    const chainedCount = rows.filter((row) => row.hash !== null).length
    console.log(
      `audit_entries: ${rows.length} row(s), ${chainedCount} already chained, ` +
        `${rows.length - chainedCount} to backfill`,
    )

    const plan = await planBackfill(rows)
    if (plan.error !== null) {
      console.error(`Backfill aborted: ${plan.error}`)
      return 1
    }
    console.log(`Planned ${plan.updates.length} update(s) in rowid ASC order`)

    if (dryRun) {
      const simulated = rows.map((row) => {
        const update = plan.updates.find((candidate) => candidate.id === row.id)
        return update ? { ...row, prevHash: update.prevHash, hash: update.hash } : row
      })
      const verification = await verifyChainRows(simulated)
      if (!verification.ok) {
        console.error(
          `Dry-run: simulated chain does NOT verify (first break at entry ` +
            `${verification.problem?.id}, ${verification.problem?.reason})`,
        )
        return 1
      }
      console.log(`Dry-run: simulated chain verifies OK (${String(verification.checked)} entr(y/ies)); no rows written`)
      return 0
    }

    applyUpdates(db, plan.updates)
    console.log(`Backfilled ${plan.updates.length} row(s)`)

    const verification = await verifyChainRows(
      db
        .prepare(SELECT_SQL)
        .all()
        .map((raw) => rowToChainRow(raw as Record<string, unknown>)),
    )
    if (!verification.ok) {
      console.error(
        `Chain verification FAILED after backfill (first break at entry ` +
          `${verification.problem?.id}, ${verification.problem?.reason})`,
      )
      return 1
    }
    console.log(`Chain verification OK (${String(verification.checked)} entr(y/ies))`)
    return 0
  } finally {
    db.close()
  }
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (isMain) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
