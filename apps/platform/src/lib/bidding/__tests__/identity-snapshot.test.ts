import { describe, it, expect } from 'vitest'

import { parseIdentitySnapshot } from '../identity-snapshot'

// Valid checksum codes reused from the @eametsad/types validator tests.
const PRIVATE_SNAPSHOT = JSON.stringify({
  name: 'Mari Maasikas',
  isikukood: '30000000003',
  aadress: 'Puiestee 1, Tartu',
  email: 'mari@example.ee',
  telefon: '5512345',
})

const COMPANY_SNAPSHOT = JSON.stringify({
  name: 'Mets OÜ',
  registrikood: '12345678',
  aadress: 'Tänav 2, Viljandi',
  email: 'info@mets.ee',
  telefon: '+3725512345',
})

describe('parseIdentitySnapshot', () => {
  it('accepts a valid private snapshot with isikukood', () => {
    const result = parseIdentitySnapshot(PRIVATE_SNAPSHOT)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.snapshot).toBe(PRIVATE_SNAPSHOT)
  })

  it('accepts a valid company snapshot with registrikood', () => {
    const result = parseIdentitySnapshot(COMPANY_SNAPSHOT)
    expect(result.ok).toBe(true)
  })

  it('rejects a non-string value', () => {
    const result = parseIdentitySnapshot({ name: 'x' })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('JSON string')
  })

  it('rejects malformed JSON', () => {
    const result = parseIdentitySnapshot('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('valid JSON')
  })

  it('rejects a snapshot with an invalid isikukood checksum', () => {
    const invalid = PRIVATE_SNAPSHOT.replace('30000000003', '30000000004')
    const result = parseIdentitySnapshot(invalid)
    expect(result.ok).toBe(false)
  })

  it('rejects a registrikood that is not 8 digits', () => {
    const invalid = COMPANY_SNAPSHOT.replace('12345678', '1234567')
    const result = parseIdentitySnapshot(invalid)
    expect(result.ok).toBe(false)
  })

  it('rejects a snapshot without any code', () => {
    const result = parseIdentitySnapshot(
      JSON.stringify({
        name: 'Mari Maasikas',
        aadress: 'Puiestee 1, Tartu',
        email: 'mari@example.ee',
        telefon: '5512345',
      }),
    )
    expect(result.ok).toBe(false)
  })

  it('rejects an invalid email', () => {
    const invalid = PRIVATE_SNAPSHOT.replace('mari@example.ee', 'not-an-email')
    const result = parseIdentitySnapshot(invalid)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('identitySnapshot')
  })

  it('rejects empty required text fields', () => {
    const invalid = PRIVATE_SNAPSHOT.replace('Puiestee 1, Tartu', '')
    const result = parseIdentitySnapshot(invalid)
    expect(result.ok).toBe(false)
  })

  it('accepts a valid snapshot with extra unknown fields (additive forward-compat)', () => {
    const extended = JSON.stringify({
      ...JSON.parse(PRIVATE_SNAPSHOT),
      profileType: 'private',
    })
    const result = parseIdentitySnapshot(extended)
    expect(result.ok).toBe(true)
  })
})
