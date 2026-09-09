import { describe, expect, it, beforeAll, afterAll } from 'vitest'

import {
  chunkIds,
  classifyUserSearch,
  DEFAULT_USER_SORT,
  flaggedUserIdsFromEntries,
  freetextMatchesUser,
  normalizeSearchInput,
  parseUserListFilters,
  sortUserRows,
} from './user-search'

import { nodeIsikukoodCodec } from '@/lib/data/repositories'

const TEST_KEY = 'test-key-user-search'
let keyBackup: string | undefined

beforeAll(() => {
  keyBackup = process.env.ISIKUKOOD_ENCRYPTION_KEY
  process.env.ISIKUKOOD_ENCRYPTION_KEY = TEST_KEY
})

afterAll(() => {
  if (keyBackup === undefined) {
    delete process.env.ISIKUKOOD_ENCRYPTION_KEY
  } else {
    process.env.ISIKUKOOD_ENCRYPTION_KEY = keyBackup
  }
})

describe('classifyUserSearch', () => {
  it('classifies an 11-digit query as a hashed isikukood search', () => {
    const query = classifyUserSearch('38705160283')
    expect(query).toEqual({ kind: 'isikukood', hash: nodeIsikukoodCodec.hash('38705160283') })
  })

  it('ignores spaces inside an isikukood query', () => {
    const query = classifyUserSearch('387 0516 0283')
    expect(query).toEqual({ kind: 'isikukood', hash: nodeIsikukoodCodec.hash('38705160283') })
  })

  it('never returns the plaintext isikukood in the query', () => {
    const query = classifyUserSearch('38705160283')
    expect(query).not.toHaveProperty('plaintext')
    expect(JSON.stringify(query)).not.toContain('38705160283')
  })

  it('classifies email, name and registrikood input as freetext', () => {
    const email = classifyUserSearch('Kalle.Tamm@Example.ee')
    expect(email).toEqual({ kind: 'freetext', needle: 'kalle.tamm@example.ee', registrikood: 'Kalle.Tamm@Example.ee' })
    const name = classifyUserSearch('  Kalle Tamm  ')
    expect(name).toEqual({ kind: 'freetext', needle: 'kalle tamm', registrikood: 'Kalle Tamm' })
  })

  it('returns null for an empty query', () => {
    expect(classifyUserSearch('')).toBeNull()
    expect(classifyUserSearch('   ')).toBeNull()
  })

  it('treats a 10-digit number as freetext, not an isikukood', () => {
    const query = classifyUserSearch('1234567890')
    expect(query?.kind).toBe('freetext')
  })
})

describe('freetextMatchesUser', () => {
  const user = { id: 'u1', name: 'Kalle Tamm', email: 'kalle@tamm.ee', isikukoodHash: null }

  it('matches the email case-insensitively', () => {
    expect(freetextMatchesUser(user, { kind: 'freetext', needle: 'kalle@', registrikood: 'kalle@' })).toBe(true)
  })

  it('matches a name fragment', () => {
    expect(freetextMatchesUser(user, { kind: 'freetext', needle: 'tamm', registrikood: 'tamm' })).toBe(true)
  })

  it('does not match unrelated input', () => {
    expect(freetextMatchesUser(user, { kind: 'freetext', needle: 'marit', registrikood: 'marit' })).toBe(false)
  })
})

describe('normalizeSearchInput', () => {
  it('trims and strips inner whitespace', () => {
    expect(normalizeSearchInput('  3870 5160 283 ')).toBe('38705160283')
  })
})

describe('parseUserListFilters', () => {
  it('keeps known profile, status and right values', () => {
    expect(
      parseUserListFilters({ profile: 'specialist', status: 'suspended', right: 'raieoigus' }),
    ).toEqual({ role: 'specialist', status: 'suspended', right: 'raieoigus', marked: false })
  })

  it('keeps the märgitud (marked) shill-flag filter', () => {
    expect(parseUserListFilters({ marked: '1' })).toEqual({
      role: null,
      status: null,
      right: null,
      marked: true,
    })
    expect(parseUserListFilters({ marked: '' }).marked).toBe(false)
    expect(parseUserListFilters({ marked: 'yes' }).marked).toBe(false)
  })

  it('drops unknown values instead of throwing', () => {
    expect(parseUserListFilters({ profile: 'hacker', status: 'x', right: 'kittens' })).toEqual({
      role: null,
      status: null,
      right: null,
      marked: false,
    })
  })

  it('returns all-null filters for an unfiltered list', () => {
    expect(parseUserListFilters({})).toEqual({ role: null, status: null, right: null, marked: false })
    expect(parseUserListFilters({ profile: undefined, status: '', right: '' })).toEqual({
      role: null,
      status: null,
      right: null,
      marked: false,
    })
  })
})

