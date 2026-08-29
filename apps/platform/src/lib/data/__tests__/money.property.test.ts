import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  InvalidMoneyError,
  MAX_CENTS,
  centsToEuros,
  contentCollections,
  createCoreRepositories,
  decodeMoneyFields,
  encodeMoneyFields,
  eurosToCents,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../repositories'
import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from './sqlite'

process.env.ISIKUKOOD_ENCRYPTION_KEY = process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'money-property-key'

const CASES = 200
const MAX_GENERATED_EUR = 10_000_000
const moneyFields = contentCollections['statistics-snapshots'].moneyFields ?? {}

/** Deterministic PRNG so every failing case reproduces from the seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

interface ExactCase {
  eur: number
  cents: number
}

/** EUR with 0, 1, or 2 decimals, built from exact integer cents. */
function exactCases(seed: number): ExactCase[] {
  const rng = mulberry32(seed)
  const cases: ExactCase[] = [
    { eur: 0, cents: 0 },
    { eur: 0.01, cents: 1 },
    { eur: 0.1, cents: 10 },
    { eur: 0.99, cents: 99 },
    { eur: 1, cents: 100 },
    { eur: 1234.56, cents: 123_456 },
    { eur: 9_999_999.99, cents: 999_999_999 },
    { eur: MAX_GENERATED_EUR, cents: 1_000_000_000 },
  ]
  while (cases.length < CASES) {
    const kind = cases.length % 3
    const cents =
      kind === 0
        ? 100 * randInt(rng, 0, MAX_GENERATED_EUR)
        : kind === 1
          ? 10 * randInt(rng, 0, MAX_GENERATED_EUR * 10)
          : randInt(rng, 0, MAX_GENERATED_EUR * 100)
    cases.push({ eur: cents / 100, cents })
  }
  return cases
}

interface SubCentCase {
  eur: number
  expected: number
}

/** Three-decimal EUR; documented conversion is Math.round(eur * 100). */
function subCentCases(): SubCentCase[] {
  const rng = mulberry32(0x1c3d5e7f)
  const cases: SubCentCase[] = [
    { eur: 0.005, expected: 1 },
    { eur: 0.015, expected: 2 },
    { eur: 19.995, expected: 2000 },
  ]
  while (cases.length < CASES) {
    const eur = randInt(rng, 1, 1_000_000_000_000) / 1000
    cases.push({ eur, expected: Math.round(eur * 100) })
  }
  return cases
}

function badAmounts(): unknown[] {
  const rng = mulberry32(0x0bad_a2c5)
  const pool: unknown[] = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    null,
    true,
    '',
    '10',
    '12.34',
    'abc',
    '1e3',
    ' 42',
  ]
  while (pool.length < CASES) {
    const kind = pool.length % 4
    if (kind === 0) pool.push(-(rng() * (MAX_GENERATED_EUR + 1)))
    else if (kind === 1) pool.push(Number.NaN)
    else if (kind === 2) pool.push(String(randInt(rng, 0, MAX_GENERATED_EUR)))
    else pool.push(pool.length % 8 === 3 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY)
  }
  return pool
}

function badCents(): unknown[] {
  const rng = mulberry32(0xdead_ce57)
  const pool: unknown[] = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    '100',
    null,
    true,
    Number.MAX_SAFE_INTEGER + 1,
    2 ** 53,
    MAX_CENTS + 1,
    -MAX_CENTS - 1,
    1e30,
  ]
  while (pool.length < CASES) {
    const kind = pool.length % 3
    if (kind === 0) pool.push(randInt(rng, 1, MAX_CENTS) + 0.5)
    else if (kind === 1) pool.push(String(randInt(rng, 1, 100_000)))
    else pool.push(randInt(rng, 1, 100) + 0.25)
  }
  return pool
}

const MAX_EUR = MAX_CENTS / 100

/** EUR values straddling the documented MAX_CENTS precision boundary. */
function boundaryEurs(): number[] {
  const rng = mulberry32(0xb0bd_a2c5)
  const cases = [MAX_EUR, MAX_EUR + 0.01, MAX_EUR + 1, MAX_EUR * 2, 1e17]
  while (cases.length < CASES) {
    cases.push(MAX_EUR - 5_000_000_000 + rng() * 10_000_000_000)
  }
  return cases
}

function dateForIndex(index: number): string {
  return new Date(Date.UTC(2020, 0, 1) + index * 86_400_000).toISOString().slice(0, 10)
}

describe('property: EUR -> cents -> EUR round-trip', () => {
  it('never loses integer cents for exact 0/1/2-decimal EUR', () => {
    for (const { eur, cents } of exactCases(0x6d6f_6e65)) {
      const converted = eurosToCents(eur)
      expect(Number.isInteger(converted), `eur=${String(eur)}`).toBe(true)
      expect(converted, `eur=${String(eur)}`).toBe(cents)
      expect(centsToEuros(converted), `cents=${String(cents)}`).toBe(eur)
    }
  })

  it('rounds sub-cent EUR to exact integer cents and stays stable', () => {
    for (const { eur, expected } of subCentCases()) {
      const converted = eurosToCents(eur)
      expect(Number.isInteger(converted), `eur=${String(eur)}`).toBe(true)
      expect(converted, `eur=${String(eur)}`).toBe(expected)
      expect(Math.abs(converted - eur * 100), `eur=${String(eur)}`).toBeLessThanOrEqual(0.5 + 1e-6)
      const decoded = centsToEuros(converted)
      expect(Math.round(decoded * 100), `eur=${String(eur)}`).toBe(converted)
      expect(eurosToCents(decoded), `eur=${String(eur)}`).toBe(converted)
    }
  })
})

