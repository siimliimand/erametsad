import { describe, expect, it } from 'vitest'

import { centsToEuros, eurosToCents, type Cents } from '../money'

describe('eurosToCents', () => {
  it('converts whole euros', () => {
    expect(eurosToCents(10)).toBe(1000)
  })

  it('converts fractional euros', () => {
    expect(eurosToCents(1234.56)).toBe(123456)
  })

  it('rounds float drift half-up', () => {
    expect(eurosToCents(19.99)).toBe(1999)
    expect(eurosToCents(0.1 + 0.2)).toBe(30)
  })

  it('accepts zero', () => {
    expect(eurosToCents(0)).toBe(0)
  })

  it('returns a value assignable to Cents', () => {
    const cents: Cents = eurosToCents(42.5)
    expect(cents).toBe(4250)
  })

  it('rejects negative amounts', () => {
    expect(() => eurosToCents(-0.01)).toThrow(/negative/)
  })

  it('rejects non-finite amounts', () => {
    expect(() => eurosToCents(Number.NaN)).toThrow(/finite/)
    expect(() => eurosToCents(Number.POSITIVE_INFINITY)).toThrow(/finite/)
  })
})

describe('centsToEuros', () => {
  it('converts cents to euros', () => {
    expect(centsToEuros(123456)).toBe(1234.56)
  })

  it('round-trips with eurosToCents', () => {
    expect(centsToEuros(eurosToCents(99.99))).toBe(99.99)
  })

  it('accepts zero', () => {
    expect(centsToEuros(0)).toBe(0)
  })

  it('rejects non-integer cents', () => {
    expect(() => centsToEuros(1234.5)).toThrow(/integer/)
  })
})
