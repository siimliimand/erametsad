import type { D1Connection, VerificationState } from './d1'
import { fetchVerificationState } from './d1'
import type { RunSummary } from './stats'

export interface CheckResult {
  name: string
  pass: boolean
  detail: string
}

function firstKeys(keys: string[], count: number): string {
  return keys.slice(0, count).join(', ')
}

/**
 * D1 consistency checks after a run, against the rows the run produced
 * (idempotency-key scoped) plus the auction-level invariants the DO
 * serialization must uphold.
 */
export function checkState(
  run: RunSummary,
  state: VerificationState,
): CheckResult[] {
  const accepted = run.records.filter((record) => record.accepted)
  const acceptedKeys = new Set(accepted.map((record) => record.idempotencyKey))
  const rowKeys = state.runBids.map((bid) => bid.idempotency_key ?? '')
  const missing = accepted.filter(
    (record) => !rowKeys.includes(record.idempotencyKey),
  )
  const extra = rowKeys.filter((key) => !acceptedKeys.has(key))
  const maxRowCents = state.runBids.reduce(
    (max, bid) => Math.max(max, bid.amount_cents),
    Number.NEGATIVE_INFINITY,
  )
  const leading = state.leadingBids

  const checks: CheckResult[] = []

  checks.push({
    name: 'accepted-bids-in-d1',
    pass: missing.length === 0 && extra.length === 0,
    detail:
      `http_accepted=${String(accepted.length)} d1_rows=${String(state.runBids.length)}` +
      (missing.length > 0
        ? ` missing=[${firstKeys(
            missing.map((r) => r.idempotencyKey),
            3,
          )}]`
        : '') +
      (extra.length > 0 ? ` extra=[${firstKeys(extra, 3)}]` : ''),
  })

  checks.push({
    name: 'no-duplicate-bid-writes',
    pass: new Set(rowKeys).size === rowKeys.length,
    detail: `rows=${String(rowKeys.length)} distinct_keys=${String(new Set(rowKeys).size)}`,
  })

  const singleLeading =
    leading.length === 1 &&
    (run.summary.maxAcceptedAmountCents === null ||
      leading[0]?.amount_cents === run.summary.maxAcceptedAmountCents) &&
    (state.runBids.length === 0 || leading[0]?.amount_cents === maxRowCents)
  checks.push({
    name: 'single-leading-bid-at-max',
    pass: singleLeading,
    detail:
      `leading_rows=${String(leading.length)}` +
      (leading[0] !== undefined
        ? ` leading_cents=${String(leading[0].amount_cents)} max_http_cents=${String(run.summary.maxAcceptedAmountCents)} max_row_cents=${Number.isFinite(maxRowCents) ? String(maxRowCents) : 'none'}`
        : ''),
  })

  const auditOk =
    state.bidPlacedAuditTotal === state.runBids.length &&
    state.bidPlacedAuditAnomalies.length === 0
  checks.push({
    name: 'audit-chain-one-entry-per-bid',
    pass: auditOk,
    detail:
      `bid_placed_entries=${String(state.bidPlacedAuditTotal)} d1_rows=${String(state.runBids.length)}` +
      (state.bidPlacedAuditAnomalies.length > 0
        ? ` anomalies=${JSON.stringify(state.bidPlacedAuditAnomalies.slice(0, 3))}`
        : ''),
  })

  checks.push({
    name: 'auction-still-active',
    pass: state.auction.status === 'active',
    detail: `status=${state.auction.status} ends_at=${state.auction.ends_at ?? 'null'}`,
  })

  const serverErrors = run.records.filter(
    (record) => record.status === 0 || record.status >= 500,
  )
  checks.push({
    name: 'no-server-or-network-errors',
    pass: serverErrors.length === 0,
    detail:
      serverErrors.length === 0
        ? 'none'
        : firstKeys(
            serverErrors.map(
              (record) =>
                `${record.idempotencyKey}:${record.status === 0 ? 'network' : String(record.status)}`,
            ),
            5,
          ),
  })

  return checks
}

export async function verifyRun(
  conn: D1Connection,
  run: RunSummary,
): Promise<CheckResult[]> {
  const state = await fetchVerificationState(conn, run.auctionId, run.runId)
  return checkState(run, state)
}
