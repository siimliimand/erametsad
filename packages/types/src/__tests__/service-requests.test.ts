import { describe, it, expect } from 'vitest'

import {
  EE_COUNTIES,
  EECountyCode,
} from '../counties'
import {
  serviceRequestPayloadSchema,
  kavaRequestSchema,
  hooldusraieRequestSchema,
  istutamineRequestSchema,
  serviceRequestContactSchema,
  HOOLDUSRAIE_SERVICE_OPTIONS,
  ISTUTAMINE_SERVICE_OPTIONS,
  HooldusraieService,
  IstutamineService,
} from '../service-requests'

const contact = {
  name: 'Mati Mets',
  phone: '+37251234567',
  email: 'mati@mets.ee',
}

describe('county reference', () => {
  it('defines 15 counties with unique codes', () => {
    expect(EE_COUNTIES).toHaveLength(15)
    const codes = EE_COUNTIES.map((county) => county.code)
    expect(new Set(codes).size).toBe(15)
  })

  it('accepts a valid county code', () => {
    expect(EECountyCode.safeParse('TA').success).toBe(true)
    expect(EECountyCode.safeParse('HH').success).toBe(true)
  })

  it('rejects an unknown county code', () => {
    const result = EECountyCode.safeParse('XX')
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Valige kehtiv maakond')
    }
  })

  it('lists every county code as a valid enum option', () => {
    for (const county of EE_COUNTIES) {
      expect(EECountyCode.safeParse(county.code).success).toBe(true)
    }
  })
})

