import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  SealedIdentityForm,
  identityAddressErrorMessage,
  identityCodeErrorMessage,
  identityCodeLabel,
  identityEmailErrorMessage,
  identityNameErrorMessage,
  identityNameLabel,
  identityPhoneErrorMessage,
  sealedIdentitySnapshot,
  validateEmail,
  validateIdentityCode,
  validateIsikukood,
  validateRegistrikood,
  type SealedIdentityErrors,
} from '../sealed/SealedIdentityForm'

// 11-digit codes whose check digit follows the Estonian 1..9,1 / 3..9,1,2,3
// weights; first digit is the sex/century digit (1-8).
const VALID_ISIKUKOOD = '37102240015'
const VALID_ISIKUKOOD_ALT = '49905120017'
const BAD_CHECKSUM = '37102240014'

describe('validateIsikukood', () => {
  it('accepts checksum-valid codes', () => {
    expect(validateIsikukood(VALID_ISIKUKOOD)).toBe(true)
    expect(validateIsikukood(VALID_ISIKUKOOD_ALT)).toBe(true)
    expect(validateIsikukood('32708100019')).toBe(true)
    expect(validateIsikukood('60301070014')).toBe(true)
  })

  it('rejects a wrong check digit', () => {
    expect(validateIsikukood(BAD_CHECKSUM)).toBe(false)
    expect(validateIsikukood('37102240016')).toBe(false)
  })

  it('rejects codes that are not exactly 11 digits', () => {
    expect(validateIsikukood('')).toBe(false)
    expect(validateIsikukood('3710224001')).toBe(false) // 10 digits
    expect(validateIsikukood('371022400155')).toBe(false) // 12 digits
    expect(validateIsikukood('G7102240015')).toBe(false) // letter
    expect(validateIsikukood('37102240 15')).toBe(false) // space
  })

  it('rejects an invalid sex/century digit', () => {
    expect(validateIsikukood('07102240015')).toBe(false) // 0
    expect(validateIsikukood('97102240015')).toBe(false) // 9
  })
})

describe('validateRegistrikood', () => {
  it('accepts exactly 8 digits', () => {
    expect(validateRegistrikood('12345678')).toBe(true)
    expect(validateRegistrikood('10000000')).toBe(true)
  })

  it('rejects other shapes', () => {
    expect(validateRegistrikood('')).toBe(false)
    expect(validateRegistrikood('1234567')).toBe(false) // 7 digits
    expect(validateRegistrikood('123456789')).toBe(false) // 9 digits
    expect(validateRegistrikood('1234567a')).toBe(false) // letter
    expect(validateRegistrikood('1234 678')).toBe(false) // space
  })
})

describe('validateIdentityCode dispatch', () => {
  it('validates private bidders against the isikukood rules', () => {
    expect(validateIdentityCode('private', VALID_ISIKUKOOD)).toBe(true)
    expect(validateIdentityCode('private', BAD_CHECKSUM)).toBe(false)
    expect(validateIdentityCode('private', '12345678')).toBe(false)
  })

  it('validates companies against the registrikood rules', () => {
    expect(validateIdentityCode('company', '12345678')).toBe(true)
    expect(validateIdentityCode('company', VALID_ISIKUKOOD)).toBe(false) // 11 digits
    expect(validateIdentityCode('company', '1234567')).toBe(false)
  })
})

describe('validateEmail', () => {
  it('accepts plain addresses', () => {
    expect(validateEmail('mari@naide.ee')).toBe(true)
    expect(validateEmail('info@mets-ou.ee')).toBe(true)
  })

  it('rejects shapes without local part, @, or domain', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('mari')).toBe(false)
    expect(validateEmail('mari@')).toBe(false)
    expect(validateEmail('@naide.ee')).toBe(false)
    expect(validateEmail('mari@naide')).toBe(false)
    expect(validateEmail('mari naide@naide.ee')).toBe(false) // space
  })
})

describe('Estonian labels and messages', () => {
  it('labels the code field per profile type', () => {
    expect(identityCodeLabel('private')).toBe('Isikukood')
    expect(identityCodeLabel('company')).toBe('Registrikood')
  })

  it('labels the name field per profile type', () => {
    expect(identityNameLabel('private')).toBe('Nimi')
    expect(identityNameLabel('company')).toBe('Ettevõtte nimi')
  })

  it('gives the checksum message for private bidders', () => {
    expect(identityCodeErrorMessage('private')).toBe(
      'Isikukood ei ole korrektne. Kontrolli 11-numbrilist koodi.',
    )
  })

  it('gives the 8-digit message for companies', () => {
    expect(identityCodeErrorMessage('company')).toBe(
      'Registrikood peab koosnema 8 numbrist.',
    )
  })

  it('gives name-required messages per profile type', () => {
    expect(identityNameErrorMessage('private')).toBe('Sisesta oma nimi.')
    expect(identityNameErrorMessage('company')).toBe('Sisesta ettevõtte nimi.')
  })

  it('gives contact-field messages', () => {
    expect(identityAddressErrorMessage()).toBe('Sisesta oma aadress.')
    expect(identityEmailErrorMessage()).toBe('Sisesta korrektne e-posti aadress.')
    expect(identityPhoneErrorMessage()).toBe('Sisesta oma telefoni number.')
  })
})

