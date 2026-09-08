import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { StaffRole } from '../../../_lib/permissions'
import {
  ENDING_TODAY_WINDOW_MS,
  RECENT_LEAD_LIMIT,
  approvalSplitSubline,
  auctionScopeWhere,
  bidTrendChangePercent,
  bidTrendSubline,
  bidsSince,
  bidsTodayCounts,
  buildQuickActions,
  buildWorkspaceKpis,
  buildWorkspaceQueues,
  countByStatus,
  endingTodayAuctions,
  endingTodayRows,
  getWorkspaceData,
  isEndingWithin,
  leadScopeWhere,
  monthServiceFeeCents,
  newRequestsCountLabel,
  oldestPendingUnderbidDays,
  recentLeadRows,
  scheduledAuctionsSubline,
  sealedAwaitingCeremony,
  sentContractsCountLabel,
  startOfDayMs,
  startOfMonthMs,
  successFeeCents,
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
  it('keeps the ending-today lookahead at 24 hours', () => {
    expect(ENDING_TODAY_WINDOW_MS).toBe(DAY_MS)
  })

  it('treats the window edges inclusively and rejects bad timestamps', () => {
    expect(isEndingWithin(iso(NOW), NOW, DAY_MS)).toBe(true)
    expect(isEndingWithin(iso(NOW + DAY_MS), NOW, DAY_MS)).toBe(true)
    expect(isEndingWithin(iso(NOW + DAY_MS + 1), NOW, DAY_MS)).toBe(false)
    expect(isEndingWithin(iso(NOW - 1), NOW, DAY_MS)).toBe(false)
    expect(isEndingWithin(null, NOW, DAY_MS)).toBe(false)
    expect(isEndingWithin('', NOW, DAY_MS)).toBe(false)
    expect(isEndingWithin('not-a-date', NOW, DAY_MS)).toBe(false)
  })

  it('keeps only active auctions inside the window, soonest first', () => {
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

  it('splits bids into the today and yesterday windows with inclusive edges', () => {
    const dayStart = startOfDayMs(NOW)
    const counts = bidsTodayCounts(
      [
        bid({ id: 'b-1', createdAt: iso(dayStart) }),
        bid({ id: 'b-2', createdAt: iso(NOW) }),
        bid({ id: 'b-3', createdAt: iso(dayStart - 1) }),
        bid({ id: 'b-4', createdAt: iso(dayStart - DAY_MS) }),
        bid({ id: 'b-5', createdAt: iso(dayStart - DAY_MS - 1) }),
        bid({ id: 'b-6', createdAt: 'not-a-date' }),
      ],
      NOW,
    )
    expect(counts).toEqual({ today: 2, yesterday: 2 })
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
  it('charges the 3% + VAT default fee', () => {
    expect(successFeeCents(10_000, null)).toBe(366)
    expect(successFeeCents(3333, null)).toBe(122)
  })

  it('honours the per-auction fee override including zero', () => {
    expect(successFeeCents(10_000, 10)).toBe(1220)
    expect(successFeeCents(10_000, 0)).toBe(0)
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

  it('sums fees for completed and archived lots inside the month', () => {
    expect(feeAt(iso(NOW))).toBe(366)
    expect(feeAt(iso(NOW), 'archived')).toBe(366)
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
    ).toBe(732)
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
  it('takes the newest slice up to the default limit and maps every field', () => {
    const newest = lead({ id: 'lead-1', contactName: 'Contact 1', source: 'Veebivorm' })
    const rows = recentLeadRows([
      newest,
      lead({ id: 'lead-2', contactName: 'Contact 2', source: null }),
      lead({ id: 'lead-3', contactName: 'Contact 3' }),
      lead({ id: 'lead-4', contactName: 'Contact 4' }),
    ])
    expect(RECENT_LEAD_LIMIT).toBe(3)
    expect(rows).toHaveLength(3)
    expect(rows[0]).toEqual({
      id: 'lead-1',
      createdAt: newest.createdAt,
      contactName: 'Contact 1',
      formName: 'Metsa müük',
      source: 'Veebivorm',
    })
    expect(rows[1]?.source).toBeNull()
  })

  it('honours a custom limit and empty input', () => {
    expect(recentLeadRows([lead({ id: 'l-1' }), lead({ id: 'l-2' })], 1)).toHaveLength(1)
    expect(recentLeadRows([])).toEqual([])
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
    const dayStart = startOfDayMs(NOW)
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
        bid({ id: 'b-2', createdAt: iso(dayStart) }),
        bid({ id: 'b-3', createdAt: iso(NOW - 60_000) }),
        bid({ id: 'b-4', createdAt: iso(dayStart - 12 * HOUR_MS) }),
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
    bidsToday: { count: 3, yesterdayCount: 1, changePercent: 200 },
    pendingApprovals: { companies: 5, underbids: 2 },
    newLeads: { count: 4 },
    pendingSignature: { count: 2 },
    serviceFeeMonth: { cents: 366, eur: 3.66 },
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
      bidsToday: { count: 0, yesterdayCount: 0, changePercent: null },
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
        href: '/admin/companies',
      },
      {
        key: 'underbids',
        title: 'Alapakkumised ootel',
        note: 'vajab otsust · vanim 5 päeva',
        count: 2,
        countLabel: '2',
        href: '/admin/bids',
      },
      {
        key: 'contracts-signing',
        title: 'Lepingud allkirjastamisel',
        note: 'saadetud allkirja ootama',
        count: 2,
        countLabel: '2 saadetud',
        href: '/admin/contracts',
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
  recentLeads: unknown[]
  newLeads: unknown[]
  sentContracts: unknown[]
  companyApprovals: unknown[]
  rightsRequests: unknown[]
  serviceRequests: unknown[]
}

function emptyFixtures(): RepositoryFixtures {
  return {
    auctions: [],
    pendingBids: [],
    recentBids: [],
    endingBids: [],
    recentLeads: [],
    newLeads: [],
    sentContracts: [],
    companyApprovals: [],
    rightsRequests: [],
    serviceRequests: [],
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
      return args.sort === '-createdAt' ? fixtures.recentLeads : fixtures.newLeads
    case 'contracts':
      return fixtures.sentContracts
    case 'company-access-request':
      return fixtures.companyApprovals
    case 'rights-request':
      return fixtures.rightsRequests
    case 'service-requests':
      return fixtures.serviceRequests
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
        bidsToday: { count: 0, yesterdayCount: 0, changePercent: null },
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
          href: '/admin/companies',
        },
        {
          key: 'underbids',
          title: 'Alapakkumised ootel',
          note: 'vajab otsust',
          count: 0,
          countLabel: '0',
          href: '/admin/bids',
        },
        {
          key: 'contracts-signing',
          title: 'Lepingud allkirjastamisel',
          note: 'saadetud allkirja ootama',
          count: 0,
          countLabel: '0 saadetud',
          href: '/admin/contracts',
        },
      ],
      recentLeads: [],
    })
    assertFiniteNumbers(data)
  })

  it('runs unscoped queries for admin and keeps the new-lead status filter', async () => {
    const calls = seedRepositories()
    await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(findCall(calls, 'auctions').where).toBeUndefined()
    expect(findCall(calls, 'leads').where).toBeUndefined()
    expect(findCall(calls, 'leads', (args) => args.sort === undefined).where).toEqual({
      status: { equals: 'new' },
    })
  })

  it('scopes auction and lead queries to the specialist assignment', async () => {
    const calls = seedRepositories()
    await getWorkspaceData({ userId: 'spec-1', role: 'specialist' })
    expect(findCall(calls, 'auctions').where).toEqual({ specialist: { equals: 'spec-1' } })
    expect(findCall(calls, 'leads').where).toEqual({
      assignedSpecialist: { equals: 'spec-1' },
    })
    expect(findCall(calls, 'leads', (args) => args.sort === undefined).where).toEqual({
      and: [{ assignedSpecialist: { equals: 'spec-1' } }, { status: { equals: 'new' } }],
    })
  })

  it('scopes leads to none for the seller while keeping the new-lead filter', async () => {
    const calls = seedRepositories()
    await getWorkspaceData({ userId: 'seller-1', role: 'seller' })
    expect(findCall(calls, 'auctions').where).toEqual({ seller: { equals: 'seller-1' } })
    expect(findCall(calls, 'leads').where).toEqual({ id: { equals: '' } })
    expect(findCall(calls, 'leads', (args) => args.sort === undefined).where).toEqual({
      and: [{ id: { equals: '' } }, { status: { equals: 'new' } }],
    })
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
        bid({ id: 'r-3', auctionId: 'own-1', createdAt: iso(startOfDayMs(NOW) - 12 * HOUR_MS) }),
        bid({ id: 'r-4', auctionId: 'own-1', createdAt: iso(NOW - 3 * DAY_MS) }),
      ],
    })
    const data = await getWorkspaceData({ userId: 'seller-1', role: 'seller' })
    expect(data.kpis.bidsToday).toEqual({ count: 1, yesterdayCount: 1, changePercent: 0 })
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
      newLeads: [lead({ id: 'n-1' })],
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

  it('caps recent leads at three and uses the shared fetch ceilings', async () => {
    const calls = seedRepositories({
      recentLeads: [1, 2, 3, 4, 5].map((n) => lead({ id: `lead-${String(n)}` })),
      newLeads: [lead({ id: 'new-1' }), lead({ id: 'new-2' })],
    })
    const data = await getWorkspaceData({ userId: 'admin-1', role: 'admin' })
    expect(data.recentLeads.map((row) => row.id)).toEqual(['lead-1', 'lead-2', 'lead-3'])
    expect(data.kpis.newLeads).toEqual({ count: 2 })
    const recentLeadsCall = findCall(calls, 'leads')
    expect(recentLeadsCall.sort).toBe('-createdAt')
    expect(recentLeadsCall.limit).toBe(50)
    expect(findCall(calls, 'bids', (args) => args.where === undefined).limit).toBe(5000)
  })
})
