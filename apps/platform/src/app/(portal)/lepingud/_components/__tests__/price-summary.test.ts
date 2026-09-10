import { describe, expect, it } from 'vitest'

import { DEFAULT_FEE_PERCENT, VAT_PERCENT, formatEurCents, priceSummaryCents } from '../price-summary'

function eur(value: string): string {
  return value.replace(/\u00a0|\u202f/g, ' ')
}

describe('priceSummaryCents', () => {
  it('matches the demo 13 breakdown: 3% fee, 22% VAT on the fee only', () => {
    // Demo: 58 500 € lõpphind → 1 755 € teenustasu → 386,10 € km → 60 641,10 € kokku.
    const summary = priceSummaryCents(5_850_000, null)

    expect(summary.feePercent).toBe(DEFAULT_FEE_PERCENT)
    expect(summary.feeCents).toBe(175_500)
    expect(summary.vatPercent).toBe(VAT_PERCENT)
    expect(summary.vatCents).toBe(38_610)
    expect(summary.totalCents).toBe(6_064_110)
  })

  it('uses the per-auction fee override for both the fee and its VAT', () => {
    const summary = priceSummaryCents(1_000_000, 5)

    expect(summary.feePercent).toBe(5)
    expect(summary.feeCents).toBe(50_000)
    expect(summary.vatCents).toBe(11_000)
    expect(summary.totalCents).toBe(1_061_000)
  })

  it('rounds each row on integer cents', () => {
    const summary = priceSummaryCents(333, null)

    expect(summary.feeCents).toBe(10) // 9.99 → 10
    expect(summary.vatCents).toBe(2) // 2.2 → 2
    expect(summary.totalCents).toBe(345)
  })
})

describe('formatEurCents', () => {
  it('formats et-EE currency from cents', () => {
    expect(eur(formatEurCents(6_064_110))).toBe('60 641,10 €')
    expect(eur(formatEurCents(5_850_000))).toBe('58 500,00 €')
  })
})