describe('property: encode/decode money fields round-trip', () => {
  it('converts eur to integer cents and back without drift', () => {
    for (const { eur, cents } of exactCases(0xc0de_c0de)) {
      const encoded = encodeMoneyFields({ eur, count: 3 }, moneyFields)
      expect(encoded.eurCents, `eur=${String(eur)}`).toBe(cents)
      const decoded = decodeMoneyFields(encoded, moneyFields)
      expect(decoded.eur, `cents=${String(cents)}`).toBe(eur)
      expect(decoded.count, `eur=${String(eur)}`).toBe(3)
    }
  })
})

describe('property: money storage through SQLite repositories', () => {
  let testDb: SqliteTestDb
  let repos: CoreRepositories

  beforeEach(() => {
    testDb = createSqliteTestDb()
    repos = createCoreRepositories(testDb.database, {
      isikukoodCodec: nodeIsikukoodCodec,
      batch: sqliteBatchRunner(testDb.raw),
    })
  })

  afterEach(() => {
    testDb.close()
  })

  it('stores EUR as INTEGER cents on create and update, with no REAL drift', async () => {
    const dated = exactCases(0x5714_5702).map((trial, index) => ({
      ...trial,
      date: dateForIndex(index),
      count: index % 1000,
    }))
    const rawSelect = testDb.raw.prepare(
      'select typeof(eur_cents) as storage, eur_cents from statistics_snapshots where id = ?',
    )
    for (const { eur, cents, date, count } of dated) {
      const label = `eur=${String(eur)}`
      const created = await repos.create({
        collection: 'statistics-snapshots',
        data: { date, objectType: 'raieoigus', count, eur },
      })
      expect(created.eur, label).toBe(eur)
      expect('eurCents' in created, label).toBe(false)

      const stored = rawSelect.get(created.id) as { storage: string; eur_cents: number }
      expect(stored.storage, label).toBe('integer')
      expect(stored.eur_cents, label).toBe(cents)

      const mirrorCents = 1_000_000_000 - cents
      const mirrorEur = mirrorCents / 100
      const updated = await repos.update({
        collection: 'statistics-snapshots',
        id: created.id,
        data: { eur: mirrorEur },
      })
      expect(updated.eur, label).toBe(mirrorEur)

      const restored = rawSelect.get(created.id) as { storage: string; eur_cents: number }
      expect(restored.storage, label).toBe('integer')
      expect(restored.eur_cents, label).toBe(mirrorCents)

      const read = await repos.findByID({ collection: 'statistics-snapshots', id: created.id })
      expect(read?.eur, label).toBe(mirrorEur)
      expect(read !== null && 'eurCents' in read, label).toBe(false)
    }
  })
})

describe('property: boundary safety', () => {
  it('rejects negative, non-finite, and non-numeric EUR amounts', () => {
    for (const value of badAmounts()) {
      const label = `value=${String(value)} (${typeof value})`
      expect(() => eurosToCents(value as number), label).toThrow(InvalidMoneyError)
      expect(() => encodeMoneyFields({ eur: value }, moneyFields), label).toThrow(InvalidMoneyError)
    }
  })

  it('rejects non-integer, non-finite, and out-of-range cents', () => {
    for (const value of badCents()) {
      const label = `value=${String(value)} (${typeof value})`
      expect(() => centsToEuros(value as number), label).toThrow(InvalidMoneyError)
      expect(() => decodeMoneyFields({ eurCents: value }, moneyFields), label).toThrow(
        InvalidMoneyError,
      )
    }
  })
})

describe('property: large values at the precision boundary', () => {
  it('accepts cents up to MAX_CENTS and rejects anything past it', () => {
    expect(eurosToCents(MAX_EUR)).toBe(MAX_CENTS)
    expect(centsToEuros(MAX_CENTS)).toBe(MAX_EUR)
    expect(eurosToCents(centsToEuros(MAX_CENTS))).toBe(MAX_CENTS)
    expect(() => eurosToCents(MAX_EUR + 0.01)).toThrow(InvalidMoneyError)
    expect(() => centsToEuros(MAX_CENTS + 1)).toThrow(InvalidMoneyError)
  })

  it('gives every oversized input a defined, stable outcome', () => {
    for (const eur of boundaryEurs()) {
      const label = `eur=${String(eur)}`
      const attempt = (): number | InvalidMoneyError => {
        try {
          return eurosToCents(eur)
        } catch (error) {
          if (error instanceof InvalidMoneyError) {
            return error
          }
          throw error
        }
      }
      const first = attempt()
      const second = attempt()
      const outcomeId = (outcome: number | InvalidMoneyError): string =>
        outcome instanceof InvalidMoneyError ? `throw:${outcome.message}` : `cents:${String(outcome)}`
      expect(outcomeId(second), label).toBe(outcomeId(first))
      if (!(first instanceof InvalidMoneyError)) {
        expect(Number.isSafeInteger(first), label).toBe(true)
        expect(first, label).toBeLessThanOrEqual(MAX_CENTS)
        expect(eurosToCents(centsToEuros(first)), label).toBe(first)
      }
    }
  })
})
