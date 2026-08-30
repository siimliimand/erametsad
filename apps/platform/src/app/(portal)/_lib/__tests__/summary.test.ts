import { describe, expect, it } from 'vitest'

import {
  buildActiveSummary,
  formatEstonianInteger,
  sumStats,
  type ActiveListingStats,
  type ActiveStatsByObjectType,
} from '../summary'

const STATS: ActiveStatsByObjectType = {
  raieoigus: { count: 3, areaHa: 12, volumeM3: 450, minBidEur: 1500 },
  kinnistu: { count: 2, areaHa: 5, volumeM3: 0, minBidEur: 20000 },
  kiire: { count: 4, areaHa: 8, volumeM3: 0, minBidEur: 600 },
  pakett: { count: 1, areaHa: 30, volumeM3: 0, minBidEur: 31000 },
}

const ALL_TOTALS: ActiveListingStats = {
  count: 10,
  areaHa: 55,
  volumeM3: 450,
  minBidEur: 53100,
}

describe('sumStats', () => {
  it("sums every type bucket for 'all', so the Kõik count equals the bucket sum", () => {
    expect(sumStats('all', STATS)).toEqual(ALL_TOTALS)
    expect(sumStats('all', STATS).count).toBe(
      Object.values(STATS).reduce((total, bucket) => total + bucket.count, 0),
    )
  })

  it('sums just the requested objectTypes', () => {
    expect(sumStats(['raieoigus'], STATS)).toEqual(STATS.raieoigus)
    expect(sumStats(['kinnistu', 'pakett'], STATS)).toEqual({
      count: 3,
      areaHa: 35,
      volumeM3: 0,
      minBidEur: 51000,
    })
  })

  it('returns all zeros for an empty selection (Põllumaad until the schema backs it)', () => {
    expect(sumStats([], STATS)).toEqual({ count: 0, areaHa: 0, volumeM3: 0, minBidEur: 0 })
  })
})

describe('buildActiveSummary', () => {
  it('omits the volume clause for Kõik and reports count, area, and value', () => {
    expect(buildActiveSummary('koik', ALL_TOTALS)).toBe(
      'Hetkel on aktiivseid oksjoneid 10, kokku 55 ha ja 53 100 € väärtuses.',
    )
  })

  it('keeps the volume clause for the forest tab', () => {
    expect(buildActiveSummary('raieoigused', sumStats(['raieoigus'], STATS))).toBe(
      'Hetkel on aktiivseid raieõiguste oksjoneid 3, kokku 12 ha raiutavat mahtu 450 m³ ja 1 500 € väärtuses.',
    )
  })

  it('uses the tab noun phrase for the other tabs', () => {
    expect(buildActiveSummary('metskinnistud', STATS.kinnistu)).toBe(
      'Hetkel on aktiivseid metskinnistute oksjoneid 2, kokku 5 ha ja 20 000 € väärtuses.',
    )
  })

  it('falls back to the empty-state sentence when the count is zero', () => {
    expect(buildActiveSummary('koik', { ...ALL_TOTALS, count: 0 })).toBe(
      'Hetkel ei ole aktiivseid oksjoneid.',
    )
    expect(buildActiveSummary('polumaad', sumStats([], STATS))).toBe(
      'Hetkel ei ole aktiivseid põllumaade oksjoneid.',
    )
  })
})

describe('formatEstonianInteger', () => {
  it('groups thousands with a space and never goes negative', () => {
    expect(formatEstonianInteger(53100)).toBe('53 100')
    expect(formatEstonianInteger(999)).toBe('999')
    expect(formatEstonianInteger(0)).toBe('0')
    expect(formatEstonianInteger(-1)).toBe('0')
  })
})
