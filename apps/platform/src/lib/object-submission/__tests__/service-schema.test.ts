import { describe, expect, it } from 'vitest'

import { serviceSubmissionSchema } from '../service-schema'

const contact = {
  name: 'Mati Maasikas',
  phone: '+37251234567',
  email: 'mati@example.com',
}

describe('serviceSubmissionSchema', () => {
  it('accepts a valid kava payload with the service branch', () => {
    const result = serviceSubmissionSchema.safeParse({
      branch: 'service',
      type: 'kava',
      contact,
      cadastres: '78402:003:0210',
      comment: 'Vaja majanduskava',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.branch).toBe('service')
      expect(result.data.type).toBe('kava')
      expect(result.data.cadastres).toEqual(['78402:003:0210'])
    }
  })

  it('accepts a valid hooldusraie payload with the service branch', () => {
    const result = serviceSubmissionSchema.safeParse({
      branch: 'service',
      type: 'hooldusraie',
      contact,
      county: 'HH',
      cadastres: '78402:003:0210',
      provisions: 'Hooldamine 2 ha',
      services: ['hooldamine', 'valgusraie'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.branch).toBe('service')
      expect(result.data.type).toBe('hooldusraie')
    }
  })

  it('accepts a valid istutamine payload with the service branch', () => {
    const result = serviceSubmissionSchema.safeParse({
      branch: 'service',
      type: 'istutamine',
      contact,
      county: 'VO',
      cadastres: '67890:002:0003',
      provisions: 'Istutamine 1 ha',
      services: ['istikud'],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.branch).toBe('service')
      expect(result.data.type).toBe('istutamine')
    }
  })

  it('rejects a wrong or missing branch', () => {
    const wrong = serviceSubmissionSchema.safeParse({
      branch: 'sale',
      type: 'kava',
      contact,
      cadastres: '78402:003:0210',
    })
    expect(wrong.success).toBe(false)

    const missing = serviceSubmissionSchema.safeParse({
      type: 'kava',
      contact,
      cadastres: '78402:003:0210',
    })
    expect(missing.success).toBe(false)
  })

  it('keeps the shared per-type rules intact', () => {
    const badServices = serviceSubmissionSchema.safeParse({
      branch: 'service',
      type: 'istutamine',
      contact,
      county: 'VO',
      cadastres: '67890:002:0003',
      provisions: 'Istutamine',
      services: ['valgusraie'],
    })
    expect(badServices.success).toBe(false)

    const badCounty = serviceSubmissionSchema.safeParse({
      branch: 'service',
      type: 'hooldusraie',
      contact,
      county: 'not-a-code',
      cadastres: '78402:003:0210',
      provisions: 'Hooldus',
      services: ['hooldamine'],
    })
    expect(badCounty.success).toBe(false)
  })

  it('strips admin-only fields instead of rejecting (shared schemas are not strict)', () => {
    const result = serviceSubmissionSchema.safeParse({
      branch: 'service',
      type: 'kava',
      contact,
      cadastres: '78402:003:0210',
      minBidEur: 100,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect('minBidEur' in result.data).toBe(false)
    }
  })
})