describe('sealedIdentitySnapshot', () => {
  it('stores all five fields with the isikukood key for private bidders', () => {
    const snapshot = JSON.parse(
      sealedIdentitySnapshot('private', {
        name: 'Mari Maasikas',
        code: VALID_ISIKUKOOD,
        address: 'Metsa tee 1, Tartu',
        email: 'mari@naide.ee',
        phone: '+372 5555 0100',
      }),
    ) as Record<string, unknown>
    expect(snapshot).toEqual({
      name: 'Mari Maasikas',
      isikukood: VALID_ISIKUKOOD,
      aadress: 'Metsa tee 1, Tartu',
      email: 'mari@naide.ee',
      telefon: '+372 5555 0100',
    })
  })

  it('stores all five fields with the registrikood key for companies', () => {
    const snapshot = JSON.parse(
      sealedIdentitySnapshot('company', {
        name: 'Mets OÜ',
        code: '12345678',
        address: 'Metsa tee 2, Tartu',
        email: 'info@metsou.ee',
        phone: '+372 5555 0200',
      }),
    ) as Record<string, unknown>
    expect(snapshot).toEqual({
      name: 'Mets OÜ',
      registrikood: '12345678',
      aadress: 'Metsa tee 2, Tartu',
      email: 'info@metsou.ee',
      telefon: '+372 5555 0200',
    })
  })
})

describe('SealedIdentityForm markup', () => {
  const noErrors: SealedIdentityErrors = {
    name: null,
    code: null,
    address: null,
    email: null,
    phone: null,
  }

  it('renders private labels and no alerts when there are no errors', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'private',
        values: {
          name: 'Mari Maasikas',
          code: VALID_ISIKUKOOD,
          address: 'Metsa tee 1, Tartu',
          email: 'mari@naide.ee',
          phone: '+372 5555 0100',
        },
        onChange: () => undefined,
        errors: noErrors,
      }),
    )
    expect(html).toContain('Nimi')
    expect(html).toContain('Isikukood')
    expect(html).toContain('Aadress')
    expect(html).toContain('E-post')
    expect(html).toContain('Telefon')
    expect(html).toContain('Mari Maasikas')
    expect(html).toContain(VALID_ISIKUKOOD)
    expect(html).toContain('mari@naide.ee')
    expect(html).toContain('+372 5555 0100')
    expect(html).toContain('aria-invalid="false"')
    expect(html).not.toContain('role="alert"')
    expect(html).not.toContain('disabled=""')
  })

  it('shows the Estonian error message for a checksum-invalid code', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'private',
        values: {
          name: 'Mari Maasikas',
          code: BAD_CHECKSUM,
          address: 'Metsa tee 1, Tartu',
          email: 'mari@naide.ee',
          phone: '+372 5555 0100',
        },
        onChange: () => undefined,
        errors: { ...noErrors, code: identityCodeErrorMessage('private') },
      }),
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('Isikukood ei ole korrektne. Kontrolli 11-numbrilist koodi.')
    expect(html).toContain('aria-invalid="true"')
  })

  it('shows the name error when the name is missing', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'private',
        values: {
          name: '',
          code: VALID_ISIKUKOOD,
          address: 'Metsa tee 1, Tartu',
          email: 'mari@naide.ee',
          phone: '+372 5555 0100',
        },
        onChange: () => undefined,
        errors: { ...noErrors, name: identityNameErrorMessage('private') },
      }),
    )
    expect(html).toContain('Sisesta oma nimi.')
  })

  it('shows the contact-field errors for missing or invalid values', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'private',
        values: {
          name: 'Mari Maasikas',
          code: VALID_ISIKUKOOD,
          address: '',
          email: 'pole-email',
          phone: '',
        },
        onChange: () => undefined,
        errors: {
          ...noErrors,
          address: identityAddressErrorMessage(),
          email: identityEmailErrorMessage(),
          phone: identityPhoneErrorMessage(),
        },
      }),
    )
    expect(html).toContain('Sisesta oma aadress.')
    expect(html).toContain('Sisesta korrektne e-posti aadress.')
    expect(html).toContain('Sisesta oma telefoni number.')
  })

  it('renders company labels for the company profile', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'company',
        values: {
          name: 'Mets OÜ',
          code: '12345678',
          address: 'Metsa tee 2, Tartu',
          email: 'info@metsou.ee',
          phone: '+372 5555 0200',
        },
        onChange: () => undefined,
        errors: noErrors,
      }),
    )
    expect(html).toContain('Ettevõtte nimi')
    expect(html).toContain('Registrikood')
    expect(html).not.toContain('Isikukood')
  })

  it('renders the company registrikood error', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'company',
        values: {
          name: 'Mets OÜ',
          code: '123',
          address: 'Metsa tee 2, Tartu',
          email: 'info@metsou.ee',
          phone: '+372 5555 0200',
        },
        onChange: () => undefined,
        errors: { ...noErrors, code: identityCodeErrorMessage('company') },
      }),
    )
    expect(html).toContain('Registrikood peab koosnema 8 numbrist.')
  })

  it('disables all inputs when disabled', () => {
    const html = renderToString(
      createElement(SealedIdentityForm, {
        profileType: 'private',
        values: {
          name: 'Mari Maasikas',
          code: VALID_ISIKUKOOD,
          address: 'Metsa tee 1, Tartu',
          email: 'mari@naide.ee',
          phone: '+372 5555 0100',
        },
        onChange: () => undefined,
        errors: noErrors,
        disabled: true,
      }),
    )
    expect(html).toContain('disabled=""')
    expect(html.match(/disabled=""/g)).toHaveLength(5)
  })
})
