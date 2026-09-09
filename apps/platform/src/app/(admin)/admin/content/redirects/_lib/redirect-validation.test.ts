import { describe, expect, it } from 'vitest'

import {
  MAX_REDIRECT_CHAIN_DEPTH,
  redirectChainHopsAfter,
  validateRedirect,
  validateRedirectRules,
} from './redirect-validation'

describe('validateRedirectRules', () => {
  it('requires a leading slash on both paths', () => {
    expect(validateRedirectRules('/vana', '/uus')).toBeNull()
    expect(validateRedirectRules('vana', '/uus')).toContain('kaldkriipsuga')
    expect(validateRedirectRules('/vana', 'uus')).toContain('kaldkriipsuga')
  })

  it('rejects a self-redirect', () => {
    expect(validateRedirectRules('/sama', '/sama')).toContain('iseendale')
  })
})

describe('redirectChainHopsAfter', () => {
  const byFrom = new Map([
    ['/b', '/c'],
    ['/c', '/d'],
  ])

  it('counts the hops an existing chain adds', () => {
    expect(redirectChainHopsAfter('/a', '/b', byFrom)).toBe(2)
    expect(redirectChainHopsAfter('/a', '/c', byFrom)).toBe(1)
  })

  it('returns zero when the target ends no chain', () => {
    expect(redirectChainHopsAfter('/a', '/terminal', byFrom)).toBe(0)
  })

  it('reports null for a cycle through the saved row', () => {
    // Saving /a→/b while /c→/a exists would create a→b→c→a.
    const cyclic = new Map(byFrom)
    cyclic.set('/c', '/a')
    expect(redirectChainHopsAfter('/a', '/b', cyclic)).toBeNull()
  })
})

describe('validateRedirect chain depth cap', () => {
  it('accepts a chain at the cap and rejects one past it', () => {
    let byFrom = new Map<string, string>()
    // Build the longest chain the cap allows after /a: /a→/b→…→(/cap+1 hops).
    for (let i = 0; i < MAX_REDIRECT_CHAIN_DEPTH; i += 1) {
      byFrom.set(`/${String.fromCharCode(98 + i)}`, `/${String.fromCharCode(99 + i)}`)
    }
    expect(validateRedirect('/a', '/b', byFrom)).toBeNull()

    byFrom.set(`/${String.fromCharCode(98 + MAX_REDIRECT_CHAIN_DEPTH)}`, '/liiga-pikk')
    expect(validateRedirect('/a', '/b', byFrom)).toContain('liiga pikk')
  })

  it('applies the path rules before the chain walk', () => {
    expect(validateRedirect('a', 'a', new Map())).toContain('kaldkriipsuga')
    expect(validateRedirect('/x', '/x', new Map())).toContain('iseendale')
  })
})
