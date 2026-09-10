import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StaffRole } from '../../../_lib/permissions'
import {
  BIDS_SPARKLINE_DAYS,
  RECENT_LEAD_LIMIT,
  approvalSplitSubline,
  auctionScopeWhere,
  bidDailyCounts,
  bidTrendChangePercent,
  bidTrendSubline,
  bidsSince,
  bidsTodayCounts,
  buildQuickActions,
  buildWorkspaceKpis,
  buildWorkspaceQueues,
  countByStatus,
  countNewLeadsToday,
  endingTodayAuctions,
  endingTodayRows,
  getWorkspaceData,
  isAdminRole,
  isEndingToday,
  isNewLeadRow,
  leadScopeWhere,
  monthServiceFeeCents,
  newRequestsCountLabel,
  oldestPendingUnderbidDays,
  recentLeadRows,
  scheduledAuctionsSubline,
  sealedAwaitingCeremony,
  sentContractsCountLabel,
  startOfDayMs,
  startOfTallinnDayMs,
  startOfMonthMs,
  successFeeCents,
  successFeeExVatCents,
  underbidPendingNote,
  type WorkspaceAuctionSlice,
  type WorkspaceBidSlice,
  type WorkspaceData,
  type WorkspaceKpiInput,
  type WorkspaceLeadSlice,
  type WorkspaceQuickActionInput,
  type WorkspaceQueueInput,
} from '../workspace'


const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
const NOW = new Date('2026-09-08T10:30:00.000Z').getTime()
/** Europe/Tallinn is UTC+3 in September and UTC+2 in January. */
const TALLINN_DAY_START = new Date('2026-09-07T21:00:00.000Z').getTime()
const TALLINN_YESTERDAY_START = new Date('2026-09-06T21:00:00.000Z').getTime()

function iso(ms: number): string {
  return new Date(ms).toISOString()
}

let auctionSeq = 0
function auction(overrides: Partial<WorkspaceAuctionSlice> = {}): WorkspaceAuctionSlice {
  auctionSeq += 1
  return {
    id: `auction-${String(auctionSeq)}`,
    title: 'Metsaoksjon',
    status: 'active',
    type: 'open',
    objectType: 'raieoigus',
    endsAt: null,
    completedAt: null,
    finalPriceCents: null,
    feeOverridePercent: null,
    specialistId: null,
    sellerId: null,
    ...overrides,
  }
}

let bidSeq = 0
function bid(overrides: Partial<WorkspaceBidSlice> = {}): WorkspaceBidSlice {
  bidSeq += 1
  return {
    id: `bid-${String(bidSeq)}`,
    auctionId: 'auction-1',
    amountCents: 10_000,
    type: 'manual',
    status: 'leading',
    createdAt: iso(NOW - 60_000),
    ...overrides,
  }
}

function lead(overrides: Partial<WorkspaceLeadSlice> = {}): WorkspaceLeadSlice {
  return {
    id: 'lead-1',
    contactName: 'Mari Maasikas',
    formName: 'Metsa müük',
    source: null,
    status: 'new',
    countyId: null,
    assignedSpecialistId: null,
    createdAt: iso(NOW - 60_000),
    ...overrides,
  }
}

function assertFiniteNumbers(value: unknown): void {
  if (typeof value === 'number') {
    expect(Number.isFinite(value), `expected a finite number, got ${String(value)}`).toBe(true)
  } else if (Array.isArray(value)) {
    for (const item of value) assertFiniteNumbers(item)
  } else if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) assertFiniteNumbers(item)
  }
}

describe('ending-window filters', () => {
  it('uses the Europe/Tallinn calendar day for "Lõpevad täna"', () => {
    expect(startOfTallinnDayMs(NOW)).toBe(TALLINN_DAY_START)

    // Ends today inside the Tallinn day.
    expect(isEndingToday(iso(TALLINN_DAY_START), NOW)).toBe(true)
    expect(isEndingToday(iso(NOW + HOUR_MS), NOW)).toBe(true)
    // Spec scenario: tomorrow 00:30 Europe/Tallinn is not today.
    expect(isEndingToday(new Date('2026-09-08T21:30:00.000Z').toISOString(), NOW)).toBe(false)
    expect(isEndingToday(new Date('2026-09-09T21:30:00.000Z').toISOString(), NOW)).toBe(false)
    // Yesterday is not today either.
    expect(isEndingToday(iso(TALLINN_DAY_START - 1), NOW)).toBe(false)
    // Winter offset (UTC+2): January 15th starts at 22:00 UTC on the 14th.
    const januaryNoon = new Date('2027-01-15T12:00:00.000Z').getTime()
    expect(startOfTallinnDayMs(januaryNoon)).toBe(
      new Date('2027-01-14T22:00:00.000Z').getTime(),
    )
    expect(isEndingToday(null, NOW)).toBe(false)
    expect(isEndingToday('not-a-date', NOW)).toBe(false)
  })

  it('keeps only active auctions ending today, soonest first', () => {
    const rows = endingTodayAuctions(
      [
        auction({ id: 'late', endsAt: iso(NOW + 30 * HOUR_MS) }),
        auction({ id: 'second', endsAt: iso(NOW + 5 * HOUR_MS) }),
        auction({ id: 'first', endsAt: iso(NOW + HOUR_MS) }),
        auction({ id: 'scheduled', status: 'scheduled', endsAt: iso(NOW + 2 * HOUR_MS) }),
        auction({ id: 'ended', status: 'ended', endsAt: iso(NOW + HOUR_MS) }),
        auction({ id: 'no-end', endsAt: null }),
      ],
      NOW,
    )
    expect(rows.map((row) => row.id)).toEqual(['first', 'second'])
  })

  it('returns an empty list for an empty auction slice', () => {
    expect(endingTodayAuctions([], NOW)).toEqual([])
  })

  it('flags only ended sealed auctions as awaiting ceremony', () => {
    const rows = sealedAwaitingCeremony([
      auction({ id: 'awaiting', type: 'sealed', status: 'ended' }),
      auction({ id: 'running', type: 'sealed', status: 'active' }),
      auction({ id: 'open-ended', type: 'open', status: 'ended' }),
    ])
    expect(rows.map((row) => row.id)).toEqual(['awaiting'])
  })
})

