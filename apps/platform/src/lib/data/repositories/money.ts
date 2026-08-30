import { InvalidMoneyError } from './errors'

/**
 * Integer cents as stored in D1. Produce it with `eurosToCents` at the API
 * boundary; present it with `centsToEuros`. The brand marks intent so route
 * code never treats a raw EUR float as cents (or the reverse).
 */
export type Cents = number & { readonly __brand: 'Cents' }

/**
 * Largest cents value both helpers accept. Kept below 2^50 cents: above
 * ~2^52 cents the float64 product `euros * 100` drifts by whole cents
 * before rounding, so EUR -> cents -> EUR round-trips stop being exact.
 * Still far inside SQLite/D1 signed 64-bit INTEGER columns.
 */
export const MAX_CENTS = 1e15

export function eurosToCents(euros: number): Cents {
  if (!Number.isFinite(euros)) {
    throw new InvalidMoneyError(`EUR amount must be a finite number, got ${String(euros)}`)
  }
  if (euros < 0) {
    throw new InvalidMoneyError(`EUR amount must not be negative, got ${String(euros)}`)
  }
  const cents = Math.round(euros * 100)
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) {
    throw new InvalidMoneyError(
      `EUR amount exceeds the exact cents range of ${String(MAX_CENTS)} cents, got ${String(euros)}`,
    )
  }
  return cents as Cents
}

export function centsToEuros(cents: number): number {
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > MAX_CENTS) {
    throw new InvalidMoneyError(
      `Cents must be a safe integer up to ${String(MAX_CENTS)}, got ${String(cents)}`,
    )
  }
  return cents / 100
}

/**
 * Public EUR field name to stored integer-cents column, for collections whose
 * Payload surface exposes EUR numbers (statistics_snapshots.eur -> eur_cents).
 */
export type MoneyFieldMap = Readonly<Record<string, string>>

export function encodeMoneyFields(
  data: Record<string, unknown>,
  moneyFields: MoneyFieldMap,
): Record<string, unknown> {
  if (Object.keys(moneyFields).length === 0) {
    return data
  }
  const encoded: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    const column = moneyFields[key]
    if (column === undefined) {
      encoded[key] = value
    } else if (value !== undefined) {
      encoded[column] = eurosToCents(value as number)
    }
  }
  return encoded
}

export function decodeMoneyFields(
  row: Record<string, unknown>,
  moneyFields: MoneyFieldMap,
): Record<string, unknown> {
  if (Object.keys(moneyFields).length === 0) {
    return row
  }
  const centsColumns = new Set(Object.values(moneyFields))
  const doc: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!centsColumns.has(key)) {
      doc[key] = value
    }
  }
  for (const [field, column] of Object.entries(moneyFields)) {
    if (row[column] !== undefined) {
      doc[field] = centsToEuros(row[column] as number)
    }
  }
  return doc
}
