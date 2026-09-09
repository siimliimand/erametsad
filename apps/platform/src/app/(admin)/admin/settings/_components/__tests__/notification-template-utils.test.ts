import { describe, expect, it } from 'vitest'

import {
  insertVariableAtCursor,
  renderTemplate,
  smsSegmentInfo,
  templateVariables,
} from '../notification-template-utils'

describe('smsSegmentInfo', () => {
  it('counts zero chars for an empty body', () => {
    expect(smsSegmentInfo('')).toEqual({ chars: 0, segments: 0 })
  })

  it('counts one segment at the 160-char GSM-7 limit', () => {
    expect(smsSegmentInfo('a'.repeat(160))).toEqual({ chars: 160, segments: 1 })
  })

  it('splits a 161-char body into two 153-char segments', () => {
    expect(smsSegmentInfo('a'.repeat(161))).toEqual({ chars: 161, segments: 2 })
  })

  it('counts astral characters as one char each', () => {
    expect(smsSegmentInfo('ä'.repeat(10)).chars).toBe(10)
  })

  it('counts three segments for a 400-char body', () => {
    expect(smsSegmentInfo('a'.repeat(400)).segments).toBe(3)
  })
})

describe('insertVariableAtCursor', () => {
  it('inserts the token at the cursor and moves the caret after it', () => {
    const result = insertVariableAtCursor('Tere ', 5, 'auctionTitle')
    expect(result.text).toBe('Tere {{auctionTitle}}')
    expect(result.cursor).toBe('Tere {{auctionTitle}}'.length)
  })

  it('inserts in the middle of the text', () => {
    const result = insertVariableAtCursor('abcd', 2, 'amount')
    expect(result.text).toBe('ab{{amount}}cd')
    expect(result.cursor).toBe(2 + '{{amount}}'.length)
  })

  it('clamps an out-of-range cursor to the text length', () => {
    const result = insertVariableAtCursor('abc', 99, 'reason')
    expect(result.text).toBe('abc{{reason}}')
  })

  it('covers every documented variable name', () => {
    for (const variable of templateVariables) {
      const result = insertVariableAtCursor('', 0, variable.name)
      expect(result.text).toBe(`{{${variable.name}}}`)
    }
  })
})

describe('renderTemplate', () => {
  it('replaces known tokens with their values', () => {
    expect(renderTemplate('Tere, {{auctionTitle}}!', { auctionTitle: 'Mets' })).toBe(
      'Tere, Mets!',
    )
  })

  it('leaves unknown tokens untouched', () => {
    expect(renderTemplate('Tere {{unknown}}', {})).toBe('Tere {{unknown}}')
  })

  it('replaces multiple tokens in one pass', () => {
    expect(
      renderTemplate('{{auctionTitle}}: {{amount}} EUR', { auctionTitle: 'Mets', amount: '15' }),
    ).toBe('Mets: 15 EUR')
  })
})