describe('bid aggregations', () => {
  it('counts rows matching a status', () => {
    expect(
      countByStatus([{ status: 'active' }, { status: 'active' }, { status: 'ended' }], 'active'),
    ).toBe(2)
    expect(countByStatus([], 'active')).toBe(0)
  })

  it('keeps bids at or after the window start and drops unparsable rows', () => {
    const from = NOW - HOUR_MS
    const kept = bidsSince(
      [
        bid({ id: 'in', createdAt: iso(from) }),
        bid({ id: 'before', createdAt: iso(from - 1) }),
        bid({ id: 'broken', createdAt: 'not-a-date' }),
      ],
      from,
    )
    expect(kept.map((row) => row.id)).toEqual(['in'])
  })

  it('splits bids into the today and yesterday Tallinn days with inclusive edges', () => {
    const counts = bidsTodayCounts(
      [
        bid({ id: 'b-1', createdAt: iso(TALLINN_DAY_START) }),
        bid({ id: 'b-2', createdAt: iso(NOW) }),
        bid({ id: 'b-3', createdAt: iso(TALLINN_DAY_START - 1) }),
        bid({ id: 'b-4', createdAt: iso(TALLINN_YESTERDAY_START) }),
        bid({ id: 'b-5', createdAt: iso(TALLINN_YESTERDAY_START - 1) }),
        bid({ id: 'b-6', createdAt: 'not-a-date' }),
      ],
      NOW,
    )
    expect(counts).toEqual({ today: 2, yesterday: 2 })
  })

  it('builds the 7-day daily counts for the sparkline, oldest day first', () => {
    const twoDaysAgo = TALLINN_YESTERDAY_START - DAY_MS
    const counts = bidDailyCounts(
      [
        bid({ id: 'd-1', createdAt: iso(twoDaysAgo + HOUR_MS) }),
        bid({ id: 'd-2', createdAt: iso(twoDaysAgo + 2 * HOUR_MS) }),
        bid({ id: 'd-3', createdAt: iso(TALLINN_YESTERDAY_START + HOUR_MS) }),
        bid({ id: 'd-4', createdAt: iso(TALLINN_DAY_START + HOUR_MS) }),
        // Before the 7-day window (Tallinn Sep 2..Sep 8).
        bid({ id: 'd-5', createdAt: iso(TALLINN_DAY_START - 6 * DAY_MS - 1) }),
        bid({ id: 'd-6', createdAt: 'not-a-date' }),
      ],
      NOW,
    )
    expect(BIDS_SPARKLINE_DAYS).toBe(7)
    expect(counts).toHaveLength(7)
    expect(counts.slice(0, 4)).toEqual([0, 0, 0, 0])
    expect(counts[4]).toBe(2)
    expect(counts[5]).toBe(1)
    expect(counts[6]).toBe(1)
  })

  it('returns zero bid counts for an empty slice', () => {
    expect(bidsTodayCounts([], NOW)).toEqual({ today: 0, yesterday: 0 })
  })

  it('rounds the trend and skips a missing yesterday baseline', () => {
    expect(bidTrendChangePercent(3, 1)).toBe(200)
    expect(bidTrendChangePercent(1, 3)).toBe(-67)
    expect(bidTrendChangePercent(2, 2)).toBe(0)
    expect(bidTrendChangePercent(5, 0)).toBeNull()
    expect(bidTrendChangePercent(0, 0)).toBeNull()
  })

  it('picks the oldest pending underbid, clamps future rows, and handles empties', () => {
    expect(
      oldestPendingUnderbidDays(
        [
          bid({ id: 'u-1', status: 'pending_approval', createdAt: iso(NOW - 2 * DAY_MS) }),
          bid({ id: 'u-2', status: 'pending_approval', createdAt: iso(NOW - 5 * DAY_MS) }),
          bid({ id: 'u-3', status: 'rejected', createdAt: iso(NOW - 9 * DAY_MS) }),
        ],
        NOW,
      ),
    ).toBe(5)
    expect(
      oldestPendingUnderbidDays(
        [bid({ id: 'u-4', status: 'pending_approval', createdAt: iso(NOW + HOUR_MS) })],
        NOW,
      ),
    ).toBe(0)
    expect(oldestPendingUnderbidDays([], NOW)).toBeNull()
  })
})

