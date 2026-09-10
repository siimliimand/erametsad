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
// 10 characters with only length, number and isikukood rules satisfied:
// exactly three rules -> the demo "Keskmine" tier.
const THREE_RULES_10 = 'aaaaaaaaaa1'

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
  it('maps fewer than three satisfied rules to weak', () => {
    // With no isikukood given, the notIsikukood rule always counts as met,
    // so '123' sits at two satisfied rules.
    expect(evaluatePassword('').tier).toBe('weak')
    expect(evaluatePassword('123').tier).toBe('weak')
  })

  it('maps exactly three satisfied rules to medium', () => {
    expect(evaluatePassword(THREE_RULES_10).tier).toBe('medium')
  })

  it('maps four and five satisfied rules to strong', () => {
    expect(evaluatePassword(TOO_SHORT_9).tier).toBe('strong') // 4 rules
    expect(evaluatePassword(NO_SYMBOL_10).tier).toBe('strong')
    expect(evaluatePassword(VALID_10).tier).toBe('strong')
  })

  it('keeps the submit gate tied to every rule, not the meter label', () => {
    // Four satisfied rules read "Tugev" on the meter but the password stays
    // invalid, so the PasswordForm gate (valid) still blocks submit.
    const fourRules = evaluatePassword(NO_SYMBOL_10)
    expect(fourRules.tier).toBe('strong')
    expect(fourRules.valid).toBe(false)
    expect(evaluatePassword(VALID_10).valid).toBe(true)
  })

  it('exports PASSWORD_MIN_LENGTH as 10', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10)
  })
})

describe('PasswordStrengthMeter markup', () => {
  it('renders five meter segments', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: VALID_10 }))
    expect(html.match(/h-1\.5 flex-1 rounded-pill/g)).toHaveLength(5)
  })

  it('shows the strong tier label and ticks every rule when all rules pass', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: VALID_10 }))
    expect(html).toContain('Tugev')
    expect(html).toContain('aria-live="polite"')
    expect(html).not.toContain('Täitmata')
  })

  it('shows the medium tier label when exactly three rules pass', () => {
    const html = renderToString(
      createElement(PasswordStrengthMeter, { password: THREE_RULES_10 }),
    )
    expect(html).toContain('Keskmine')
  })

  it('shows the weak tier label and unticked rules when fewer than three rules pass', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: '123' }))
    expect(html).toContain('Nõrk')
    expect(html).toContain('Täitmata')
    expect(html).toContain(`Vähemalt ${String(PASSWORD_MIN_LENGTH)} tähemärki`)
  })

  it('shows the placeholder label for an empty password', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: '' }))
    expect(html).toContain('Parooli tugevus')
    expect(html).not.toContain('Keskmine')
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
    expect(html).toContain('Ei tohi kattuda isikukoodiga')
    expect(html).toContain('Nõrk')
  })

  it('renders every rule label', () => {
    const html = renderToString(createElement(PasswordStrengthMeter, { password: VALID_10 }))
    expect(html).toContain('Üks suur täht')
    expect(html).toContain('Üks number')
    expect(html).toContain('Üks sümbol')
    expect(html).toContain('Ei tohi kattuda isikukoodiga')
  })
})