describe('serviceRequestContactSchema', () => {
  it('accepts valid contact fields', () => {
    expect(serviceRequestContactSchema.safeParse(contact).success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(
      serviceRequestContactSchema.safeParse({ ...contact, name: '  ' }).success,
    ).toBe(false)
  })

  it('rejects a non-Estonian phone number', () => {
    expect(
      serviceRequestContactSchema.safeParse({ ...contact, phone: '+37121234567' })
        .success,
    ).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = serviceRequestContactSchema.safeParse({
      ...contact,
      email: 'mitte-post',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Sisestage kehtiv e-posti aadress',
      )
    }
  })

  it('trims contact values', () => {
    const result = serviceRequestContactSchema.parse({
      name: '  Mati Mets ',
      phone: ' +37251234567',
      email: ' mati@mets.ee ',
    })
    expect(result).toEqual(contact)
  })
})

describe('kava request', () => {
  it('accepts a happy path with tolerant cadastres and paper_copy', () => {
    const result = kavaRequestSchema.safeParse({
      type: 'kava',
      contact,
      cadastres: '12345:001:0001, 67890:002:0003',
      paper_copy: true,
      comment: 'Palun kiiret lahendust',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.cadastres).toEqual(['12345:001:0001', '67890:002:0003'])
      expect(result.data.paper_copy).toBe(true)
    }
  })

  it('does not require paper_copy or comment', () => {
    const result = kavaRequestSchema.safeParse({
      type: 'kava',
      contact,
      cadastres: ['12345:001:0001'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.paper_copy).toBeUndefined()
      expect(result.data.comment).toBeUndefined()
    }
  })

  it('rejects empty cadastres', () => {
    expect(
      kavaRequestSchema.safeParse({ type: 'kava', contact, cadastres: ' , ' })
        .success,
    ).toBe(false)
  })

  it('does not require county or provisions', () => {
    const result = kavaRequestSchema.safeParse({
      type: 'kava',
      contact,
      cadastres: '12345:001:0001',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('county' in result.data).toBe(false)
      expect('provisions' in result.data).toBe(false)
      expect('services' in result.data).toBe(false)
    }
  })
})

describe('hooldusraie request', () => {
  it('accepts a happy path', () => {
    const result = hooldusraieRequestSchema.safeParse({
      type: 'hooldusraie',
      contact,
      county: 'TA',
      cadastres: '12345:001:0001',
      provisions: 'Metsa hooldus 2 ha, ligipääs põllutee kaudu',
      services: ['hooldamine', 'valgusraie'],
      comment: 'Helistage pärast kella 17',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty services array with the at-least-one rule', () => {
    const result = hooldusraieRequestSchema.safeParse({
      type: 'hooldusraie',
      contact,
      county: 'TA',
      cadastres: '12345:001:0001',
      provisions: 'Hooldus',
      services: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message)
      expect(messages).toContain('Valige vähemalt üks teenus')
    }
  })

  it('rejects missing services', () => {
    expect(
      hooldusraieRequestSchema.safeParse({
        type: 'hooldusraie',
        contact,
        county: 'TA',
        cadastres: '12345:001:0001',
        provisions: 'Hooldus',
      }).success,
    ).toBe(false)
  })

  it('rejects services from the istutamine group', () => {
    expect(
      hooldusraieRequestSchema.safeParse({
        type: 'hooldusraie',
        contact,
        county: 'TA',
        cadastres: '12345:001:0001',
        provisions: 'Hooldus',
        services: ['istikud'],
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid county', () => {
    const result = hooldusraieRequestSchema.safeParse({
      type: 'hooldusraie',
      contact,
      county: 'ZZ',
      cadastres: '12345:001:0001',
      provisions: 'Hooldus',
      services: ['hooldamine'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Valige kehtiv maakond')
    }
  })

  it('rejects a missing county', () => {
    expect(
      hooldusraieRequestSchema.safeParse({
        type: 'hooldusraie',
        contact,
        cadastres: '12345:001:0001',
        provisions: 'Hooldus',
        services: ['hooldamine'],
      }).success,
    ).toBe(false)
  })

  it('rejects empty provisions', () => {
    expect(
      hooldusraieRequestSchema.safeParse({
        type: 'hooldusraie',
        contact,
        county: 'TA',
        cadastres: '12345:001:0001',
        provisions: '   ',
        services: ['hooldamine'],
      }).success,
    ).toBe(false)
  })
})

describe('istutamine request', () => {
  it('accepts a happy path with all three services', () => {
    const result = istutamineRequestSchema.safeParse({
      type: 'istutamine',
      contact,
      county: 'VO',
      cadastres: '12345:001:0001, 67890:002:0003',
      provisions: 'Istutamine 1 ha, mullavahetus vajalik',
      services: ['maapinna_ettevalmistus', 'istikud', 'istutamine'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an empty services array with the at-least-one rule', () => {
    const result = istutamineRequestSchema.safeParse({
      type: 'istutamine',
      contact,
      county: 'VO',
      cadastres: '12345:001:0001',
      provisions: 'Istutamine',
      services: [],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message)
      expect(messages).toContain('Valige vähemalt üks teenus')
    }
  })

  it('rejects services from the hooldusraie group', () => {
    expect(
      istutamineRequestSchema.safeParse({
        type: 'istutamine',
        contact,
        county: 'VO',
        cadastres: '12345:001:0001',
        provisions: 'Istutamine',
        services: ['valgusraie'],
      }).success,
    ).toBe(false)
  })

  it('rejects an invalid county', () => {
    expect(
      istutamineRequestSchema.safeParse({
        type: 'istutamine',
        contact,
        county: 'not-a-code',
        cadastres: '12345:001:0001',
        provisions: 'Istutamine',
        services: ['istikud'],
      }).success,
    ).toBe(false)
  })

  it('rejects a missing provisions field', () => {
    expect(
      istutamineRequestSchema.safeParse({
        type: 'istutamine',
        contact,
        county: 'VO',
        cadastres: '12345:001:0001',
        services: ['istikud'],
      }).success,
    ).toBe(false)
  })
})

describe('serviceRequestPayloadSchema', () => {
  it('parses a kava payload through the discriminated union', () => {
    const result = serviceRequestPayloadSchema.safeParse({
      type: 'kava',
      contact,
      cadastres: '12345:001:0001',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('kava')
    }
  })

  it('parses a hooldusraie payload through the discriminated union', () => {
    const result = serviceRequestPayloadSchema.safeParse({
      type: 'hooldusraie',
      contact,
      county: 'HH',
      cadastres: '12345:001:0001',
      provisions: 'Hooldus',
      services: ['hooldamine'],
    })
    expect(result.success).toBe(true)
  })

  it('parses an istutamine payload through the discriminated union', () => {
    const result = serviceRequestPayloadSchema.safeParse({
      type: 'istutamine',
      contact,
      county: 'PL',
      cadastres: '12345:001:0001',
      provisions: 'Istutamine',
      services: ['istutamine'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects an unknown type', () => {
    const result = serviceRequestPayloadSchema.safeParse({
      type: 'raie',
      contact,
      cadastres: '12345:001:0001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a missing type', () => {
    expect(
      serviceRequestPayloadSchema.safeParse({ contact, cadastres: '12345:001:0001' })
        .success,
    ).toBe(false)
  })
})

describe('service checkbox groups', () => {
  it('expose labels for every enum value', () => {
    expect(
      HOOLDUSRAIE_SERVICE_OPTIONS.every((option) =>
        HooldusraieService.safeParse(option.value).success,
      ),
    ).toBe(true)
    expect(
      ISTUTAMINE_SERVICE_OPTIONS.every((option) =>
        IstutamineService.safeParse(option.value).success,
      ),
    ).toBe(true)
    expect(HOOLDUSRAIE_SERVICE_OPTIONS).toHaveLength(2)
    expect(ISTUTAMINE_SERVICE_OPTIONS).toHaveLength(3)
  })
})