describe('fee math', () => {
  it('charges the 3% + VAT default fee for contracts', () => {
    expect(successFeeCents(10_000, null)).toBe(366)
    expect(successFeeCents(3333, null)).toBe(122)
  })

  it('honours the per-auction fee override including zero', () => {
    expect(successFeeCents(10_000, 10)).toBe(1220)
    expect(successFeeCents(10_000, 0)).toBe(0)
  })

  it('shows the dashboard fee without VAT', () => {
    expect(successFeeExVatCents(10_000, null)).toBe(300)
    expect(successFeeExVatCents(3333, null)).toBe(100)
    expect(successFeeExVatCents(10_000, 10)).toBe(1000)
    expect(successFeeExVatCents(10_000, 0)).toBe(0)
  })

  function feeAt(
    completedAt: string | null,
    status = 'completed',
    finalPriceCents: number | null = 10_000,
    feeOverridePercent: number | null = null,
  ): number {
    return monthServiceFeeCents(
      [auction({ status, completedAt, finalPriceCents, feeOverridePercent })],
      NOW,
    )
  }

  it('sums ex-VAT fees for completed and archived lots inside the month', () => {
    expect(feeAt(iso(NOW))).toBe(300)
    expect(feeAt(iso(NOW), 'archived')).toBe(300)
    expect(
      monthServiceFeeCents(
        [
          auction({
            id: 'a-1',
            status: 'completed',
            completedAt: iso(startOfMonthMs(NOW)),
            finalPriceCents: 10_000,
          }),
          auction({
            id: 'a-2',
            status: 'completed',
            completedAt: iso(NOW),
            finalPriceCents: 10_000,
          }),
        ],
        NOW,
      ),
    ).toBe(600)
  })

  it('excludes completions before the month, in the future, or unparsable', () => {
    expect(feeAt(iso(startOfMonthMs(NOW) - 1))).toBe(0)
    expect(feeAt(iso(NOW + 1))).toBe(0)
    expect(feeAt(null)).toBe(0)
    expect(feeAt('not-a-date')).toBe(0)
  })

  it('skips non-terminal statuses and zero or missing prices', () => {
    expect(feeAt(iso(NOW), 'ended')).toBe(0)
    expect(feeAt(iso(NOW), 'completed', 0)).toBe(0)
    expect(feeAt(iso(NOW), 'completed', null)).toBe(0)
    expect(feeAt(iso(NOW), 'completed', -5)).toBe(0)
  })

  it('returns 0 for an empty auction slice', () => {
    expect(monthServiceFeeCents([], NOW)).toBe(0)
  })
})

describe('ending-today rows', () => {
  it('shows the highest bid for open rows and sealed bid counts without amounts', () => {
    const rows = endingTodayRows(
      [
        auction({ id: 'open-1', endsAt: iso(NOW + 2 * HOUR_MS) }),
        auction({ id: 'open-2', endsAt: iso(NOW + 3 * HOUR_MS) }),
        auction({ id: 'sealed-1', type: 'sealed', endsAt: iso(NOW + 4 * HOUR_MS) }),
      ],
      [
        bid({ id: 'b-1', auctionId: 'open-1', amountCents: 10_000 }),
        bid({ id: 'b-2', auctionId: 'open-1', amountCents: 25_000 }),
        bid({ id: 'b-3', auctionId: 'open-1', amountCents: 5_000 }),
        bid({ id: 'b-4', auctionId: 'sealed-1', amountCents: 99_000 }),
        bid({ id: 'b-5', auctionId: 'sealed-1', amountCents: 1_000 }),
        bid({ id: 'b-6', auctionId: 'elsewhere', amountCents: 50_000 }),
      ],
      NOW,
    )
    expect(rows).toEqual([
      {
        id: 'open-1',
        title: 'Metsaoksjon',
        objectType: 'raieoigus',
        type: 'open',
        endsAt: iso(NOW + 2 * HOUR_MS),
        currentBidCents: 25_000,
        sealedBidCount: null,
      },
      {
        id: 'open-2',
        title: 'Metsaoksjon',
        objectType: 'raieoigus',
        type: 'open',
        endsAt: iso(NOW + 3 * HOUR_MS),
        currentBidCents: null,
        sealedBidCount: null,
      },
      {
        id: 'sealed-1',
        title: 'Metsaoksjon',
        objectType: 'raieoigus',
        type: 'sealed',
        endsAt: iso(NOW + 4 * HOUR_MS),
        currentBidCents: null,
        sealedBidCount: 2,
      },
    ])
  })

  it('keeps a zero-amount open bid list without a current bid', () => {
    const rows = endingTodayRows(
      [auction({ id: 'open-1', endsAt: iso(NOW + HOUR_MS) })],
      [bid({ id: 'b-1', auctionId: 'open-1', amountCents: 0 })],
      NOW,
    )
    expect(rows[0]?.currentBidCents).toBeNull()
  })

  it('returns an empty list for empty input', () => {
    expect(endingTodayRows([], [], NOW)).toEqual([])
  })
})

