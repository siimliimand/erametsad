export type PhaseName = 'trickle' | 'burst'

/** One bid POST as measured from the load-test client. */
export interface RequestRecord {
  phase: PhaseName
  vu: number
  amountCents: number
  idempotencyKey: string
  /** HTTP status; 0 means the request never completed (network error or timeout). */
  status: number
  latencyMs: number
  accepted: boolean
  error?: string | undefined
}

export interface LatencyStats {
  min: number
  mean: number
  p50: number
  p95: number
  p99: number
  max: number
}

export interface PhaseSummary {
  phase: PhaseName
  total: number
  accepted: number
  rejected: number
  errors: number
  statusHistogram: Record<string, number>
  latencyMs: LatencyStats
  wallMs: number
  requestsPerSecond: number
  acceptedPerSecond: number
}

export interface RunSummary {
  label: string
  base: string
  auctionId: string
  runId: string
  startedAt: string
  config: {
    vus: number
    pool: string[]
    trickle: number
    trickleConcurrency: number
    burst: number
    rampMs: number
    timeoutMs: number
    startFloorCents: number
    stepCents: number
  }
  records: RequestRecord[]
  walls: { trickleMs: number; burstMs: number }
  summary: {
    trickle: PhaseSummary
    burst: PhaseSummary
    totalAccepted: number
    totalRejected: number
    totalErrors: number
    maxAcceptedAmountCents: number | null
  }
}

export function statusLabel(status: number): string {
  return status === 0 ? 'network-error' : String(status)
}

/**
 * Nearest-rank percentile over an ASCENDING-sorted array.
 * p50 of [10, 20, 30, 40] is 20 (rank ceil(0.5*4) = 2).
 */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) throw new Error('percentile of an empty sample')
  if (p <= 0 || p > 100 || !Number.isFinite(p)) {
    throw new Error(`p must be in (0, 100], got ${String(p)}`)
  }
  const rank = Math.ceil((p / 100) * sorted.length)
  const value = sorted.at(Math.min(rank, sorted.length) - 1)
  if (value === undefined) throw new Error('percentile rank out of range')
  return value
}

function latencyStats(values: readonly number[]): LatencyStats {
  if (values.length === 0) {
    return { min: 0, mean: 0, p50: 0, p95: 0, p99: 0, max: 0 }
  }
  const sorted = [...values].sort((a, b) => a - b)
  const sum = sorted.reduce((acc, value) => acc + value, 0)
  return {
    min: sorted[0] ?? 0,
    mean: Number((sum / sorted.length).toFixed(2)),
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: sorted[sorted.length - 1] ?? 0,
  }
}

export function summarizePhase(
  records: readonly RequestRecord[],
  phase: PhaseName,
  wallMs: number,
): PhaseSummary {
  const phaseRecords = records.filter((record) => record.phase === phase)
  const accepted = phaseRecords.filter((record) => record.accepted).length
  const errors = phaseRecords.filter(
    (record) => record.status === 0 || record.status >= 500,
  ).length
  const rejected = phaseRecords.length - accepted - errors
  const histogram: Record<string, number> = {}
  for (const record of phaseRecords) {
    const label = statusLabel(record.status)
    histogram[label] = (histogram[label] ?? 0) + 1
  }
  const wallSeconds = wallMs / 1000
  return {
    phase,
    total: phaseRecords.length,
    accepted,
    rejected,
    errors,
    statusHistogram: histogram,
    latencyMs: latencyStats(phaseRecords.map((record) => record.latencyMs)),
    wallMs: Math.round(wallMs),
    requestsPerSecond:
      wallSeconds > 0
        ? Number((phaseRecords.length / wallSeconds).toFixed(1))
        : 0,
    acceptedPerSecond:
      wallSeconds > 0 ? Number((accepted / wallSeconds).toFixed(1)) : 0,
  }
}

export function maxAcceptedAmountCents(
  records: readonly RequestRecord[],
): number | null {
  let max: number | null = null
  for (const record of records) {
    if (record.accepted && (max === null || record.amountCents > max)) {
      max = record.amountCents
    }
  }
  return max
}

export function summarizeRun(
  records: readonly RequestRecord[],
  walls: { trickleMs: number; burstMs: number },
): RunSummary['summary'] {
  const acceptedRecords = records.filter((record) => record.accepted)
  const errorCount = records.filter(
    (record) => record.status === 0 || record.status >= 500,
  ).length
  return {
    trickle: summarizePhase(records, 'trickle', walls.trickleMs),
    burst: summarizePhase(records, 'burst', walls.burstMs),
    totalAccepted: acceptedRecords.length,
    totalRejected: records.length - acceptedRecords.length - errorCount,
    totalErrors: errorCount,
    maxAcceptedAmountCents: maxAcceptedAmountCents(records),
  }
}

/** Fixed-width console table row for one phase; pure so tests can pin it. */
export function formatPhaseLine(summary: PhaseSummary): string {
  const histogram = Object.entries(summary.statusHistogram)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, count]) => `${code}:${String(count)}`)
    .join(' ')
  return [
    summary.phase.padEnd(7),
    `n=${String(summary.total).padStart(4)}`,
    `acc=${String(summary.accepted).padStart(4)}`,
    `rej=${String(summary.rejected).padStart(4)}`,
    `err=${String(summary.errors).padStart(2)}`,
    `p50=${summary.latencyMs.p50.toFixed(1).padStart(8)}ms`,
    `p95=${summary.latencyMs.p95.toFixed(1).padStart(8)}ms`,
    `p99=${summary.latencyMs.p99.toFixed(1).padStart(8)}ms`,
    `max=${summary.latencyMs.max.toFixed(1).padStart(9)}ms`,
    `rps=${String(summary.requestsPerSecond).padStart(6)}`,
    `[${histogram}]`,
  ].join(' ')
}
