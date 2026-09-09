import { describe, expect, it } from 'vitest'

import { deriveCountyCodeFromCadastre } from '../cadastre-county'

describe('deriveCountyCodeFromCadastre', () => {
  it('maps the first cadastre to the county code', () => {
    expect(deriveCountyCodeFromCadastre('78402:003:0210')).toBe('HH')
    expect(deriveCountyCodeFromCadastre('78904:101:0123')).toBe('TA')
    expect(deriveCountyCodeFromCadastre('67405:501:0034')).toBe('SR')
  })

  it('uses the first entry when the field carries several cadastres', () => {
    expect(deriveCountyCodeFromCadastre('78402:003:0210, 78904:101:0123')).toBe('HH')
    expect(deriveCountyCodeFromCadastre('59410:501:1234 17401:001:0001')).toBe('PR')
  })

  it('returns null for empty or unknown input without throwing', () => {
    expect(deriveCountyCodeFromCadastre(null)).toBeNull()
    expect(deriveCountyCodeFromCadastre('')).toBeNull()
    expect(deriveCountyCodeFromCadastre('99999:999:9999')).toBeNull()
    expect(deriveCountyCodeFromCadastre('kinnistu ilma katastrita')).toBeNull()
  })
})