describe('recent lead rows', () => {
  const names = {
    countyNameById: new Map([['county-1', 'Tartumaa']]),
    specialistNameById: new Map([['spec-1', 'Jaan Spetsialist']]),
  }

  it('takes the newest slice up to the default limit and maps chips', () => {
    const newest = lead({
      id: 'lead-1',
      contactName: 'Contact 1',
      source: 'Veebivorm',
      countyId: 'county-1',
      assignedSpecialistId: 'spec-1',
    })
    const rows = recentLeadRows(
      [
        newest,
        lead({ id: 'lead-2', contactName: 'Contact 2', source: null }),
        lead({ id: 'lead-3', contactName: 'Contact 3' }),
        lead({ id: 'lead-4', contactName: 'Contact 4' }),
      ],
      names,
    )
    expect(RECENT_LEAD_LIMIT).toBe(8)
    expect(rows).toHaveLength(4)
    expect(rows[0]).toEqual({
      id: 'lead-1',
      createdAt: newest.createdAt,
      contactName: 'Contact 1',
      formName: 'Metsa müük',
      source: 'Veebivorm',
      countyName: 'Tartumaa',
      specialistName: 'Jaan Spetsialist',
      href: '/leads/lead-1',
    })
    expect(rows[1]?.source).toBeNull()
    expect(rows[1]?.countyName).toBeNull()
    expect(rows[1]?.specialistName).toBeNull()
    expect(rows[1]?.href).toBe('/leads/lead-2')
  })

  it('falls back to null names for unknown ids and honours limits', () => {
    const rows = recentLeadRows(
      [lead({ id: 'l-1', countyId: 'missing', assignedSpecialistId: 'gone' })],
      names,
      1,
    )
    expect(rows[0]?.countyName).toBeNull()
    expect(rows[0]?.specialistName).toBeNull()
    expect(recentLeadRows([], names)).toEqual([])
  })
})

describe('new-lead KPI filter', () => {
  it('counts leads created today that are unassigned or in status uus', () => {
    expect(
      isNewLeadRow(
        { createdAt: iso(NOW), status: 'new', assignedSpecialistId: null },
        NOW,
      ),
    ).toBe(true)
    // Spec scenario: unassigned lead from today in status Võetud ühendust.
    expect(
      isNewLeadRow(
        { createdAt: iso(NOW), status: 'contacted', assignedSpecialistId: null },
        NOW,
      ),
    ).toBe(true)
    expect(
      isNewLeadRow(
        { createdAt: iso(NOW), status: 'contacted', assignedSpecialistId: 'spec-1' },
        NOW,
      ),
    ).toBe(false)
    expect(
      isNewLeadRow(
        { createdAt: iso(NOW), status: 'new', assignedSpecialistId: 'spec-1' },
        NOW,
      ),
    ).toBe(true)
  })

  it('rejects yesterday rows and bad timestamps', () => {
    expect(
      isNewLeadRow(
        { createdAt: iso(TALLINN_DAY_START - 1), status: 'new', assignedSpecialistId: null },
        NOW,
      ),
    ).toBe(false)
    expect(
      isNewLeadRow(
        { createdAt: 'not-a-date', status: 'new', assignedSpecialistId: null },
        NOW,
      ),
    ).toBe(false)
  })

  it('counts only matching rows in a slice', () => {
    expect(
      countNewLeadsToday(
        [
          lead({ id: 'l-1' }),
          lead({ id: 'l-2', status: 'contacted' }),
          lead({ id: 'l-3', status: 'contacted', assignedSpecialistId: 'spec-1' }),
          lead({ id: 'l-4', createdAt: iso(TALLINN_DAY_START - DAY_MS) }),
        ],
        NOW,
      ),
    ).toBe(2)
  })

  it('treats the KPI as admin/superadmin-only', () => {
    expect(isAdminRole('admin')).toBe(true)
    expect(isAdminRole('superadmin')).toBe(true)
    expect(isAdminRole('specialist')).toBe(false)
    expect(isAdminRole('seller')).toBe(false)
  })
})

describe('day and month boundaries', () => {
  it('puts startOfDayMs at local midnight of the same day', () => {
    const dayStart = startOfDayMs(NOW)
    const date = new Date(dayStart)
    expect(dayStart).toBeLessThanOrEqual(NOW)
    expect(NOW - dayStart).toBeLessThan(DAY_MS)
    expect(date.getHours()).toBe(0)
    expect(date.getMinutes()).toBe(0)
    expect(date.getSeconds()).toBe(0)
    expect(date.getMilliseconds()).toBe(0)
    expect(startOfDayMs(dayStart)).toBe(dayStart)
  })

  it('is idempotent on the Europe/Tallinn day start', () => {
    expect(startOfTallinnDayMs(TALLINN_DAY_START)).toBe(TALLINN_DAY_START)
    expect(startOfTallinnDayMs(TALLINN_DAY_START + DAY_MS - 1)).toBe(TALLINN_DAY_START)
  })

  it('puts startOfMonthMs at local midnight of the first day', () => {
    const monthStart = startOfMonthMs(NOW)
    const date = new Date(monthStart)
    expect(monthStart).toBeLessThanOrEqual(NOW)
    expect(NOW - monthStart).toBeLessThan(31 * DAY_MS)
    expect(date.getDate()).toBe(1)
    expect(date.getHours()).toBe(0)
    expect(startOfMonthMs(monthStart)).toBe(monthStart)
  })
})

