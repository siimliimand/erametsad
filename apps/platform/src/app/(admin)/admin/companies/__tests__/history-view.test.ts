import { describe, expect, it } from 'vitest'

import { makeRequest } from './fixtures'
import {
  buildCompanyHistoryCsv,
  buildCompanyHistoryRow,
  companyApproveRightsDefaults,
  matchesCompanyHistoryFilters,
  paginateCompanyHistory,
  parseCompanyHistoryFilters,
  slaChip,
} from '../_components/history-view'

describe('slaChip', () => {
  it('stays neutral within 2 days and uses the spec label', () => {
    expect(slaChip(0)).toEqual({ label: 'oodatud 0 p', tone: 'neutral' })
    expect(slaChip(2)).toEqual({ label: 'oodatud 2 p', tone: 'neutral' })
  })

  it('goes amber after 2 days and red after 5 days', () => {
    expect(slaChip(3).tone).toBe('amber')
    expect(slaChip(5).tone).toBe('amber')
    expect(slaChip(6).tone).toBe('red')
    expect(slaChip(30).label).toBe('oodatud 30 p')
  })

  it('clamps negative day inputs to zero', () => {
    expect(slaChip(-1)).toEqual({ label: 'oodatud 0 p', tone: 'neutral' })
  })
})

describe('parseCompanyHistoryFilters', () => {
  it('keeps known decision values and valid dates', () => {
    expect(
      parseCompanyHistoryFilters({ decision: 'approved', date: '2026-08-01', q: 'Mari' }),
    ).toEqual({ decision: 'approved', date: '2026-08-01', freetext: 'mari' })
  })

  it('drops unknown decisions and malformed dates', () => {
    expect(parseCompanyHistoryFilters({ decision: 'held', date: 'yesterday' })).toEqual({
      decision: null,
      date: null,
      freetext: '',
    })
  })
})

describe('matchesCompanyHistoryFilters', () => {
  const row = {
    status: 'approved',
    reviewedAt: '2026-08-01T10:00:00.000Z',
    searchText: 'mari mets ou 12345678 mari maasikas',
  }

  it('passes a row matching every active filter', () => {
    expect(
      matchesCompanyHistoryFilters(row, {
        decision: 'approved',
        date: '2026-08-01',
        freetext: '12345678',
      }),
    ).toBe(true)
  })

  it('filters by decision, reviewedAt day prefix and freetext', () => {
    expect(matchesCompanyHistoryFilters(row, { decision: 'rejected', date: null, freetext: '' })).toBe(false)
    expect(matchesCompanyHistoryFilters(row, { decision: null, date: '2026-08-02', freetext: '' })).toBe(false)
    expect(matchesCompanyHistoryFilters(row, { decision: null, date: null, freetext: 'kadri' })).toBe(false)
  })
})

describe('paginateCompanyHistory', () => {
  const rows = Array.from({ length: 45 }, (_value, index) => ({ id: String(index) }))

  it('slices the requested page and reports counts', () => {
    const page = paginateCompanyHistory(rows, '2')
    expect(page.pageCount).toBe(3)
    expect(page.total).toBe(45)
    expect(page.rows).toHaveLength(20)
    expect(page.rows[0]).toEqual({ id: '20' })
  })

  it('clamps out-of-range pages into range', () => {
    expect(paginateCompanyHistory(rows, '99').page).toBe(3)
    expect(paginateCompanyHistory(rows, 'nonsense').page).toBe(1)
    expect(paginateCompanyHistory([], undefined).pageCount).toBe(1)
  })
})

describe('buildCompanyHistoryRow + CSV', () => {
  it('maps a decided request and its enrichment into a row', () => {
    const row = buildCompanyHistoryRow({
      request: {
        id: makeRequest().id,
        regCode: '12345678',
        companyName: 'Mari Mets OÜ',
        requesterName: null,
        requesterEmail: 'mari@example.ee',
        status: 'rejected',
        reviewedAt: '2026-08-01T10:00:00.000Z',
      },
      applicant: { name: 'Mari Maasikas', isikukoodMasked: '••••••0100' },
      reviewerName: 'Admin',
      rejectReason: 'Puudub volikiri',
      rights: [],
    })
    expect(row.applicant).toBe('Mari Maasikas · ••••••0100')
    expect(row.searchText).toContain('mari maasikas')
    expect(row.searchText).toContain('12345678')
  })

  it('escapes quotes and pairs the header with one row per entry', () => {
    const csv = buildCompanyHistoryCsv([
      {
        id: '1',
        reviewedAt: '2026-08-01T10:00:00.000Z',
        companyName: 'Mari "Mets" OÜ',
        regCode: '12345678',
        applicant: 'Mari',
        status: 'approved',
        reviewerName: 'Admin',
        reason: '—',
        rights: ['raieoigus', 'kinnistu'],
        searchText: '',
      },
    ])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('"Kuupäev","Ettevõte","Registrikood","Taotleja","Otsus","Otsustaja","Keeldumise põhjus","Antud õigused"')
    expect(lines[1]).toContain('"Mari ""Mets"" OÜ"')
    expect(lines[1]).toContain('"Nõustutud"')
    expect(lines[1]).toContain('"raieoigus, kinnistu"')
  })
})

describe('companyApproveRightsDefaults', () => {
  it('falls back to the documented design default without the setting', () => {
    expect(companyApproveRightsDefaults(undefined)).toEqual(['raieoigus', 'kinnistu'])
    expect(companyApproveRightsDefaults({})).toEqual(['raieoigus', 'kinnistu'])
    expect(companyApproveRightsDefaults({ companyApproveRights: 'nope' })).toEqual([
      'raieoigus',
      'kinnistu',
    ])
  })

  it('reads the reserved featureFlags key and drops unknown values', () => {
    expect(
      companyApproveRightsDefaults({ companyApproveRights: ['kiire', 'mistapes', 'kiire'] }),
    ).toEqual(['kiire'])
    expect(
      companyApproveRightsDefaults({ companyApproveRights: ['pakett', 'kinnistu'] }),
    ).toEqual(['pakett', 'kinnistu'])
  })

  it('falls back on an empty list', () => {
    expect(companyApproveRightsDefaults({ companyApproveRights: [] })).toEqual([
      'raieoigus',
      'kinnistu',
    ])
  })
})
