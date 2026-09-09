import { describe, expect, it } from 'vitest'

import {
  PLACEHOLDER_GROUPS,
  buildValidationMessage,
  extractTemplateTokens,
  filterPlaceholderGroups,
  isKnownToken,
  templateFixtureData,
  validateTemplateTokens,
} from './placeholder-catalogue'

const AUCTION_TEMPLATE = [
  'Leping {{bidder.name}} ({{bidder.isikukood}})',
  'Oksjon {{lot.id}} — {{lot.name}}',
  'Lõpphind {{lot.finalPrice}}, tasu {{fee.total}}.',
].join(' ')

describe('extractTemplateTokens', () => {
  it('extracts ordered unique tokens and tolerates whitespace', () => {
    expect(extractTemplateTokens('{{a.b}} {{ c.d }} {{a.b}} text {{e}}')).toEqual([
      'a.b',
      'c.d',
      'e',
    ])
  })

  it('ignores malformed braces', () => {
    expect(extractTemplateTokens('{ single } {{ }} {{ok}}')).toEqual(['ok'])
  })
})

describe('validateTemplateTokens', () => {
  it('accepts a complete auction template', () => {
    const tokens = extractTemplateTokens(AUCTION_TEMPLATE)
    expect(validateTemplateTokens('auction', tokens)).toEqual({ ok: true })
  })

  it('accepts the registrikood and bid.amount alternatives', () => {
    const tokens = extractTemplateTokens(
      '{{bidder.name}} {{bidder.registrikood}} {{lot.id}} {{bid.amount}} {{fee.total}}',
    )
    expect(validateTemplateTokens('auction', tokens)).toEqual({ ok: true })
  })

  it('rejects unknown tokens and lists them', () => {
    const tokens = extractTemplateTokens(`${AUCTION_TEMPLATE} {{lot.nonexistent}}`)
    const result = validateTemplateTokens('auction', tokens)
    expect(result).toEqual({ ok: false, unknown: ['lot.nonexistent'], missing: [] })
  })

  it('rejects a template missing required auction tokens', () => {
    const result = validateTemplateTokens('auction', ['bidder.name', 'lot.id'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.missing).toContainEqual(['fee.total'])
      expect(result.missing).toContainEqual(['lot.finalPrice', 'bid.amount'])
    }
  })

  it('enforces the framework requirements', () => {
    expect(validateTemplateTokens('framework', ['bidder.name', 'company.legalName', 'date.today'])).toEqual({
      ok: true,
    })
    const result = validateTemplateTokens('framework', ['bidder.name'])
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(buildValidationMessage(result)).toContain('{{company.legalName}}')
    }
  })

  it('builds an Estonian message for unknown and missing tokens', () => {
    const result = validateTemplateTokens('auction', ['lot.nonexistent'])
    const message = buildValidationMessage(result)
    expect(message).toContain('{{lot.nonexistent}}')
    expect(message).toContain('Nõutud kohatäited puuduvad')
  })

  it('returns no message for a valid template', () => {
    expect(buildValidationMessage({ ok: true })).toBeNull()
  })

  it('lists unknown tokens with the catalogue-only hint', () => {
    const complete = ['bidder.name', 'bidder.isikukood', 'lot.id', 'lot.finalPrice', 'fee.total']
    const message = buildValidationMessage(validateTemplateTokens('auction', [...complete, 'lot.nonexistent']))
    expect(message).toBe('Tundmatud kohatäited: {{lot.nonexistent}}. Kasuta ainult kataloogi kohatäiteid.')
  })

  it('joins the unknown and missing parts in one message', () => {
    const message = buildValidationMessage(
      validateTemplateTokens('auction', ['lot.nonexistent', 'bidder.name', 'lot.id']),
    )
    expect(message).toContain('Tundmatud kohatäited: {{lot.nonexistent}}')
    expect(message).toContain('{{bidder.isikukood}} või {{bidder.registrikood}}')
    expect(message).toContain('{{lot.finalPrice}} või {{bid.amount}}; {{fee.total}}.')
  })
})

describe('filterPlaceholderGroups', () => {
  it('returns every group untouched for an empty or blank query', () => {
    expect(filterPlaceholderGroups(PLACEHOLDER_GROUPS, '')).toEqual([...PLACEHOLDER_GROUPS])
    expect(filterPlaceholderGroups(PLACEHOLDER_GROUPS, '   ')).toHaveLength(
      PLACEHOLDER_GROUPS.length,
    )
  })

  it('keeps only the groups and tokens matching the needle case-insensitively', () => {
    const filtered = filterPlaceholderGroups(PLACEHOLDER_GROUPS, 'CADASTRE')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.label).toBe('Oksjon')
    expect(filtered[0]?.tokens).toEqual(['lot.cadastres'])
  })

  it('matches the group tokens by substring and drops empty groups', () => {
    const filtered = filterPlaceholderGroups(PLACEHOLDER_GROUPS, 'fee.')
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.tokens.every((token) => token.startsWith('fee.'))).toBe(true)
    expect(filterPlaceholderGroups(PLACEHOLDER_GROUPS, 'puudub-täielikult')).toEqual([])
  })

  it('matches partial names like bidder across the catalogue', () => {
    const filtered = filterPlaceholderGroups(PLACEHOLDER_GROUPS, 'bidder')
    expect(filtered.map((group) => group.label)).toEqual(['Pakkuja'])
  })
})

describe('catalogue hygiene', () => {
  it('keeps every token unique across the groups', () => {
    const tokens = PLACEHOLDER_GROUPS.flatMap((group) => group.tokens)
    expect(new Set(tokens).size).toBe(tokens.length)
  })

  it('labels every group and ships non-empty token lists', () => {
    for (const group of PLACEHOLDER_GROUPS) {
      expect(group.label, group.label).not.toBe('')
      expect(group.tokens.length, group.label).toBeGreaterThan(0)
    }
  })

  it('fills the fixture with the documented sample values', () => {
    const fixture = templateFixtureData()
    expect(fixture['bidder.name']).toBe('Test Testov')
    expect(fixture['bidder.registrikood']).toBe('14309277')
    expect(fixture['lot.finalPrice']).toBe('61 000 €')
    expect(fixture['company.legalName']).toBe('Tamm OÜ')
    expect(fixture.auctionTitle).toBe('Testioksjon #1')
  })
})

describe('catalogue and fixture coherence', () => {
  it('covers every catalogue token in the fixture data', () => {
    const fixture = templateFixtureData()
    for (const group of PLACEHOLDER_GROUPS) {
      for (const token of group.tokens) {
        expect(fixture[token], token).toBeTruthy()
      }
    }
  })

  it('marks catalogue tokens as known and others as unknown', () => {
    expect(isKnownToken('bidder.name')).toBe(true)
    expect(isKnownToken('lot.nonexistent')).toBe(false)
  })
})