describe('permission scope translation', () => {
  it('maps the auction scope to repository where clauses', () => {
    expect(auctionScopeWhere({ kind: 'all' })).toBeUndefined()
    expect(auctionScopeWhere({ kind: 'assigned-specialist', specialistId: 'spec-1' })).toEqual({
      specialist: { equals: 'spec-1' },
    })
    expect(auctionScopeWhere({ kind: 'own-seller', sellerId: 'seller-1' })).toEqual({
      seller: { equals: 'seller-1' },
    })
  })

  it('maps the lead scope to repository where clauses with a false match for none', () => {
    expect(leadScopeWhere({ kind: 'all' })).toBeUndefined()
    expect(leadScopeWhere({ kind: 'assigned-specialist', assignedSpecialistId: 'spec-1' })).toEqual({
      assignedSpecialist: { equals: 'spec-1' },
    })
    expect(leadScopeWhere({ kind: 'none' })).toEqual({ id: { equals: '' } })
  })
})

describe('kpi sublines and count labels', () => {
  it('formats the scheduled-auction subline', () => {
    expect(scheduledAuctionsSubline(0)).toBeNull()
    expect(scheduledAuctionsSubline(2)).toBe('+2 planeeritud')
  })

  it('formats the bid trend subline with an explicit sign', () => {
    expect(bidTrendSubline(null)).toBeNull()
    expect(bidTrendSubline(0)).toBe('0% vs eile')
    expect(bidTrendSubline(200)).toBe('+200% vs eile')
    expect(bidTrendSubline(-67)).toBe('-67% vs eile')
  })

  it('joins the approval split with Estonian singular and partitive forms', () => {
    expect(approvalSplitSubline(null, null)).toBeNull()
    expect(approvalSplitSubline(1, 1)).toBe('1 ettevõte · 1 alapakkumine')
    expect(approvalSplitSubline(2, 3)).toBe('2 ettevõtet · 3 alapakkumist')
  })

  it('appends the oldest pending underbid age in Estonian days', () => {
    expect(underbidPendingNote(null)).toBe('vajab otsust')
    expect(underbidPendingNote(1)).toBe('vajab otsust · vanim 1 päev')
    expect(underbidPendingNote(5)).toBe('vajab otsust · vanim 5 päeva')
  })

  it('formats quick action count labels', () => {
    expect(newRequestsCountLabel(3)).toBe('3 uut')
    expect(sentContractsCountLabel(1)).toBe('1 saadetud')
  })
})

describe('buildWorkspaceKpis role scoping', () => {
  function richKpiInput(role: StaffRole): WorkspaceKpiInput {
    return {
      role,
      now: NOW,
      auctions: [
        auction({ id: 'a-1', endsAt: iso(NOW + 2 * HOUR_MS) }),
        auction({ id: 'a-2', endsAt: iso(NOW + 30 * HOUR_MS) }),
        auction({ id: 'a-3', status: 'scheduled', endsAt: iso(NOW + 5 * HOUR_MS) }),
        auction({ id: 'a-4', status: 'completed', completedAt: iso(NOW), finalPriceCents: 10_000 }),
      ],
      bids: [
        bid({ id: 'b-1', createdAt: iso(NOW) }),
        bid({ id: 'b-2', createdAt: iso(TALLINN_DAY_START) }),
        bid({ id: 'b-3', createdAt: iso(NOW - 60_000) }),
        bid({ id: 'b-4', createdAt: iso(TALLINN_YESTERDAY_START) }),
      ],
      pendingUnderbids: [
        bid({ id: 'u-1', status: 'pending_approval' }),
        bid({ id: 'u-2', status: 'pending_approval' }),
      ],
      newLeadCount: 4,
      contracts: [{ status: 'sent' }, { status: 'sent' }, { status: 'draft' }],
      companyApprovalCount: 5,
    }
  }

  const fullKpis = {
    activeAuctions: { count: 2, scheduledCount: 1 },
    endingToday: { count: 1 },
    bidsToday: {
      count: 3,
      yesterdayCount: 1,
      changePercent: 200,
      dailyCounts: [0, 0, 0, 0, 0, 1, 3],
    },
    pendingApprovals: { companies: 5, underbids: 2 },
    newLeads: { count: 4 },
    pendingSignature: { count: 2 },
    serviceFeeMonth: { cents: 300, eur: 3 },
  }

  it('shows every kpi for admin and superadmin', () => {
    expect(buildWorkspaceKpis(richKpiInput('admin'))).toStrictEqual(fullKpis)
    expect(buildWorkspaceKpis(richKpiInput('superadmin'))).toStrictEqual(fullKpis)
  })

  it('hides company and contract kpis from the specialist', () => {
    expect(buildWorkspaceKpis(richKpiInput('specialist'))).toStrictEqual({
      ...fullKpis,
      pendingApprovals: { companies: null, underbids: 2 },
      pendingSignature: null,
    })
  })

  it('keeps only auction, bid, and underbid kpis for the seller', () => {
    expect(buildWorkspaceKpis(richKpiInput('seller'))).toStrictEqual({
      activeAuctions: fullKpis.activeAuctions,
      endingToday: fullKpis.endingToday,
      bidsToday: fullKpis.bidsToday,
      pendingApprovals: { companies: null, underbids: 2 },
      newLeads: null,
      pendingSignature: null,
      serviceFeeMonth: null,
    })
  })

  it('returns zeroed kpis for empty admin input without NaN leaks', () => {
    const kpis = buildWorkspaceKpis({
      role: 'admin',
      now: NOW,
      auctions: [],
      bids: [],
      pendingUnderbids: [],
      newLeadCount: 0,
      contracts: [],
      companyApprovalCount: 0,
    })
    expect(kpis).toStrictEqual({
      activeAuctions: { count: 0, scheduledCount: 0 },
      endingToday: { count: 0 },
      bidsToday: {
        count: 0,
        yesterdayCount: 0,
        changePercent: null,
        dailyCounts: [0, 0, 0, 0, 0, 0, 0],
      },
      pendingApprovals: { companies: 0, underbids: 0 },
      newLeads: { count: 0 },
      pendingSignature: { count: 0 },
      serviceFeeMonth: { cents: 0, eur: 0 },
    })
    assertFiniteNumbers(kpis)
  })
})

