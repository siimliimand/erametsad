import { describe, expect, it } from 'vitest'

import {
  PLACEHOLDER_GROUPS,
  buildValidationMessage,
  extractTemplateTokens,
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