describe('flaggedUserIdsFromEntries (shill flag fold)', () => {
  it('marks flagged users and removes them again on a later clear', () => {
    const entries = [
      { entityId: 'a', after: { phase: 'flagged' }, createdAt: '2026-01-01T00:00:00.000Z' },
      { entityId: 'a', after: { phase: 'cleared' }, createdAt: '2026-01-02T00:00:00.000Z' },
      { entityId: 'b', after: { phase: 'flagged' }, createdAt: '2026-01-03T00:00:00.000Z' },
    ]
    expect(flaggedUserIdsFromEntries(entries)).toEqual(new Set(['b']))
  })

  it('treats phase-less legacy entries as flagged', () => {
    const entries = [{ entityId: 'a', after: { reason: 'x' }, createdAt: '2026-01-01T00:00:00.000Z' }]
    expect(flaggedUserIdsFromEntries(entries)).toEqual(new Set(['a']))
  })

  it('parses JSON-string payloads and orders entries by createdAt itself', () => {
    const entries = [
      { entityId: 'a', after: JSON.stringify({ phase: 'cleared' }), createdAt: '2026-01-03T00:00:00.000Z' },
      { entityId: 'a', after: JSON.stringify({ phase: 'flagged' }), createdAt: '2026-01-01T00:00:00.000Z' },
    ]
    expect(flaggedUserIdsFromEntries(entries)).toEqual(new Set())
  })
})

describe('sortUserRows', () => {
  const rows = [
    { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', lastLogin: '2026-03-01T10:00:00.000Z' },
    { id: 'b', createdAt: '2026-02-01T00:00:00.000Z', lastLogin: null },
    { id: 'c', createdAt: '2026-03-01T00:00:00.000Z', lastLogin: '2026-01-01T10:00:00.000Z' },
    { id: 'd', createdAt: '2026-04-01T00:00:00.000Z', lastLogin: null },
  ]

  it('defaults to last login descending (the documented default sort)', () => {
    expect(DEFAULT_USER_SORT).toBe('-lastLogin')
    expect(sortUserRows(rows, DEFAULT_USER_SORT).map((row) => row.id)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('sorts users without a login last in both directions', () => {
    expect(sortUserRows(rows, 'lastLogin').map((row) => row.id)).toEqual(['c', 'a', 'd', 'b'])
  })

  it('orders never-logged-in rows newest account first', () => {
    const [first] = sortUserRows(rows, '-lastLogin').slice(-2)
    expect(first?.id).toBe('d')
  })

  it('supports the createdAt key with a leading-minus descending', () => {
    expect(sortUserRows(rows, 'createdAt').map((row) => row.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(sortUserRows(rows, '-createdAt').map((row) => row.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('falls back to the default sort for an unknown key', () => {
    expect(sortUserRows(rows, '-nonsense').map((row) => row.id)).toEqual(['a', 'c', 'd', 'b'])
  })

  it('does not mutate the input order', () => {
    const copy = [...rows]
    sortUserRows(rows, 'createdAt')
    expect(rows).toEqual(copy)
  })
})

describe('chunkIds', () => {
  it('splits id lists into D1-sized chunks', () => {
    const ids = Array.from({ length: 195 }, (_value, index) => `id-${String(index)}`)
    const chunks = chunkIds(ids)
    expect(chunks.map((chunk) => chunk.length)).toEqual([90, 90, 15])
    expect(chunks.flat()).toEqual(ids)
  })

  it('returns no chunks for an empty list', () => {
    expect(chunkIds([])).toEqual([])
  })
})
