import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  PASSWORD_MIN_LENGTH,
  PasswordStrengthMeter,
  evaluatePassword,
} from '../PasswordStrengthMeter'

// 10 characters: length ok, uppercase ok, number ok, symbol ok.
const VALID_10 = 'Aa1!bbbbbb'
// Same length, one rule broken per variant.
const NO_UPPER_10 = 'aa1!bbbbbb'
const NO_NUMBER_10 = 'Aa!bbbbbbb'
const NO_SYMBOL_10 = 'Aa1bbbbbbb'
const TOO_SHORT_9 = 'Aa1!bbbbb'

describe('evaluatePassword rules', () => {
  it('accepts a password that meets every rule', () => {
    const result = evaluatePassword(VALID_10)
    expect(result.rules).toEqual({
      minLength: true,
      hasUppercase: true,
      hasNumber: true,
      hasSymbol: true,
      notIsikukood: true,
    })
    expect(result.valid).toBe(true)
  })

  it('flips minLength between 9 and 10 characters', () => {
    expect(evaluatePassword(TOO_SHORT_9).rules.minLength).toBe(false)
    expect(evaluatePassword(VALID_10).rules.minLength).toBe(true)
    expect(evaluatePassword('').rules.minLength).toBe(false)
  })

  it('flips hasUppercase when the only uppercase letter is removed', () => {
    expect(evaluatePassword(NO_UPPER_10).rules.hasUppercase).toBe(false)
    expect(evaluatePassword(VALID_10).rules.hasUppercase).toBe(true)
  })

  it('accepts Unicode uppercase (Õ) for hasUppercase', () => {
    const estonian = 'Õa1!bbbbb'
    expect(evaluatePassword(estonian).rules.hasUppercase).toBe(true)
    expect(evaluatePassword('õa1!bbbbb').rules.hasUppercase).toBe(false)
  })

  it('flips hasNumber when the only digit is removed', () => {
    expect(evaluatePassword(NO_NUMBER_10).rules.hasNumber).toBe(false)
    expect(evaluatePassword(VALID_10).rules.hasNumber).toBe(true)
  })

  it('flips hasSymbol when the only symbol is removed', () => {
    expect(evaluatePassword(NO_SYMBOL_10).rules.hasSymbol).toBe(false)
    expect(evaluatePassword(VALID_10).rules.hasSymbol).toBe(true)
  })

  it('does not treat spaces or letters as symbols', () => {
    // Space and accented letters must not satisfy hasSymbol.
    const result = evaluatePassword('Õa1 bbbbb').rules
    expect(result.hasSymbol).toBe(false)
    expect(result.hasUppercase).toBe(true)
  })

  it('rejects the viewer isikukood as password', () => {
    const isikukood = '37102240015'
    const equal = evaluatePassword(isikukood, isikukood)
    expect(equal.rules.notIsikukood).toBe(false)
    expect(equal.valid).toBe(false)
  })

  it('compares the isikukood after trimming', () => {
    const isikukood = '37102240015'
    expect(evaluatePassword(`  ${isikukood}  `, isikukood).rules.notIsikukood).toBe(false)
  })

  it('passes notIsikukood when no isikukood is given', () => {
    expect(evaluatePassword(VALID_10, null).rules.notIsikukood).toBe(true)
    expect(evaluatePassword(VALID_10).rules.notIsikukood).toBe(true)
  })

  it('passes notIsikukood for a different 11-digit string', () => {
    expect(evaluatePassword(VALID_10, '49905120017').rules.notIsikukood).toBe(true)
  })
})

describe('evaluatePassword tiers', () => {
  it('maps any invalid password to weak', () => {
    expect(evaluatePassword(TOO_SHORT_9).tier).toBe('weak')
    expect(evaluatePassword(NO_UPPER_10).tier).toBe('weak')
    expect(evaluatePassword(NO_NUMBER_10).tier).toBe('weak')
    expect(evaluatePassword(NO_SYMBOL_10).tier).toBe('weak')
    expect(evaluatePassword('').tier).toBe('weak')
  })

  it('maps a valid password of length 10-11 to medium', () => {
    expect(evaluatePassword(VALID_10).tier).toBe('medium')
    expect(evaluatePassword('Aa1!bbbbbbb').tier).toBe('medium') // 11 chars
  })

  it('maps a valid password of length 12+ to strong', () => {
    expect(evaluatePassword('Aa1!bbbbbbbb').tier).toBe('strong') // 12 chars
    expect(evaluatePassword('Aa1!bbbbbbbbbbbb').tier).toBe('strong')
  })

  it('keeps the submit gate closed exactly while the password is invalid', () => {
    // Submit gate = at least medium; invalid passwords are weak.
    const cases = [
      VALID_10,
      NO_UPPER_10,
      NO_NUMBER_10,
      NO_SYMBOL_10,
      TOO_SHORT_9,
      'Aa1!bbbbbbbb',
    ]
    for (const password of cases) {
      const { valid, tier } = evaluatePassword(password)
      expect(tier !== 'weak').toBe(valid)
    }
  })

  it('exports PASSWORD_MIN_LENGTH as 10', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10)
  })
})

describe('PasswordStrengthMeter markup', () => {
  it('shows the medium tier label when all rules pass', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: VALID_10 }))
    expect(html).toContain('Kesine')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('Täitmata')
  })

  it('shows the weak tier label and unticked rules when a rule fails', () => {
    const html = renderToString(
      createElement(PasswordStrengthMeter, { password: NO_UPPER_10 }),
    )
    expect(html).toContain('Nõrk')
    expect(html).toContain('Täitmata')
    expect(html).toContain('Vähemalt üks suurtäht')
  })

  it('shows the strong tier label for 12+ characters', () => {
    const html = renderToString(
      createElement(PasswordStrengthMeter, { password: 'Aa1!bbbbbbbb' }),
    )
    expect(html).toContain('Tugev')
  })

  it('shows the placeholder label for an empty password', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: '' }))
    expect(html).toContain('Parooli tugevus')
    expect(html).not.toContain('Kesine')
  })

  it('lists the minimum length rule with the configured length', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: VALID_10 }))
    expect(html).toContain(`Vähemalt ${String(PASSWORD_MIN_LENGTH)} tähemärki`)
  })

  it('flags a password equal to the isikukood with the isikukood rule', () => {
    const isikukood = '37102240015'
    const html = renderToString(
      createElement(PasswordStrengthMeter, { password: isikukood, isikukood }),
    )
    expect(html).toContain('Ei tohi olla sinu isikukood')
    expect(html).toContain('Nõrk')
  })

  it('renders every rule label', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: VALID_10 }))
    expect(html).toContain('Vähemalt üks suurtäht')
    expect(html).toContain('Vähemalt üks number')
    expect(html).toContain('Vähemalt üks sümbol')
    expect(html).toContain('Ei tohi olla sinu isikukood')
  })
})