describe('buildWorkspaceQueues role scoping', () => {
  const queueAuctions = [
    auction({ id: 's-1', type: 'sealed', status: 'ended' }),
    auction({ id: 's-2', type: 'sealed', status: 'active' }),
    auction({ id: 's-3', type: 'open', status: 'ended' }),
  ]

  function queueInput(role: StaffRole): WorkspaceQueueInput {
    return {
      role,
      auctions: queueAuctions,
      newLeadCount: 4,
      companyApprovalCount: 5,
      rightsRequestCount: 2,
      newServiceRequestCount: 1,
    }
  }

  it('shows all five queues for admin and superadmin', () => {
    const expected = {
      companyApprovals: 5,
      rightsRequests: 2,
      newLeads: 4,
      newServiceRequests: 1,
      sealedAwaitingCeremony: 1,
    }
    expect(buildWorkspaceQueues(queueInput('admin'))).toStrictEqual(expected)
    expect(buildWorkspaceQueues(queueInput('superadmin'))).toStrictEqual(expected)
  })

  it('gates governance queues away from the specialist', () => {
    expect(buildWorkspaceQueues(queueInput('specialist'))).toStrictEqual({
      companyApprovals: null,
      rightsRequests: null,
      newLeads: 4,
      newServiceRequests: 1,
      sealedAwaitingCeremony: null,
    })
  })

  it('shows no queues for the seller', () => {
    expect(buildWorkspaceQueues(queueInput('seller'))).toStrictEqual({
      companyApprovals: null,
      rightsRequests: null,
      newLeads: null,
      newServiceRequests: null,
      sealedAwaitingCeremony: null,
    })
  })
})

describe('buildQuickActions role scoping', () => {
  const pendingUnderbids = [
    bid({ id: 'u-1', status: 'pending_approval', createdAt: iso(NOW - 5 * DAY_MS) }),
    bid({ id: 'u-2', status: 'pending_approval', createdAt: iso(NOW - 2 * DAY_MS) }),
    bid({ id: 'u-3', status: 'rejected', createdAt: iso(NOW - 9 * DAY_MS) }),
  ]

  function actionInput(
    role: StaffRole,
    overrides: Partial<WorkspaceQuickActionInput> = {},
  ): WorkspaceQuickActionInput {
    return {
      role,
      now: NOW,
      pendingUnderbids,
      companyApprovalCount: 5,
      sentContractCount: 2,
      ...overrides,
    }
  }

  it('lists all three queues for admin with counts and the oldest underbid age', () => {
    expect(buildQuickActions(actionInput('admin'))).toStrictEqual([
      {
        key: 'company-requests',
        title: 'Ettevõtte taotlused ootel',
        note: 'uued taotlused kinnitamisel',
        count: 5,
        countLabel: '5 uut',
        href: '/companies',
      },
      {
        key: 'underbids',
        title: 'Alapakkumised ootel',
        note: 'vajab otsust · vanim 5 päeva',
        count: 2,
        countLabel: '2',
        href: '/bids',
      },
      {
        key: 'contracts-signing',
        title: 'Lepingud allkirjastamisel',
        note: 'saadetud allkirja ootama',
        count: 2,
        countLabel: '2 saadetud',
        href: '/contracts',
      },
    ])
  })

  it('drops the company and contract queues for the specialist', () => {
    expect(buildQuickActions(actionInput('specialist')).map((row) => row.key)).toEqual([
      'underbids',
    ])
  })

  it('leaves the seller with the underbid queue only', () => {
    expect(buildQuickActions(actionInput('seller')).map((row) => row.key)).toEqual(['underbids'])
  })

  it('falls back to the plain note when nothing is pending', () => {
    const rows = buildQuickActions(actionInput('admin', { pendingUnderbids: [] }))
    const underbids = rows.find((row) => row.key === 'underbids')
    expect(underbids?.note).toBe('vajab otsust')
    expect(underbids?.count).toBe(0)
    expect(underbids?.countLabel).toBe('0')
  })
})

interface FindArgs {
  collection: string
  where?: Record<string, unknown>
  sort?: string
  limit?: number
  pagination?: boolean
}

const state = vi.hoisted(() => ({
  repositories: null as {
    find: (args: {
      collection: string
      where?: Record<string, unknown>
      sort?: string
      limit?: number
      pagination?: boolean
    }) => Promise<{ docs: unknown[] }>
  } | null,
}))

