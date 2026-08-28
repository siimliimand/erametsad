import { describe, expect, it } from 'vitest'

import { InvalidMoneyError } from '../errors'
import { decodeMoneyFields, encodeMoneyFields, eurosToCents } from '../money'
import { contentCollections } from '../registry'

const statisticsMoneyFields = contentCollections['statistics-snapshots'].moneyFields ?? {}

describe('encodeMoneyFields', () => {
  it('converts the public eur field to the integer-cents column', () => {
    const encoded = encodeMoneyFields({ eur: 1234.56 }, statisticsMoneyFields)
    expect(encoded).toEqual({ eurCents: 123456 })
  })

  it('rounds half cents away from zero like eurosToCents', () => {
    expect(encodeMoneyFields({ eur: 19.995 }, statisticsMoneyFields).eurCents).toBe(
      eurosToCents(19.995),
    )
  })

  it('passes non-money keys through untouched', () => {
    const encoded = encodeMoneyFields(
      { date: '2026-08-28', objectType: 'raieoigus', eur: 10.5 },
      statisticsMoneyFields,
    )
    expect(encoded.date).toBe('2026-08-28')
    expect(encoded.objectType).toBe('raieoigus')
    expect(encoded.eurCents).toBe(1050)
  })

  it('drops an undefined money field so updates leave the column untouched', () => {
    const encoded = encodeMoneyFields({ eur: undefined, count: 3 }, statisticsMoneyFields)
    expect('eurCents' in encoded).toBe(false)
    expect(encoded.count).toBe(3)
  })

  it('returns the data unchanged without a money map', () => {
    const data = { title: 'Mets' }
    expect(encodeMoneyFields(data, {})).toBe(data)
  })

  it('rejects negative, non-finite, and non-number amounts', () => {
    expect(() => encodeMoneyFields({ eur: -0.01 }, statisticsMoneyFields)).toThrow(InvalidMoneyError)
    expect(() => encodeMoneyFields({ eur: Number.NaN }, statisticsMoneyFields)).toThrow(
      InvalidMoneyError,
    )
    expect(() => encodeMoneyFields({ eur: '10' }, statisticsMoneyFields)).toThrow(
      InvalidMoneyError,
    )
  })
})

describe('decodeMoneyFields', () => {
  it('replaces the cents column with the public eur field', () => {
    const doc = decodeMoneyFields({ eurCents: 123456, count: 7 }, statisticsMoneyFields)
    expect(doc).toEqual({ eur: 1234.56, count: 7 })
    expect('eurCents' in doc).toBe(false)
  })

  it('decodes zero cents to zero eur', () => {
    expect(decodeMoneyFields({ eurCents: 0 }, statisticsMoneyFields).eur).toBe(0)
  })

  it('leaves rows without the cents column untouched', () => {
    const doc = decodeMoneyFields({ count: 1 }, statisticsMoneyFields)
    expect(doc).toEqual({ count: 1 })
  })

  it('returns the row unchanged without a money map', () => {
    const row = { id: 'a1', status: 'published' }
    expect(decodeMoneyFields(row, {})).toBe(row)
  })

  it('rejects a non-integer cents value', () => {
    expect(() => decodeMoneyFields({ eurCents: 1234.5 }, statisticsMoneyFields)).toThrow(
      InvalidMoneyError,
    )
  })
})

describe('content money boundary round-trip', () => {
  it('round-trips eur through encode then decode', () => {
    const encoded = encodeMoneyFields({ eur: 99.99, count: 2 }, statisticsMoneyFields)
    const decoded = decodeMoneyFields(encoded, statisticsMoneyFields)
    expect(decoded.eur).toBe(99.99)
    expect(decoded.count).toBe(2)
  })

  it('uses the same conversion as the money helpers', () => {
    expect(encodeMoneyFields({ eur: 42.5 }, statisticsMoneyFields).eurCents).toBe(eurosToCents(42.5))
    expect(decodeMoneyFields({ eurCents: eurosToCents(42.5) }, statisticsMoneyFields).eur).toBe(42.5)
  })
})
