import { describe, expect, it } from 'vitest'

import {
  classifyContractSearch,
  CONTRACTS_FETCH_LIMIT,
  CONTRACTS_PAGE_SIZE,
  contractInDateRange,
  contractNumber,
  matchesContractSearch,
  paginateRows,
  parseContractListFilters,
  tallinnDayEndIso,
  tallinnDayStartIso,
  transactionRefLabel,
} from './contract-search'

describe('classifyContractSearch', () => {
  it('treats a full UUID query as a reference search', () => {
    const query = classifyContractSearch('a1b2c3d4-e5f6-4a1b-8c2d-1f2e3d4c5b6a')
    expect(query).toEqual({ kind: 'ref', needle: 'a1b2c3d4-e5f6-4a1b-8c2d-1f2e3d4c5b6a' })
  })

  it('treats a hex hash query as a transaction reference search', () => {
    const query = classifyContractSearch('A1B2C3D4E5F67890')
    expect(query).toEqual({ kind: 'ref', needle: 'a1b2c3d4e5f67890' })
  })

  it('keeps short numeric input as freetext', () => {
    const query = classifyContractSearch('1234567')
    expect(query?.kind).toBe('freetext')
  })

  it('classifies names as lowercase freetext and keeps inner spaces', () => {
    const query = classifyContractSearch('  Kalle Tamm  ')
    expect(query).toEqual({ kind: 'freetext', needle: 'kalle tamm' })
  })

  it('returns null for an empty query', () => {
    expect(classifyContractSearch('')).toBeNull()
    expect(classifyContractSearch('   ')).toBeNull()
  })
})

describe('matchesContractSearch', () => {
  const row = {
    id: 'a1b2c3d4-e5f6-4a1b-8c2d-1f2e3d4c5b6a',
    contentHash: 'f00dcafef00dcafef00dcafef00dcafef00dcafef00dcafef00dcafef00dcafe',
    auctionTitle: 'Raieõigus, Kuusalu vald',
    sellerName: 'Mari Mets',
    buyerName: 'Kalle Tamm',
  }

  it('matches a transaction reference by hash prefix, case-insensitively', () => {
    expect(matchesContractSearch(row, { kind: 'ref', needle: 'f00dcafe' })).toBe(true)
    expect(matchesContractSearch(row, { kind: 'ref', needle: 'F00DCAFE' })).toBe(true)
  })

  it('matches a reference against the contract id prefix', () => {
    expect(matchesContractSearch(row, { kind: 'ref', needle: 'a1b2c3d4' })).toBe(true)
  })

  it('rejects a reference that matches nothing', () => {
    expect(matchesContractSearch(row, { kind: 'ref', needle: 'deadbeef' })).toBe(false)
  })

  it('matches freetext over the auction title, the parties and the contract number', () => {
    expect(matchesContractSearch(row, { kind: 'freetext', needle: 'kuusalu' })).toBe(true)
    expect(matchesContractSearch(row, { kind: 'freetext', needle: 'kalle tamm' })).toBe(true)
    expect(matchesContractSearch(row, { kind: 'freetext', needle: 'mari' })).toBe(true)
    expect(matchesContractSearch(row, { kind: 'freetext', needle: '1f2e3d4c' })).toBe(true)
  })

  it('does not match unrelated freetext', () => {
    expect(matchesContractSearch(row, { kind: 'freetext', needle: 'saaremaa' })).toBe(false)
  })

  it('passes every row when the query is null', () => {
    expect(matchesContractSearch(row, null)).toBe(true)
  })
})

describe('contractNumber and transactionRefLabel', () => {
  it('derives the short contract number from the id prefix', () => {
    expect(contractNumber('a1b2c3d4-e5f6-4a1b-8c2d-1f2e3d4c5b6a')).toBe('a1b2c3d4')
  })

  it('truncates a long transaction reference for display', () => {
    expect(transactionRefLabel('f00dcafef00dcafef00d')).toBe('f00dcafef00d…')
    expect(transactionRefLabel('f00dcafe')).toBe('f00dcafe')
  })
})

describe('parseContractListFilters', () => {
  it('keeps known type and status values', () => {
    const filters = parseContractListFilters({ type: 'framework', status: 'signed' })
    expect(filters.type).toBe('framework')
    expect(filters.status).toBe('signed')
  })

  it('drops unknown values instead of throwing', () => {
    const filters = parseContractListFilters({ type: 'hacker', status: 'x' })
    expect(filters.type).toBeNull()
    expect(filters.status).toBeNull()
  })

  it('expands date inputs to the Tallinn day window', () => {
    const filters = parseContractListFilters({ from: '2026-09-01', to: '2026-09-01' })
    expect(filters.fromIso).toBe('2026-08-31T22:00:00.000Z')
    expect(filters.toIso).toBe('2026-09-01T20:59:59.000Z')
  })

  it('returns null bounds for missing or malformed dates', () => {
    expect(parseContractListFilters({}).fromIso).toBeNull()
    expect(parseContractListFilters({ to: 'nonsense' }).toIso).toBeNull()
  })
})

describe('contractInDateRange', () => {
  const filters = parseContractListFilters({ from: '2026-09-01', to: '2026-09-07' })

  it('accepts a timestamp inside the window', () => {
    expect(contractInDateRange('2026-09-03T12:00:00.000Z', filters)).toBe(true)
  })

  it('rejects timestamps outside the window on both ends', () => {
    expect(contractInDateRange('2026-08-31T21:59:59.999Z', filters)).toBe(false)
    expect(contractInDateRange('2026-09-07T20:59:59.000Z', filters)).toBe(true)
    expect(contractInDateRange('2026-09-07T21:00:00.000Z', filters)).toBe(false)
  })

  it('tallinnDayStartIso rejects malformed input', () => {
    expect(tallinnDayStartIso('nonsense')).toBeNull()
    expect(tallinnDayEndIso('')).toBeNull()
  })
})

describe('paginateRows', () => {
  const rows = Array.from({ length: 30 }, (_value, index) => ({ id: `row-${String(index)}` }))

  it('slices the first page and counts pages', () => {
    const result = paginateRows(rows, '')
    expect(CONTRACTS_PAGE_SIZE).toBe(25)
    expect(result.safePage).toBe(1)
    expect(result.pageCount).toBe(2)
    expect(result.totalCount).toBe(30)
    expect(result.pageRows).toHaveLength(25)
  })

  it('serves a later page and clamps past the last page', () => {
    expect(paginateRows(rows, '2').pageRows).toHaveLength(5)
    expect(paginateRows(rows, '9').safePage).toBe(2)
  })

  it('falls back to page 1 for malformed page input', () => {
    expect(paginateRows(rows, 'nonsense').safePage).toBe(1)
    expect(paginateRows(rows, '-3').safePage).toBe(1)
  })

  it('keeps one empty page for an empty list', () => {
    const result = paginateRows([], '1')
    expect(result.pageCount).toBe(1)
    expect(result.pageRows).toEqual([])
  })

  it('bounds the single fetch', () => {
    expect(CONTRACTS_FETCH_LIMIT).toBeGreaterThan(CONTRACTS_PAGE_SIZE)
  })
})