vi.mock('@/lib/data/runtime', () => ({
  getRepositories: vi.fn(() => {
    if (state.repositories === null) {
      return Promise.reject(new Error('test repositories not seeded'))
    }
    return Promise.resolve(state.repositories)
  }),
}))

interface RepositoryFixtures {
  auctions: unknown[]
  pendingBids: unknown[]
  recentBids: unknown[]
  endingBids: unknown[]
  leads: unknown[]
  sentContracts: unknown[]
  companyApprovals: unknown[]
  rightsRequests: unknown[]
  serviceRequests: unknown[]
  specialists: unknown[]
  counties: unknown[]
}

function emptyFixtures(): RepositoryFixtures {
  return {
    auctions: [],
    pendingBids: [],
    recentBids: [],
    endingBids: [],
    leads: [],
    sentContracts: [],
    companyApprovals: [],
    rightsRequests: [],
    serviceRequests: [],
    specialists: [],
    counties: [],
  }
}

function docsFor(fixtures: RepositoryFixtures, args: FindArgs): unknown[] {
  const where = args.where
  switch (args.collection) {
    case 'auctions':
      return fixtures.auctions
    case 'bids':
      if (where !== undefined && 'auction' in where) return fixtures.endingBids
      return where !== undefined ? fixtures.pendingBids : fixtures.recentBids
    case 'leads':
      return fixtures.leads
    case 'contracts':
      return fixtures.sentContracts
    case 'company-access-request':
      return fixtures.companyApprovals
    case 'rights-request':
      return fixtures.rightsRequests
    case 'service-requests':
      return fixtures.serviceRequests
    case 'specialists':
      return fixtures.specialists
    case 'counties':
      return fixtures.counties
    default:
      return []
  }
}

function seedRepositories(overrides: Partial<RepositoryFixtures> = {}): FindArgs[] {
  const fixtures = { ...emptyFixtures(), ...overrides }
  const calls: FindArgs[] = []
  state.repositories = {
    find: (args: FindArgs) => {
      calls.push(args)
      return Promise.resolve({ docs: docsFor(fixtures, args) })
    },
  }
  return calls
}

function findCall(
  calls: FindArgs[],
  collection: string,
  predicate: (args: FindArgs) => boolean = () => true,
): FindArgs {
  const found = calls.find((args) => args.collection === collection && predicate(args))
  if (found === undefined) throw new Error(`expected a ${collection} find call`)
  return found
}

