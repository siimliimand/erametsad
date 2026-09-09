import { describe, expect, it } from 'vitest'

import {
  incrementCmsRedirectHitStatement,
  redirectLookupByFrom,
  resolveCmsRedirect,
} from '../cms-redirects'

describe('redirectLookupByFrom', () => {
  it('indexes active rows by from with valid types', () => {
    const lookup = redirectLookupByFrom([
      { from: '/vana', to: '/uus', type: '301' },
      { from: '/kampaania', to: '/teenused', type: '302' },
    ])
    expect(lookup.get('/vana')).toEqual({ from: '/vana', to: '/uus', type: '301' })
    expect(lookup.get('/kampaania')?.type).toBe('302')
  })

  it('skips rows with a non-redirect type', () => {
    const lookup = redirectLookupByFrom([{ from: '/vana', to: '/uus', type: 'meta' }])
    expect(lookup.size).toBe(0)
  })
})

describe('resolveCmsRedirect', () => {
  it('matches the exact pathname only', () => {
    const lookup = redirectLookupByFrom([{ from: '/vana-leht', to: '/uus-leht', type: '301' }])
    expect(resolveCmsRedirect(lookup, '/vana-leht')).not.toBeNull()
    expect(resolveCmsRedirect(lookup, '/vana-leht/alam')).toBeNull()
    expect(resolveCmsRedirect(lookup, '/puudub')).toBeNull()
  })
})

describe('incrementCmsRedirectHitStatement', () => {
  it('is a single parameterized UPDATE that never resets the counter', () => {
    const statement = incrementCmsRedirectHitStatement('/vana-leht')
    expect(statement.sql).toBe('UPDATE redirects SET hits = hits + 1 WHERE "from" = ?')
    expect(statement.params).toEqual(['/vana-leht'])
  })
})
