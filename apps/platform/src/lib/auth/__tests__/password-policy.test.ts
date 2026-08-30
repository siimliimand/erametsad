import { describe, expect, it } from 'vitest'

import { PASSWORD_MIN_LENGTH, checkPasswordPolicy } from '../password-policy'

describe('checkPasswordPolicy', () => {
  it('accepts a password that meets every rule', () => {
    expect(checkPasswordPolicy('Öige-Salasõna1')).toEqual([])
  })

  it('accepts a password at the exact minimum length', () => {
    expect(checkPasswordPolicy('Ab1!xAb1!x')).toEqual([])
  })

  it('rejects a password shorter than the minimum length', () => {
    const violations = checkPasswordPolicy('Ab1!x')
    expect(violations[0]?.code).toBe('minLength')
    expect(violations[0]?.message).toBe(
      `Parool peab olema vähemalt ${String(PASSWORD_MIN_LENGTH)} tähemärki`,
    )
  })

  it('requires an uppercase letter', () => {
    expect(checkPasswordPolicy('salasõna1!x').map((v) => v.code)).toEqual([
      'hasUppercase',
    ])
  })

  it('requires a number', () => {
    expect(checkPasswordPolicy('Salasõna!x').map((v) => v.code)).toEqual([
      'hasNumber',
    ])
  })

  it('requires a symbol', () => {
    expect(checkPasswordPolicy('Salasõna1x').map((v) => v.code)).toEqual([
      'hasSymbol',
    ])
  })

  it('reports every failed rule in display order', () => {
    expect(checkPasswordPolicy('aaa').map((v) => v.code)).toEqual([
      'minLength',
      'hasUppercase',
      'hasNumber',
      'hasSymbol',
    ])
  })

  it('rejects a password equal to the isikukood', () => {
    // An 11-digit isikukood cannot satisfy the upper/symbol classes, so the
    // notIsikukood failure always appears next to them.
    const violations = checkPasswordPolicy('38001010000', '38001010000')
    expect(violations.map((v) => v.code)).toEqual([
      'hasUppercase',
      'hasSymbol',
      'notIsikukood',
    ])
    expect(violations.at(-1)?.message).toBe('Parool ei tohi olla sinu isikukood')
  })

  it('compares trimmed values against the isikukood', () => {
    const violations = checkPasswordPolicy(' 38001010000 ', ' 38001010000 ')
    expect(violations.map((v) => v.code)).toContain('notIsikukood')
  })

  it('accepts a password that only appends to the isikukood', () => {
    expect(checkPasswordPolicy('38001010000A!', '38001010000')).toEqual([])
  })

  it('skips the isikukood rule when the code is unknown', () => {
    expect(checkPasswordPolicy('38001010000A!', null)).toEqual([])
    expect(checkPasswordPolicy('38001010000A!', undefined)).toEqual([])
  })
})
