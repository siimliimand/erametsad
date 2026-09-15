import { describe, expect, it } from 'vitest'

import { objectSubmissionSchema } from '../index'

const contact = {
  name: 'Mati Maasikas',
  phone: '+37251234567',
  email: 'mati@example.com',
}

const validSale = {
  branch: 'sale',
  objectType: 'raieoigus',
  cadastres: ['78402:003:0210'],
  areaHa: 12.5,
  species: ['MA'],
  loggingTypes: ['AR'],
  description: 'Raiemüük Harjumaal',
  contact,
}

const validService = {
  branch: 'service',
  type: 'kava',
  contact,
  cadastres: '78402:003:0210',
}

describe('objectSubmissionSchema', () => {
  it('routes a sale payload through the branch selector', () => {
    const result = objectSubmissionSchema.safeParse(validSale)
    expect(result.success).toBe(true)
    if (result.success && result.data.branch === 'sale') {
      expect(result.data.objectType).toBe('raieoigus')
    }
  })

  it('routes a service payload through the branch selector', () => {
    const result = objectSubmissionSchema.safeParse(validService)
    expect(result.success).toBe(true)
    if (result.success && result.data.branch === 'service') {
      expect(result.data.type).toBe('kava')
    }
  })

  it('rejects a payload without a known branch', () => {
    const result = objectSubmissionSchema.safeParse({
      objectType: 'raieoigus',
      contact,
    })
    expect(result.success).toBe(false)
  })

  it('enforces portal safety on the sale branch but strips on the service branch', () => {
    const sale = objectSubmissionSchema.safeParse({ ...validSale, auctionType: 'open' })
    expect(sale.success).toBe(false)

    const service = objectSubmissionSchema.safeParse({ ...validService, auctionType: 'open' })
    expect(service.success).toBe(true)
    if (service.success) {
      expect('auctionType' in service.data).toBe(false)
    }
  })
})
