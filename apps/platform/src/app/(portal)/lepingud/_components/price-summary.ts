/**
 * Hinna kokkuvõte math for the signing flow (demo 13, design D10). The
 * success fee is charged on completion only: fee percent (per-auction
 * override, else the global setting, else 3%) applies to the final price,
 * and VAT applies to the fee only. Integer cents throughout, rounding at
 * each row like the admin workspace helpers.
 */
export const DEFAULT_FEE_PERCENT = 3
export const VAT_PERCENT = 22

export interface PriceSummaryCents {
  finalPriceCents: number
  feePercent: number
  feeCents: number
  vatPercent: number
  vatCents: number
  totalCents: number
}

export function priceSummaryCents(
  finalPriceCents: number,
  feePercentOverride: number | null,
): PriceSummaryCents {
  const feePercent =
    typeof feePercentOverride === 'number' ? feePercentOverride : DEFAULT_FEE_PERCENT
  const feeCents = Math.round((finalPriceCents * feePercent) / 100)
  const vatCents = Math.round((feeCents * VAT_PERCENT) / 100)
  return {
    finalPriceCents,
    feePercent,
    feeCents,
    vatPercent: VAT_PERCENT,
    vatCents,
    totalCents: finalPriceCents + feeCents + vatCents,
  }
}

/** et-EE currency from integer cents ("60 641,10 €"); fee+VAT math makes
 * cents meaningful, so both fraction digits always render. */
export function formatEurCents(cents: number): string {
  return (cents / 100).toLocaleString('et-EE', { style: 'currency', currency: 'EUR' })
}
