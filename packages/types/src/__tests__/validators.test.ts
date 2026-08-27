import { describe, it, expect } from 'vitest'
import { validators } from '../validators'

describe('EEPhone', () => {
  it('accepts +372 with 7 digits', () => {
    expect(validators.EEPhone.safeParse('+3725123456').success).toBe(true)
  })

  it('accepts +372 with 8 digits', () => {
    expect(validators.EEPhone.safeParse('+37251234567').success).toBe(true)
  })

  it('rejects +372 with 6 digits', () => {
    expect(validators.EEPhone.safeParse('+372512345').success).toBe(false)
  })

  it('rejects +372 with 9 digits', () => {
    expect(validators.EEPhone.safeParse('+372512345678').success).toBe(false)
  })

  it('rejects missing prefix', () => {
    expect(validators.EEPhone.safeParse('51234567').success).toBe(false)
  })

  it('rejects wrong country code', () => {
    expect(validators.EEPhone.safeParse('+37151234567').success).toBe(false)
  })

  it('rejects non-digit characters after prefix', () => {
    expect(validators.EEPhone.safeParse('+3725123456a').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validators.EEPhone.safeParse('').success).toBe(false)
  })
})

describe('EEIsikukood', () => {
  it('accepts valid personal ID code', () => {
    expect(validators.EEIsikukood.safeParse('30000000003').success).toBe(true)
  })

  it('accepts another valid code', () => {
    expect(validators.EEIsikukood.safeParse('40000000004').success).toBe(true)
  })

  it('rejects code with invalid checksum', () => {
    expect(validators.EEIsikukood.safeParse('30000000004').success).toBe(false)
  })

  it('rejects code shorter than 11 digits', () => {
    expect(validators.EEIsikukood.safeParse('3000000000').success).toBe(false)
  })

  it('rejects code longer than 11 digits', () => {
    expect(validators.EEIsikukood.safeParse('300000000030').success).toBe(false)
  })

  it('rejects code with first digit 0', () => {
    expect(validators.EEIsikukood.safeParse('00000000003').success).toBe(false)
  })

  it('rejects code with first digit 9', () => {
    expect(validators.EEIsikukood.safeParse('90000000003').success).toBe(false)
  })

  it('rejects non-numeric code', () => {
    expect(validators.EEIsikukood.safeParse('ABCDEFGHIJK').success).toBe(false)
  })
})

describe('EERegistrikood', () => {
  it('accepts exactly 8 digits', () => {
    expect(validators.EERegistrikood.safeParse('12345678').success).toBe(true)
  })

  it('accepts all zeros', () => {
    expect(validators.EERegistrikood.safeParse('00000000').success).toBe(true)
  })

  it('rejects 7 digits', () => {
    expect(validators.EERegistrikood.safeParse('1234567').success).toBe(false)
  })

  it('rejects 9 digits', () => {
    expect(validators.EERegistrikood.safeParse('123456789').success).toBe(false)
  })

  it('rejects non-numeric characters', () => {
    expect(validators.EERegistrikood.safeParse('1234567a').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validators.EERegistrikood.safeParse('').success).toBe(false)
  })
})

describe('EECadastral', () => {
  it('accepts valid cadastral code format', () => {
    expect(validators.EECadastral.safeParse('12345:678:9012').success).toBe(true)
  })

  it('accepts zero-filled cadastral code', () => {
    expect(validators.EECadastral.safeParse('00000:000:0000').success).toBe(true)
  })

  it('rejects missing colons', () => {
    expect(validators.EECadastral.safeParse('123456789012').success).toBe(false)
  })

  it('rejects wrong digit counts', () => {
    expect(validators.EECadastral.safeParse('1234:678:9012').success).toBe(false)
    expect(validators.EECadastral.safeParse('123456:789:012').success).toBe(false)
  })

  it('rejects non-digit characters', () => {
    expect(validators.EECadastral.safeParse('1234a:678:9012').success).toBe(false)
  })

  it('rejects empty string', () => {
    expect(validators.EECadastral.safeParse('').success).toBe(false)
  })
})
