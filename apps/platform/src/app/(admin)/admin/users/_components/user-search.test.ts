import { describe, expect, it, beforeAll, afterAll } from 'vitest'

import { classifyUserSearch, freetextMatchesUser, normalizeSearchInput } from './user-search'

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
