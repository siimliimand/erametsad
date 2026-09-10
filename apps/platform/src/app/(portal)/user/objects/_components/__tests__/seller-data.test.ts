import { describe, expect, it } from 'vitest'

import {
  filterRowsByStatus,
  parseStatusTab,
  STATUS_TABS,
  type SellerAuctionRow,
} from '../seller-data'

function makeRow(overrides: Partial<SellerAuctionRow>): SellerAuctionRow {
  return {
    id: 'auction-1',
    title: 'Lepsi raieõigus',
    slug: 'lepsi-raieoigus',
    objectType: 'raieoigus',
    type: 'open',
    status: 'active',
    startPrice: 5000,
    finalPrice: null,
    leadingPrice: 7750,
    bidCount: 14,
    pendingApprovalCount: 0,
    views: null,
    countyName: 'Tartu maakond',
    areaHa: 12,
    startsAt: null,
    endsAt: null,
    createdAt: '2026-08-01T10:00:00Z',
    updatedAt: '2026-08-01T10:00:00Z',
    pending: [],
    bidLog: [],
    ...overrides,
  }
}

const rows = [
  makeRow({ id: 'sched', status: 'scheduled', leadingPrice: null }),
  makeRow({ id: 'live', status: 'active' }),
  makeRow({ id: 'sold', status: 'completed', finalPrice: 88000, leadingPrice: null }),
  makeRow({ id: 'lost', status: 'unsold', finalPrice: null, leadingPrice: null }),
  makeRow({ id: 'plan', status: 'draft', leadingPrice: null, bidCount: 0 }),
]

describe('parseStatusTab', () => {
  it('accepts the demo chip values and the legacy underlying states', () => {
    expect(parseStatusTab('ongoing')).toBe('ongoing')
    expect(parseStatusTab('scheduled')).toBe('scheduled')
    expect(parseStatusTab('active')).toBe('active')
    expect(parseStatusTab('draft')).toBe('draft')
    expect(parseStatusTab('ended')).toBe('ended')
    expect(parseStatusTab(null)).toBe('all')
  })

  it('falls back to all for unknown values', () => {
    expect(parseStatusTab('won')).toBe('all')
    expect(parseStatusTab('DROP TABLE')).toBe('all')
  })
})

describe('filterRowsByStatus', () => {
  it('folds scheduled and active into the ongoing chip', () => {
    const ongoing = filterRowsByStatus(rows, 'ongoing')
    expect(ongoing.map((row) => row.id)).toEqual(['sched', 'live'])
  })

  it('still supports the legacy underlying state filters', () => {
    expect(filterRowsByStatus(rows, 'scheduled').map((row) => row.id)).toEqual(['sched'])
    expect(filterRowsByStatus(rows, 'active').map((row) => row.id)).toEqual(['live'])
  })

  it('ended covers every post-end state and all skips filtering', () => {
    expect(filterRowsByStatus(rows, 'ended').map((row) => row.id)).toEqual([
      'sold',
      'lost',
    ])
    expect(filterRowsByStatus(rows, 'all')).toHaveLength(rows.length)
    expect(filterRowsByStatus(rows, 'draft').map((row) => row.id)).toEqual(['plan'])
  })
})

describe('STATUS_TABS', () => {
  it('keeps every documented tab reachable', () => {
    expect(STATUS_TABS).toEqual([
      'all',
      'ongoing',
      'draft',
      'scheduled',
      'active',
      'ended',
    ])
  })
})
