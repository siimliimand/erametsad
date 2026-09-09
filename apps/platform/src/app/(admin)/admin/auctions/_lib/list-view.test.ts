import { describe, expect, it } from 'vitest'

import {
  ARCHIVABLE_STATUSES,
  areaVolumeLabel,
  countdownText,
  defaultSortFor,
  initials,
  isArchivable,
  matchesListTab,
  sortAuctionRows,
  type ListTab,
  type SortableAuctionRow,
} from './list-view'

const NOW = Date.parse('2026-06-01T12:00:00Z')

function row(overrides: Partial<SortableAuctionRow> = {}): SortableAuctionRow {
  return {
    id: 'a1',
    title: 'Mets',
    minBidCents: 100000,
    bidCount: 3,
    endsAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('countdownText', () => {
  it('shows lõppenud when the end time is past', () => {
    expect(countdownText('2026-05-01T00:00:00Z', NOW)).toBe('lõppenud')
  })

  it('shows lõppenud at exactly the end time', () => {
    expect(countdownText('2026-06-01T12:00:00Z', NOW)).toBe('lõppenud')
  })

  it('formats days and hours', () => {
    expect(countdownText('2026-06-03T15:30:00Z', NOW)).toBe('2 p 3 h')
  })

  it('formats hours and minutes when under a day', () => {
    expect(countdownText('2026-06-01T17:07:00Z', NOW)).toBe('5 h 7 min')
  })

  it('formats minutes:seconds when under an hour', () => {
    expect(countdownText('2026-06-01T12:03:05Z', NOW)).toBe('3:05')
  })

  it('pads seconds to two digits', () => {
    expect(countdownText('2026-06-01T12:00:02Z', NOW)).toBe('0:02')
  })
})

describe('initials', () => {
  it('returns a dash fallback for null', () => {
    expect(initials(null)).toBe('—')
  })

  it('returns a dash fallback for undefined', () => {
    expect(initials(undefined)).toBe('—')
  })

  it('returns a dash fallback for an empty string', () => {
    expect(initials('')).toBe('—')
  })

  it('takes the first letter of a single word', () => {
    expect(initials('Mari')).toBe('M')
  })

  it('takes the first letters of two words', () => {
    expect(initials('Mari Maasikas')).toBe('MM')
  })

  it('ignores words past the second', () => {
    expect(initials('Mari Maasikas Mets')).toBe('MM')
  })

  it('collapses extra whitespace', () => {
    expect(initials('  Mari   Maasikas  ')).toBe('MM')
  })
})

describe('defaultSortFor', () => {
  it('returns endsAt when exactly the active status is filtered', () => {
    expect(defaultSortFor(['active'])).toBe('endsAt')
  })

  it('returns -id for another single status', () => {
    expect(defaultSortFor(['ended'])).toBe('-id')
  })

  it('returns -id for no status filter', () => {
    expect(defaultSortFor([])).toBe('-id')
  })

  it('returns -id when active is combined with other statuses', () => {
    expect(defaultSortFor(['active', 'ended'])).toBe('-id')
  })
})

describe('sortAuctionRows', () => {
  it('sorts by id ascending', () => {
    const rows = [row({ id: 'b2' }), row({ id: 'a1' }), row({ id: 'c3' })]
    expect(sortAuctionRows(rows, 'id').map((r) => r.id)).toEqual(['a1', 'b2', 'c3'])
  })

  it('sorts by id descending', () => {
    const rows = [row({ id: 'b2' }), row({ id: 'a1' }), row({ id: 'c3' })]
    expect(sortAuctionRows(rows, '-id').map((r) => r.id)).toEqual(['c3', 'b2', 'a1'])
  })

  it('sorts by title with Estonian collation ascending', () => {
    // Estonian alphabet places z before t (s, š, z, ž, t, u, v, õ), unlike plain UTF-16 order.
    const rows = [row({ id: '1', title: 'Õun' }), row({ id: '2', title: 'zulu' }), row({ id: '3', title: 'tuba' })]
    expect(sortAuctionRows(rows, 'title').map((r) => r.id)).toEqual(['2', '3', '1'])
  })

  it('sorts by title with Estonian collation descending', () => {
    const rows = [row({ id: '1', title: 'Õun' }), row({ id: '2', title: 'zulu' }), row({ id: '3', title: 'tuba' })]
    expect(sortAuctionRows(rows, '-title').map((r) => r.id)).toEqual(['1', '3', '2'])
  })

  it('sorts by minBidCents numerically ascending', () => {
    const rows = [row({ id: '1', minBidCents: 1000 }), row({ id: '2', minBidCents: 300 })]
    expect(sortAuctionRows(rows, 'minBidCents').map((r) => r.id)).toEqual(['2', '1'])
  })

  it('sorts by minBidCents numerically descending', () => {
    const rows = [row({ id: '1', minBidCents: 1000 }), row({ id: '2', minBidCents: 300 })]
    expect(sortAuctionRows(rows, '-minBidCents').map((r) => r.id)).toEqual(['1', '2'])
  })

  it('sorts by bidCount numerically ascending', () => {
    const rows = [row({ id: '1', bidCount: 5 }), row({ id: '2', bidCount: 12 }), row({ id: '3', bidCount: 1 })]
    expect(sortAuctionRows(rows, 'bidCount').map((r) => r.id)).toEqual(['3', '1', '2'])
  })

  it('sorts by bidCount numerically descending', () => {
    const rows = [row({ id: '1', bidCount: 5 }), row({ id: '2', bidCount: 12 }), row({ id: '3', bidCount: 1 })]
    expect(sortAuctionRows(rows, '-bidCount').map((r) => r.id)).toEqual(['2', '1', '3'])
  })

  it('sorts by endsAt ascending', () => {
    const rows = [
      row({ id: '1', endsAt: '2026-03-01T00:00:00Z' }),
      row({ id: '2', endsAt: '2026-01-01T00:00:00Z' }),
      row({ id: '3', endsAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, 'endsAt').map((r) => r.id)).toEqual(['2', '3', '1'])
  })

  it('sorts by endsAt descending', () => {
    const rows = [
      row({ id: '1', endsAt: '2026-03-01T00:00:00Z' }),
      row({ id: '2', endsAt: '2026-01-01T00:00:00Z' }),
      row({ id: '3', endsAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, '-endsAt').map((r) => r.id)).toEqual(['1', '3', '2'])
  })

  it('sorts by createdAt ascending', () => {
    const rows = [
      row({ id: '1', createdAt: '2026-03-01T00:00:00Z' }),
      row({ id: '2', createdAt: '2026-01-01T00:00:00Z' }),
      row({ id: '3', createdAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, 'createdAt').map((r) => r.id)).toEqual(['2', '3', '1'])
  })

  it('sorts by createdAt descending', () => {
    const rows = [
      row({ id: '1', createdAt: '2026-03-01T00:00:00Z' }),
      row({ id: '2', createdAt: '2026-01-01T00:00:00Z' }),
      row({ id: '3', createdAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, '-createdAt').map((r) => r.id)).toEqual(['1', '3', '2'])
  })

  it('places null endsAt last ascending', () => {
    const rows = [
      row({ id: '1', endsAt: null }),
      row({ id: '2', endsAt: '2026-02-01T00:00:00Z' }),
      row({ id: '3', endsAt: '2026-01-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, 'endsAt').map((r) => r.id)).toEqual(['3', '2', '1'])
  })

  it('places null endsAt last descending', () => {
    const rows = [
      row({ id: '1', endsAt: null }),
      row({ id: '2', endsAt: '2026-02-01T00:00:00Z' }),
      row({ id: '3', endsAt: '2026-01-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, '-endsAt').map((r) => r.id)).toEqual(['2', '3', '1'])
  })

  it('keeps input order for equal keys', () => {
    const rows = [
      row({ id: 'first', minBidCents: 500 }),
      row({ id: 'second', minBidCents: 500 }),
      row({ id: 'third', minBidCents: 100 }),
    ]
    expect(sortAuctionRows(rows, 'minBidCents').map((r) => r.id)).toEqual(['third', 'first', 'second'])
    expect(sortAuctionRows(rows, '-minBidCents').map((r) => r.id)).toEqual(['first', 'second', 'third'])
  })

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'b2', createdAt: '2026-02-01T00:00:00Z' }), row({ id: 'a1', createdAt: '2026-01-01T00:00:00Z' })]
    const snapshot = [...rows]
    const sorted = sortAuctionRows(rows, '-createdAt')
    expect(rows).toEqual(snapshot)
    expect(sorted).not.toBe(rows)
  })

  it('falls back to -id on an unknown sort key', () => {
    const rows = [
      row({ id: '1', createdAt: '2026-01-01T00:00:00Z' }),
      row({ id: '2', createdAt: '2026-03-01T00:00:00Z' }),
      row({ id: '3', createdAt: '2026-02-01T00:00:00Z' }),
    ]
    expect(sortAuctionRows(rows, 'bogus').map((r) => r.id)).toEqual(['3', '2', '1'])
  })

  it('falls back to -id on an unknown descending sort key', () => {
    const rows = [row({ id: '1', createdAt: '2026-01-01T00:00:00Z' }), row({ id: '2', createdAt: '2026-02-01T00:00:00Z' })]
    expect(sortAuctionRows(rows, '-bogus').map((r) => r.id)).toEqual(['2', '1'])
  })

  it('honors a custom fallback on an unknown sort key', () => {
    const rows = [row({ id: '1', title: 'zulu' }), row({ id: '2', title: 'alf' })]
    expect(sortAuctionRows(rows, 'bogus', 'title').map((r) => r.id)).toEqual(['2', '1'])
  })

  it('falls back to -id for an empty sort string', () => {
    const rows = [row({ id: '1', createdAt: '2026-01-01T00:00:00Z' }), row({ id: '2', createdAt: '2026-02-01T00:00:00Z' })]
    expect(sortAuctionRows(rows, '').map((r) => r.id)).toEqual(['2', '1'])
  })
})

describe('areaVolumeLabel', () => {
  it('joins both measures with a slash', () => {
    expect(areaVolumeLabel(12.4, 980)).toBe('12,4 ha / 980 m³')
  })

  it('formats the Estonian decimal comma', () => {
    expect(areaVolumeLabel(3.5, null)).toBe('3,5 ha')
  })

  it('renders area alone when volume is missing', () => {
    expect(areaVolumeLabel(7, null)).toBe('7 ha')
  })

  it('renders volume alone when area is missing', () => {
    expect(areaVolumeLabel(null, 250.5)).toBe('250,5 m³')
  })

  it('returns null when both measures are missing', () => {
    expect(areaVolumeLabel(null, null)).toBeNull()
  })

  it('rounds to two fraction digits', () => {
    expect(areaVolumeLabel(1.239, 1.004)).toBe('1,24 ha / 1 m³')
  })
})

describe('matchesListTab', () => {
  const tab = (overrides: Partial<ListTab> = {}): ListTab => ({
    id: 'x',
    label: 'X',
    objectTypes: null,
    quickOnly: false,
    ...overrides,
  })
  const doc = (overrides: Partial<{ objectType: 'raieoigus' | 'kinnistu' | 'kiire' | 'pakett'; isQuickAuction: boolean }> = {}) => ({
    objectType: 'raieoigus' as const,
    isQuickAuction: false,
    ...overrides,
  })

  it('matches every lot on the Kõik tab', () => {
    expect(matchesListTab(doc(), tab({ id: 'koik' }))).toBe(true)
  })

  it('matches by object type on type tabs', () => {
    const tab_ = tab({ objectTypes: ['kinnistu'] })
    expect(matchesListTab(doc({ objectType: 'kinnistu' }), tab_)).toBe(true)
    expect(matchesListTab(doc({ objectType: 'raieoigus' }), tab_)).toBe(false)
  })

  it('keeps an empty object-type list empty', () => {
    const tab_ = tab({ objectTypes: [] })
    expect(matchesListTab(doc({ objectType: 'kinnistu' }), tab_)).toBe(false)
  })

  it('selects quick auctions across object types', () => {
    const kiiroksjonid = tab({ id: 'kiiroksjonid', quickOnly: true })
    expect(
      matchesListTab(doc({ objectType: 'raieoigus', isQuickAuction: true }), kiiroksjonid),
    ).toBe(true)
    expect(
      matchesListTab(doc({ objectType: 'pakett', isQuickAuction: true }), kiiroksjonid),
    ).toBe(true)
    expect(
      matchesListTab(doc({ objectType: 'kiire', isQuickAuction: false }), kiiroksjonid),
    ).toBe(false)
  })
})

describe('isArchivable', () => {
  it('allows ended, unsold, and completed lots', () => {
    expect(isArchivable('ended')).toBe(true)
    expect(isArchivable('unsold')).toBe(true)
    expect(isArchivable('completed')).toBe(true)
  })

  it('rejects every other status', () => {
    expect(isArchivable('draft')).toBe(false)
    expect(isArchivable('scheduled')).toBe(false)
    expect(isArchivable('active')).toBe(false)
    expect(isArchivable('appraised')).toBe(false)
    expect(isArchivable('contract')).toBe(false)
    expect(isArchivable('archived')).toBe(false)
  })

  it('lists exactly ended, unsold, completed', () => {
    expect([...ARCHIVABLE_STATUSES]).toEqual(['ended', 'unsold', 'completed'])
  })
})
