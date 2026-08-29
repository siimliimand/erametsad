import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import {
  openLocalD1,
  type LocalD1Handle,
} from '../../src/lib/data/seed/d1-local'

const execFileAsync = promisify(execFile)

export interface AuctionRow {
  id: string
  slug: string
  title: string
  status: string
  type: string
  object_type: string
  min_bid_cents: number
  bid_step_cents: number | null
  ends_at: string | null
}

export interface LeadingBidRow {
  id: string
  amount_cents: number
  idempotency_key: string | null
}

export interface VerificationState {
  auction: { status: string; ends_at: string | null }
  runBids: {
    id: string
    amount_cents: number
    idempotency_key: string | null
  }[]
  leadingBids: LeadingBidRow[]
  bidPlacedAuditTotal: number
  bidPlacedAuditAnomalies: { entity_id: string; n: number }[]
}

export interface D1Connection {
  mode: 'local' | 'remote'
  all<T>(sql: string, params?: readonly unknown[]): Promise<T[]>
  run(sql: string, params?: readonly unknown[]): Promise<void>
  close(): void
}

class LocalConnection implements D1Connection {
  readonly mode = 'local' as const

  constructor(private readonly handle: LocalD1Handle) {}

  all<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return Promise.resolve(this.handle.raw.prepare(sql).all(...params) as T[])
  }

  run(sql: string, params: readonly unknown[] = []): Promise<void> {
    this.handle.raw.prepare(sql).run(...params)
    return Promise.resolve()
  }

  close(): void {
    this.handle.close()
  }
}

function inlineLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return `'${value.replaceAll("'", "''")}'`
  throw new Error(`cannot inline a ${typeof value} literal for remote D1`)
}

/**
 * Remote mode shells out to `wrangler d1 execute DB --remote --json`, so SQL
 * reaches the real deployment's D1 without any local state file. Parameters
 * are inlined (they are always script-generated ids/prefixes, never user
 * input).
 */
class RemoteConnection implements D1Connection {
  readonly mode = 'remote' as const

  constructor(private readonly appRoot: string) {}

  private async execute(
    sql: string,
    params: readonly unknown[],
  ): Promise<unknown[]> {
    let finalSql = sql
    if (params.length > 0) {
      let index = 0
      finalSql = sql.replace(/\?/g, () =>
        inlineLiteral(params[index++] ?? null),
      )
    }
    const { stdout } = await execFileAsync(
      'pnpm',
      [
        'exec',
        'wrangler',
        'd1',
        'execute',
        'DB',
        '--remote',
        '--json',
        '--command',
        finalSql,
      ],
      { cwd: this.appRoot, timeout: 120_000, maxBuffer: 32 * 1024 * 1024 },
    )
    const parsed = JSON.parse(stdout) as { results?: unknown[] }[]
    const first = parsed[0]
    return first?.results ?? []
  }

  async all<T>(sql: string, params: readonly unknown[] = []): Promise<T[]> {
    return (await this.execute(sql, params)) as T[]
  }

  async run(sql: string, params: readonly unknown[] = []): Promise<void> {
    await this.execute(sql, params)
  }

  close(): void {
    /* nothing to close */
  }
}

export function openD1(
  mode: 'local' | 'remote',
  appRoot: string,
): D1Connection {
  return mode === 'local'
    ? new LocalConnection(openLocalD1(appRoot))
    : new RemoteConnection(appRoot)
}

export async function getAuction(
  conn: D1Connection,
  key: { id?: string | undefined; slug?: string | undefined },
): Promise<AuctionRow | null> {
  const rows = key.id
    ? await conn.all<AuctionRow>('SELECT * FROM auctions WHERE id = ?', [
        key.id,
      ])
    : await conn.all<AuctionRow>('SELECT * FROM auctions WHERE slug = ?', [
        key.slug,
      ])
  return rows[0] ?? null
}

/**
 * Puts the auction into the load-test scenario: active, ending inside the
 * anti-snipe window, no bids, no autobidders, no leftover end-state. Every
 * accepted leading bid then extends the end time (anti-snipe), so the run
 * keeps the auction open exactly like a real close-time duel.
 */
export async function resetAuctionForRun(
  conn: D1Connection,
  auctionId: string,
  closeInSeconds: number,
): Promise<{ endsAt: string }> {
  const endsAt = new Date(Date.now() + closeInSeconds * 1000).toISOString()
  const now = new Date().toISOString()
  await conn.run(
    "DELETE FROM audit_entries WHERE entity_type = 'bid' AND entity_id IN (SELECT id FROM bids WHERE auction_id = ?)",
    [auctionId],
  )
  await conn.run('DELETE FROM bids WHERE auction_id = ?', [auctionId])
  await conn.run('DELETE FROM autobidders WHERE auction_id = ?', [auctionId])
  await conn.run(
    `UPDATE auctions SET status = 'active', ends_at = ?, ended_at = NULL, appraised_at = NULL,
      winning_bid = NULL, final_price_cents = NULL, updated_at = ? WHERE id = ?`,
    [endsAt, now, auctionId],
  )
  return { endsAt }
}

export async function fetchVerificationState(
  conn: D1Connection,
  auctionId: string,
  idempotencyPrefix: string,
): Promise<VerificationState> {
  const pattern = `${idempotencyPrefix}-%`
  const auctionRows = await conn.all<{
    status: string
    ends_at: string | null
  }>('SELECT status, ends_at FROM auctions WHERE id = ?', [auctionId])
  const runBids = await conn.all<{
    id: string
    amount_cents: number
    idempotency_key: string | null
  }>(
    'SELECT id, amount_cents, idempotency_key FROM bids WHERE auction_id = ? AND idempotency_key LIKE ?',
    [auctionId, pattern],
  )
  const leadingBids = await conn.all<LeadingBidRow>(
    "SELECT id, amount_cents, idempotency_key FROM bids WHERE auction_id = ? AND status = 'leading'",
    [auctionId],
  )
  const auditTotalRows = await conn.all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM audit_entries
      WHERE action = 'bid_placed' AND entity_type = 'bid'
      AND entity_id IN (SELECT id FROM bids WHERE auction_id = ? AND idempotency_key LIKE ?)`,
    [auctionId, pattern],
  )
  const auditAnomalies = await conn.all<{ entity_id: string; n: number }>(
    `SELECT entity_id, COUNT(*) AS n FROM audit_entries
      WHERE action = 'bid_placed' AND entity_type = 'bid'
      AND entity_id IN (SELECT id FROM bids WHERE auction_id = ? AND idempotency_key LIKE ?)
      GROUP BY entity_id HAVING COUNT(*) <> 1`,
    [auctionId, pattern],
  )
  const auction = auctionRows[0]
  if (!auction) throw new Error(`auction ${auctionId} not found`)
  return {
    auction,
    runBids,
    leadingBids,
    bidPlacedAuditTotal: auditTotalRows[0]?.n ?? 0,
    bidPlacedAuditAnomalies: auditAnomalies,
  }
}
