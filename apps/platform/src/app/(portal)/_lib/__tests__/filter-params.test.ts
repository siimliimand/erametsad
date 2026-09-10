import { describe, expect, it } from 'vitest'

import {
  countActiveFilters,
  DEFAULT_LISTING_FILTERS,
  listingFiltersEqual,
  parseListingFilters,
  serializeListingFilters,
} from '../filter-params'

function parse(query: string): ReturnType<typeof parseListingFilters> {
  return parseListingFilters(new URLSearchParams(query))
}

describe('cutDeadlineYear (Raietähtaeg aasta)', () => {
  it('parses the year param', () => {
    expect(parse('cutDeadlineYear=2027').cutDeadlineYear).toBe(2027)
  })

  it('ignores empty and non-integer values', () => {
    expect(parse('cutDeadlineYear=').cutDeadlineYear).toBeUndefined()
    expect(parse('cutDeadlineYear=2026.5').cutDeadlineYear).toBeUndefined()
    expect(parse('cutDeadlineYear=not-a-year').cutDeadlineYear).toBeUndefined()
  })

  it('serializes the year and counts it as an active filter', () => {
    const state = { ...DEFAULT_LISTING_FILTERS, cutDeadlineYear: 2028 }
    expect(serializeListingFilters(state, 'mets')).toContain('cutDeadlineYear=2028')
    expect(countActiveFilters(state)).toBe(1)
  })

  it('stays out of the defaults and the default count', () => {
    expect(DEFAULT_LISTING_FILTERS.cutDeadlineYear).toBeUndefined()
    expect(serializeListingFilters({ ...DEFAULT_LISTING_FILTERS }, 'mets')).not.toContain(
      'cutDeadlineYear',
    )
  })
})

describe('dropped Maht (m³) range', () => {
  it('still round-trips legacy volume params for shared links', () => {
    const state = parse('volumeMin=100&volumeMax=500')
    expect(state.volumeMin).toBe(100)
    expect(state.volumeMax).toBe(500)
    const query = serializeListingFilters(state, 'mets')
    expect(query).toContain('volumeMin=100')
    expect(query).toContain('volumeMax=500')
  })

  it('excludes legacy volume bounds from the active count', () => {
    expect(countActiveFilters(parse('volumeMin=100'))).toBe(0)
  })

  it('omits volume params from a default serialization', () => {
    expect(serializeListingFilters({ ...DEFAULT_LISTING_FILTERS }, 'mets')).not.toContain(
      'volume',
    )
  })
})

describe('surviving param contract', () => {
  it('keeps the demo-era param names and value formats stable', () => {
    const query = serializeListingFilters(
      {
        ...DEFAULT_LISTING_FILTERS,
        county: ['Lääne-Viru maakond'],
        parish: ['Haljala vald'],
        species: ['ma', 'ku'],
        loggingTypes: ['vr', 'hr'],
        q: 'metskits',
        areaMin: 10,
        priceMax: 20000,
        cutDeadlineYear: 2027,
      },
      'raieoigused',
    )
    const params = new URLSearchParams(query)
    expect(params.get('tab')).toBe('raieoigused')
    expect(params.get('county')).toBe('Lääne-Viru maakond')
    expect(params.get('parish')).toBe('Haljala vald')
    expect(params.get('species')).toBe('ma,ku')
    expect(params.get('loggingType')).toBe('vr,hr')
    expect(params.get('q')).toBe('metskits')
    expect(params.get('areaMin')).toBe('10')
    expect(params.get('priceMax')).toBe('20000')
    expect(params.get('cutDeadlineYear')).toBe('2027')
    expect(params.get('page')).toBeNull()
  })

  it('compares states through the serialization', () => {
    const withYear = { ...DEFAULT_LISTING_FILTERS, cutDeadlineYear: 2027 }
    expect(listingFiltersEqual(withYear, { ...DEFAULT_LISTING_FILTERS })).toBe(false)
    expect(listingFiltersEqual(withYear, parse('cutDeadlineYear=2027'))).toBe(true)
  })
})
