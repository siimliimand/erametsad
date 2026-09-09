import { describe, expect, it } from 'vitest'

import { maskClientName, sisuPreview } from '../display'

describe('maskClientName (task 8.5)', () => {
  it('keeps the first part and masks the rest to initials', () => {
    expect(maskClientName('Priit Põhjamets')).toBe('Priit P.')
    expect(maskClientName('Mari Jaanika Maasikas')).toBe('Mari J. M.')
  })

  it('masks a single-part name to one initial', () => {
    expect(maskClientName('Mati')).toBe('M.')
  })

  it('falls back to a dash for empty values', () => {
    expect(maskClientName(null)).toBe('—')
    expect(maskClientName('   ')).toBe('—')
    expect(maskClientName(42)).toBe('—')
  })
})

describe('sisuPreview (task 8.5)', () => {
  it('prefers the comment, then provisions, then the services', () => {
    expect(sisuPreview({ comment: 'Palun pakkumine peagi.' })).toBe('Palun pakkumine peagi.')
    expect(sisuPreview({ provisions: 'Mets on nõuetekohaselt hooldatud.' })).toBe(
      'Mets on nõuetekohaselt hooldatud.',
    )
    expect(sisuPreview({ services: ['hooldusraie', 'istutamine'] })).toBe(
      'Teenused: hooldusraie, istutamine',
    )
    expect(sisuPreview({ cadastres: ['78402:003:0210', '78904:101:0123'] })).toBe('Katastrid: 2')
  })

  it('truncates long text with an ellipsis', () => {
    const preview = sisuPreview({ comment: 'x'.repeat(120) })
    expect(preview).toHaveLength(60)
    expect(preview.endsWith('…')).toBe(true)
  })

  it('shows a dash for empty payloads', () => {
    expect(sisuPreview({})).toBe('—')
    expect(sisuPreview(null)).toBe('—')
    expect(sisuPreview({ comment: '  ' })).toBe('—')
  })
})
