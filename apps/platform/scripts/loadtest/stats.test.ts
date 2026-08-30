import { describe, expect, it } from 'vitest'

import {
  formatPhaseLine,
  maxAcceptedAmountCents,
  percentile,
  statusLabel,
  summarizePhase,
  summarizeRun,
  type RequestRecord,
} from './stats'

function record(
  overrides: Partial<RequestRecord> & { amountCents: number },
): RequestRecord {
  return {
    phase: 'trickle',
    vu: 0,
    idempotencyKey: `k-${String(overrides.amountCents)}`,
    status: 201,
    latencyMs: 10,
    accepted: true,
    error: undefined,
    ...overrides,
  }
}

describe('percentile', () => {
  it('uses nearest-rank on ascending input', () => {
    const values = [10, 20, 30, 40]
    expect(percentile(values, 50)).toBe(20)
    expect(percentile(values, 100)).toBe(40)
    expect(percentile(values, 1)).toBe(10)
  })

  it('computes p95/p99 over a 100-sample ramp', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1)
    expect(percentile(values, 95)).toBe(95)
    expect(percentile(values, 99)).toBe(99)
  })

  it('rejects empty samples and out-of-range p', () => {
    expect(() => percentile([], 50)).toThrow()
    expect(() => percentile([1], 0)).toThrow()
    expect(() => percentile([1], 101)).toThrow()
    expect(() => percentile([1], Number.NaN)).toThrow()
  })
})

describe('statusLabel', () => {
  it('maps 0 to network-error and keeps codes as strings', () => {
    expect(statusLabel(0)).toBe('network-error')
    expect(statusLabel(201)).toBe('201')
    expect(statusLabel(400)).toBe('400')
  })
})

describe('summarizePhase', () => {
  const records: RequestRecord[] = [
    record({ amountCents: 100, status: 201, latencyMs: 10, phase: 'trickle' }),
    record({ amountCents: 200, status: 201, latencyMs: 20, phase: 'trickle' }),
    record({
      amountCents: 300,
      status: 400,
      accepted: false,
      latencyMs: 30,
      phase: 'trickle',
      error: 'too low',
    }),
    record({
      amountCents: 400,
      status: 500,
      accepted: false,
      latencyMs: 40,
      phase: 'trickle',
    }),
    record({
      amountCents: 500,
      status: 0,
      accepted: false,
      latencyMs: 50,
      phase: 'burst',
    }),
  ]

  it('splits accepted, rejected, and error counts by phase', () => {
    const trickle = summarizePhase(records, 'trickle', 1000)
    expect(trickle.total).toBe(4)
    expect(trickle.accepted).toBe(2)
    expect(trickle.rejected).toBe(1)
    expect(trickle.errors).toBe(1)
    expect(trickle.statusHistogram).toEqual({ '201': 2, '400': 1, '500': 1 })
    expect(trickle.requestsPerSecond).toBe(4)
    expect(trickle.acceptedPerSecond).toBe(2)
  })

  it('computes latency percentiles from the phase latencies', () => {
    const trickle = summarizePhase(records, 'trickle', 1000)
    expect(trickle.latencyMs.min).toBe(10)
    expect(trickle.latencyMs.max).toBe(40)
    expect(trickle.latencyMs.mean).toBe(25)
    expect(trickle.latencyMs.p50).toBe(20)
    expect(trickle.latencyMs.p95).toBe(40)
    expect(trickle.latencyMs.p99).toBe(40)
  })

  it('treats network failure (status 0) as an error, not a rejection', () => {
    const burst = summarizePhase(records, 'burst', 500)
    expect(burst.total).toBe(1)
    expect(burst.accepted).toBe(0)
    expect(burst.rejected).toBe(0)
    expect(burst.errors).toBe(1)
    expect(burst.statusHistogram).toEqual({ 'network-error': 1 })
  })

  it('returns zeroed latency for an empty phase', () => {
    const empty = summarizePhase([], 'burst', 0)
    expect(empty.total).toBe(0)
    expect(empty.latencyMs.p99).toBe(0)
  })
})

describe('summarizeRun and maxAcceptedAmountCents', () => {
  const records: RequestRecord[] = [
    record({ amountCents: 100, status: 201 }),
    record({ amountCents: 500, status: 201, latencyMs: 80 }),
    record({ amountCents: 200, status: 400, accepted: false }),
  ]

  it('aggregates phases and tracks the highest accepted amount', () => {
    const summary = summarizeRun(records, { trickleMs: 100, burstMs: 0 })
    expect(summary.totalAccepted).toBe(2)
    expect(summary.totalRejected).toBe(1)
    expect(summary.totalErrors).toBe(0)
    expect(summary.maxAcceptedAmountCents).toBe(500)
    expect(maxAcceptedAmountCents([])).toBeNull()
  })
})

describe('formatPhaseLine', () => {
  it('renders counts, percentiles, and a sorted status histogram', () => {
    const summary = summarizePhase(
      [
        record({ amountCents: 100, status: 201, latencyMs: 5 }),
        record({
          amountCents: 200,
          status: 400,
          accepted: false,
          latencyMs: 7,
        }),
      ],
      'trickle',
      100,
    )
    const line = formatPhaseLine(summary)
    expect(line).toContain('trickle')
    expect(line).toContain('n=   2')
    expect(line).toContain('acc=   1')
    expect(line).toContain('201:1 400:1')
  })
})
