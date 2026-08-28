import { InvalidMoneyError } from './errors'

/**
 * Integer cents as stored in D1. Produce it with `eurosToCents` at the API
 * boundary; present it with `centsToEuros`. The brand marks intent so route
 * code never treats a raw EUR float as cents (or the reverse).
 */
export type Cents = number & { readonly __brand: 'Cents' }

export function eurosToCents(euros: number): Cents {
  if (!Number.isFinite(euros)) {
    throw new InvalidMoneyError(`EUR amount must be a finite number, got ${String(euros)}`)
  }
  if (euros < 0) {
    throw new InvalidMoneyError(`EUR amount must not be negative, got ${String(euros)}`)
  }
  return Math.round(euros * 100) as Cents
}

export function centsToEuros(cents: number): number {
  if (!Number.isInteger(cents)) {
    throw new InvalidMoneyError(`Cents must be an integer, got ${String(cents)}`)
  }
  return cents / 100
}
