import { describe, expect, it } from 'vitest'

import { deriveSaleCounty, saleSubmissionSchema } from '../sale-schema'

const validSale = {
  branch: 'sale',
  objectType: 'raieoigus',
  cadastres: ['78402:003:0210'],
  areaHa: 12.5,
  species: ['MA', 'KU'],
  loggingTypes: ['AR', 'HL'],
  description: 'Raiemüük Harjumaal',
  contact: {
    name: 'Mati Maasikas',
    phone: '+37251234567',
    email: 'mati@example.com',
  },
}

describe('saleSubmissionSchema', () => {
  it('accepts a valid raieoigus payload', () => {
    const result = saleSubmissionSchema.safeParse(validSale)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.branch).toBe('sale')
      expect(result.data.objectType).toBe('raieoigus')
      expect(result.data.cadastres).toEqual(['78402:003:0210'])
      expect(result.data.volumeM3).toBeUndefined()
      expect(result.data.files).toBeUndefined()
    }
  })

  it('accepts a valid kinnistu payload with optional fields', () => {
    const result = saleSubmissionSchema.safeParse({
      ...validSale,
      objectType: 'kinnistu',
      county: 'HH',
      address: 'Metsa tee 1',
      volumeM3: 150,
      files: ['object-submissions/abc/metsateatis.pdf'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.objectType).toBe('kinnistu')
      expect(result.data.county).toBe('HH')
      expect(result.data.files).toEqual(['object-submissions/abc/metsateatis.pdf'])
    }
  })

  it('rejects pricing, mechanics, schedule, and specialist fields (portal safety)', () => {
    const adminOnlyFields = [
      'minBidEur',
      'auctionType',
      'startsAt',
      'endsAt',
      'specialistId',
      'reservePriceEur',
    ]
    for (const field of adminOnlyFields) {
      const result = saleSubmissionSchema.safeParse({ ...validSale, [field]: 100 })
      expect(result.success, `expected ${field} to be rejected`).toBe(false)
      if (!result.success) {
        const issue = result.error.issues.find((entry) => entry.code === 'unrecognized_keys')
        expect(issue?.message).toBe('Päring sisaldab lubamatuid välju.')
      }
    }
  })

  it('rejects an invalid cadastre format', () => {
    const result = saleSubmissionSchema.safeParse({
      ...validSale,
      cadastres: ['78402:003:21'],
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const issue = result.error.issues[0]
      expect(issue?.path).toEqual(['cadastres', 0])
      expect(issue?.message).toContain('NNNNN:NNN:NNNN')
    }
  })

  it('rejects an empty cadastre list', () => {
    const result = saleSubmissionSchema.safeParse({ ...validSale, cadastres: [] })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Lisa vähemalt üks katastritunnus.')
    }
  })

  it('rejects an invalid contact', () => {
    const phone = saleSubmissionSchema.safeParse({
      ...validSale,
      contact: { ...validSale.contact, phone: '51234567' },
    })
    expect(phone.success).toBe(false)
    if (!phone.success) {
      expect(phone.error.issues[0]?.path).toEqual(['contact', 'phone'])
    }

    const email = saleSubmissionSchema.safeParse({
      ...validSale,
      contact: { ...validSale.contact, email: 'pole-email' },
    })
    expect(email.success).toBe(false)
    if (!email.success) {
      expect(email.error.issues[0]?.path).toEqual(['contact', 'email'])
    }

    const name = saleSubmissionSchema.safeParse({
      ...validSale,
      contact: { ...validSale.contact, name: '' },
    })
    expect(name.success).toBe(false)
    if (!name.success) {
      expect(name.error.issues[0]?.path).toEqual(['contact', 'name'])
    }
  })

  it('rejects missing or empty required object data', () => {
    expect(saleSubmissionSchema.safeParse({ ...validSale, areaHa: undefined }).success).toBe(false)
    expect(saleSubmissionSchema.safeParse({ ...validSale, species: [] }).success).toBe(false)
    expect(saleSubmissionSchema.safeParse({ ...validSale, loggingTypes: [] }).success).toBe(false)
    expect(saleSubmissionSchema.safeParse({ ...validSale, description: '' }).success).toBe(false)
  })

  it('rejects unknown species and logging type codes', () => {
    expect(saleSubmissionSchema.safeParse({ ...validSale, species: ['XX'] }).success).toBe(false)
    expect(saleSubmissionSchema.safeParse({ ...validSale, loggingTypes: ['ZZ'] }).success).toBe(false)
  })

  it('caps the file list at 10 keys', () => {
    const keys = Array.from({ length: 11 }, (_, index) => `object-submissions/f${String(index)}`)
    const result = saleSubmissionSchema.safeParse({ ...validSale, files: keys })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Lisa kuni 10 faili.')
    }
  })

  it('rejects an unknown object type', () => {
    expect(saleSubmissionSchema.safeParse({ ...validSale, objectType: 'pakett' }).success).toBe(false)
  })
})

describe('deriveSaleCounty', () => {
  it('derives the county from the first cadastre', () => {
    expect(deriveSaleCounty(['78402:003:0210', '78904:101:0123'])).toBe('HH')
    expect(deriveSaleCounty(['78904:101:0123'])).toBe('TA')
  })

  it('returns null for empty or unmappable cadastres without throwing', () => {
    expect(deriveSaleCounty([])).toBeNull()
    expect(deriveSaleCounty(['99999:999:9999'])).toBeNull()
  })
})
