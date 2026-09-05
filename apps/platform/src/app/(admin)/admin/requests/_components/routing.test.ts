import { describe, expect, it } from 'vitest'

import {
  buildAttachmentLinks,
  buildMinimizedForwardPayload,
  partnerServesRequest,
  rankRoutingCandidates,
  type RoutingPartnerInput,
} from './routing'

const partner = (overrides: Partial<RoutingPartnerInput>): RoutingPartnerInput => ({
  id: 'p',
  name: 'Partner OÜ',
  capacity: 5,
  contactEmail: 'partner@meil.ee',
  serviceTypes: ['kava'],
  counties: null,
  active: true,
  ...overrides,
})

describe('partnerServesRequest', () => {
  it('matches by service type and county coverage', () => {
    const harju = partner({ counties: ['HH', 'RA'] })
    expect(partnerServesRequest(harju, 'hooldusraie', 'HH')).toBe(false)
    expect(partnerServesRequest(partner({ serviceTypes: ['hooldusraie'], counties: ['HH'] }), 'hooldusraie', 'HH')).toBe(true)
  })

  it('treats null or empty coverage as Kogu Eesti', () => {
    const nationwide = partner({ serviceTypes: ['hooldusraie'], counties: null })
    expect(partnerServesRequest(nationwide, 'hooldusraie', 'TA')).toBe(true)
    expect(partnerServesRequest(partner({ serviceTypes: ['hooldusraie'], counties: [] }), 'hooldusraie', 'TA')).toBe(true)
  })

  it('skips inactive partners', () => {
    expect(partnerServesRequest(partner({ active: false }), 'kava', null)).toBe(false)
  })
})

describe('rankRoutingCandidates', () => {
  const partners: RoutingPartnerInput[] = [
    partner({ id: 'county-busy', name: 'Maakond hõivatud', serviceTypes: ['hooldusraie'], counties: ['HH'], capacity: 5 }),
    partner({ id: 'nationwide', name: 'Kogu Eesti', serviceTypes: ['hooldusraie'], counties: null }),
    partner({ id: 'county-free', name: 'Maakond vaba', serviceTypes: ['hooldusraie'], counties: ['HH'], capacity: 5 }),
    partner({ id: 'other-service', name: 'Vale teenus', serviceTypes: ['istutamine'], counties: ['HH'] }),
  ]
  const options = {
    type: 'hooldusraie' as const,
    county: 'HH',
    openCounts: { 'county-busy': 4, nationwide: 1, 'county-free': 0 },
    sentPartnerIds: new Set<string>(['nationwide']),
    preselectCount: 3,
  }

  it('ranks explicit county matches ahead of nationwide, by free capacity', () => {
    const ranked = rankRoutingCandidates(partners, options)
    expect(ranked.map((candidate) => candidate.partner.id)).toEqual([
      'county-free',
      'county-busy',
      'nationwide',
    ])
  })

  it('preselects top unsent partners only', () => {
    const ranked = rankRoutingCandidates(partners, options)
    expect(ranked.find((c) => c.partner.id === 'county-free')?.preselected).toBe(true)
    expect(ranked.find((c) => c.partner.id === 'county-busy')?.preselected).toBe(true)
    expect(ranked.find((c) => c.partner.id === 'nationwide')?.preselected).toBe(false)
  })

  it('flags capacity saturation', () => {
    const ranked = rankRoutingCandidates(partners, options)
    expect(ranked.find((c) => c.partner.id === 'county-busy')?.atCapacity).toBe(false)
    const full = rankRoutingCandidates(partners, {
      ...options,
      openCounts: { 'county-free': 5 },
    })
    expect(full.find((c) => c.partner.id === 'county-free')?.atCapacity).toBe(true)
  })
})

describe('buildMinimizedForwardPayload', () => {
  it('keeps contact and property data only', () => {
    const payload = {
      type: 'hooldusraie',
      contact: { name: 'Piret Põld', phone: '+37251110003', email: 'piret@meil.ee' },
      county: 'RA',
      cadastres: ['78402:003:0210'],
      provisions: 'Harvendus',
      services: ['hooldamine'],
      comment: 'Talvel sobib',
    }
    const minimized = buildMinimizedForwardPayload(payload)
    expect(Object.keys(minimized).sort()).toEqual([
      'cadastres',
      'comment',
      'contact',
      'county',
      'provisions',
      'services',
      'type',
    ])
  })

  it('never leaks internal metadata', () => {
    const payload = {
      type: 'kava',
      contact: { name: 'A', phone: '+37251110001', email: 'a@meil.ee' },
      cadastres: [],
      phone: '+37251110001',
      ipHash: 'abc',
      pageSlug: '/paringud',
      consentAt: '2026-09-01T10:00:00.000Z',
      source: 'google',
      status: 'new',
    }
    const minimized = buildMinimizedForwardPayload(payload)
    for (const forbidden of ['ipHash', 'pageSlug', 'consentAt', 'source', 'status', 'phone']) {
      expect(minimized).not.toHaveProperty(forbidden)
    }
  })

  it('drops empty string, null and undefined values from the whitelist', () => {
    const payload = {
      type: 'kava',
      contact: { name: 'B', phone: '+37251110002', email: 'b@meil.ee' },
      county: '',
      paper_copy: null,
      provisions: undefined,
      comment: '',
    }
    const minimized = buildMinimizedForwardPayload(payload)
    expect(Object.keys(minimized).sort()).toEqual(['contact', 'type'])
  })

  it('keeps the paper_copy switch and cadastre list when present', () => {
    const payload = {
      type: 'raieoigus',
      contact: { name: 'C', phone: '+37251110003', email: 'c@meil.ee' },
      paper_copy: true,
      cadastres: ['78402:003:0210'],
    }
    const minimized = buildMinimizedForwardPayload(payload)
    expect(minimized.paper_copy).toBe(true)
    expect(minimized.cadastres).toEqual(['78402:003:0210'])
  })
})

describe('buildAttachmentLinks', () => {
  it('builds 14-day expiring links', () => {
    const forwardedAt = Date.parse('2026-09-05T10:00:00.000Z')
    const links = buildAttachmentLinks(['kava-fail.pdf', '', 42], forwardedAt)
    expect(links).toHaveLength(1)
    expect(links[0]?.key).toBe('kava-fail.pdf')
    expect(links[0]?.url).toBe('/api/v1/media/kava-fail.pdf')
    expect(links[0]?.expiresAt).toBe('2026-09-19T10:00:00.000Z')
  })
})