describe('getWorkspaceData', () => {
  let nowSpy: { mockReturnValue: (value: number) => unknown; mockRestore: () => void } | undefined

  beforeEach(() => {
    nowSpy = vi.spyOn(Date, 'now')
    nowSpy.mockReturnValue(NOW)
  })

  afterEach(() => {
    nowSpy?.mockRestore()
    nowSpy = undefined
    state.repositories = null
  })

  it('returns zeroed structures for an empty database without NaN leaks', async () => {
    seedRepositories()
    const data: WorkspaceData = await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(data).toStrictEqual({
      kpis: {
        activeAuctions: { count: 0, scheduledCount: 0 },
        endingToday: { count: 0 },
        bidsToday: {
          count: 0,
          yesterdayCount: 0,
          changePercent: null,
          dailyCounts: [0, 0, 0, 0, 0, 0, 0],
        },
        pendingApprovals: { companies: 0, underbids: 0 },
        newLeads: { count: 0 },
        pendingSignature: { count: 0 },
        serviceFeeMonth: { cents: 0, eur: 0 },
      },
      endingToday: [],
      queues: {
        companyApprovals: 0,
        rightsRequests: 0,
        newLeads: 0,
        newServiceRequests: 0,
        sealedAwaitingCeremony: 0,
      },
      quickActions: [
        {
          key: 'company-requests',
          title: 'Ettevõtte taotlused ootel',
          note: 'uued taotlused kinnitamisel',
          count: 0,
          countLabel: '0 uut',
          href: '/companies',
        },
        {
          key: 'underbids',
          title: 'Alapakkumised ootel',
          note: 'vajab otsust',
          count: 0,
          countLabel: '0',
          href: '/bids',
        },
        {
          key: 'contracts-signing',
          title: 'Lepingud allkirjastamisel',
          note: 'saadetud allkirja ootama',
          count: 0,
          countLabel: '0 saadetud',
          href: '/contracts',
        },
      ],
      recentLeads: [],
    })
    assertFiniteNumbers(data)
  })

  it('runs unscoped queries for admin and fetches leads once', async () => {
    const calls = seedRepositories()
    await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(findCall(calls, 'auctions').where).toBeUndefined()
    const leadsCall = findCall(calls, 'leads')
    expect(leadsCall.where).toBeUndefined()
    expect(leadsCall.sort).toBe('-createdAt')
    expect(leadsCall.pagination).toBe(false)
    expect(calls.filter((args) => args.collection === 'leads')).toHaveLength(1)
    expect(findCall(calls, 'specialists').where).toBeUndefined()
    expect(findCall(calls, 'counties').where).toBeUndefined()
  })

  it('scopes auction and lead queries to the specialist assignment', async () => {
    const calls = seedRepositories()
    await getWorkspaceData({ userId: 'spec-1', role: 'specialist' })
    expect(findCall(calls, 'auctions').where).toEqual({ specialist: { equals: 'spec-1' } })
    expect(findCall(calls, 'leads').where).toEqual({
      assignedSpecialist: { equals: 'spec-1' },
    })
  })

  it('scopes leads to none for the seller while keeping the new-lead filter', async () => {
    const calls = seedRepositories()
    await getWorkspaceData({ userId: 'seller-1', role: 'seller' })
    expect(findCall(calls, 'auctions').where).toEqual({ seller: { equals: 'seller-1' } })
    expect(findCall(calls, 'leads').where).toEqual({ id: { equals: '' } })
  })

  it('counts only in-scope bids for the seller', async () => {
    seedRepositories({
      auctions: [auction({ id: 'own-1', sellerId: 'seller-1' })],
      pendingBids: [
        bid({ id: 'p-1', auctionId: 'own-1', status: 'pending_approval' }),
        bid({ id: 'p-2', auctionId: 'foreign', status: 'pending_approval' }),
      ],
      recentBids: [
        bid({ id: 'r-1', auctionId: 'own-1', createdAt: iso(NOW) }),
        bid({ id: 'r-2', auctionId: 'foreign', createdAt: iso(NOW) }),
        bid({ id: 'r-3', auctionId: 'own-1', createdAt: iso(TALLINN_YESTERDAY_START) }),
        bid({ id: 'r-4', auctionId: 'own-1', createdAt: iso(NOW - 3 * DAY_MS) }),
      ],
    })
    const data = await getWorkspaceData({ userId: 'seller-1', role: 'seller' })
    expect(data.kpis.bidsToday).toEqual({
      count: 1,
      yesterdayCount: 1,
      changePercent: 0,
      dailyCounts: [0, 0, 0, 0, 0, 1, 1],
    })
    expect(data.kpis.pendingApprovals).toEqual({ companies: null, underbids: 1 })
    const underbids = data.quickActions.find((row) => row.key === 'underbids')
    expect(underbids?.count).toBe(1)
  })

  it('builds ending-today rows from the per-auction bid fetch', async () => {
    const calls = seedRepositories({
      auctions: [
        auction({ id: 'a-end', endsAt: iso(NOW + 2 * HOUR_MS) }),
        auction({ id: 'a-late', endsAt: iso(NOW + 30 * HOUR_MS) }),
      ],
      endingBids: [
        bid({ id: 'b-1', auctionId: 'a-end', amountCents: 10_000 }),
        bid({ id: 'b-2', auctionId: 'a-end', amountCents: 25_000 }),
        bid({ id: 'b-3', auctionId: 'a-late', amountCents: 99_000 }),
      ],
    })
    const data = await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(data.endingToday).toEqual([
      {
        id: 'a-end',
        title: 'Metsaoksjon',
        objectType: 'raieoigus',
        type: 'open',
        endsAt: iso(NOW + 2 * HOUR_MS),
        currentBidCents: 25_000,
        sealedBidCount: null,
      },
    ])
    const endingCall = findCall(
      calls,
      'bids',
      (args) => args.where !== undefined && 'auction' in args.where,
    )
    expect(endingCall.where).toEqual({ auction: { in: ['a-end'] } })
  })

  it('counts the rail queues from seeded rows', async () => {
    seedRepositories({
      auctions: [
        auction({ id: 's-1', type: 'sealed', status: 'ended' }),
        auction({ id: 's-2', type: 'sealed', status: 'active' }),
      ],
      companyApprovals: [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }],
      rightsRequests: [{ id: 'r-1' }],
      serviceRequests: [{ id: 'sr-1' }, { id: 'sr-2' }],
      leads: [lead({ id: 'n-1' })],
    })
    const data = await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(data.queues).toEqual({
      companyApprovals: 3,
      rightsRequests: 1,
      newLeads: 1,
      newServiceRequests: 2,
      sealedAwaitingCeremony: 1,
    })
  })

  it('caps recent leads at eight and feeds the KPI from one fetch', async () => {
    const calls = seedRepositories({
      leads: [
        // Nine countable rows (today, uus, unassigned) — newest first.
        ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) =>
          lead({ id: `lead-${String(n)}`, createdAt: iso(NOW - n * 60_000) }),
        ),
        // Assigned and already contacted: not a new lead.
        lead({
          id: 'lead-busy',
          status: 'contacted',
          assignedSpecialistId: 'spec-1',
          createdAt: iso(NOW - 30_000),
        }),
        // New but from yesterday: not counted.
        lead({ id: 'lead-old', createdAt: iso(TALLINN_DAY_START - 3_600_000) }),
      ],
      specialists: [{ id: 'spec-1', name: 'Jaan Spetsialist' }],
      counties: [{ id: 'county-1', name: 'Tartumaa' }],
    })
    const data = await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(data.recentLeads).toHaveLength(8)
    expect(data.recentLeads.map((row) => row.id)).toEqual(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `lead-${String(n)}`),
    )
    expect(data.kpis.newLeads).toEqual({ count: 9 })
    const leadsCalls = calls.filter((args) => args.collection === 'leads')
    expect(leadsCalls).toHaveLength(1)
    expect(leadsCalls[0]?.sort).toBe('-createdAt')
    expect(findCall(calls, 'bids', (args) => args.where === undefined).limit).toBe(5000)
  })
})
