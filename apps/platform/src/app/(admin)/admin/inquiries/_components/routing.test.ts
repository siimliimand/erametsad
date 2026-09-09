import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PRESELECT_COUNT,
  ROUTING_SETTINGS_FLAGS_KEY,
  buildAttachmentLinks,
  buildManualForwardEmail,
  buildMinimizedForwardPayload,
  partnerServesRequest,
  preselectCountFromFlags,
  rankRoutingCandidates,
  responseDeadlineState,
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

describe('responseDeadlineState', () => {
  const now = Date.parse('2026-09-08T12:00:00.000Z')
  const daysAgo = (days: number): string =>
    new Date(now - days * 24 * 3600 * 1000).toISOString()

  it('returns null before routing and once any partner responded', () => {
    expect(responseDeadlineState({ routedAt: null, respondedAt: null, nowMs: now })).toBeNull()
    expect(
      responseDeadlineState({ routedAt: daysAgo(9), respondedAt: daysAgo(1), nowMs: now }),
    ).toBeNull()
  })

  it('stays pending inside the first five days', () => {
    expect(responseDeadlineState({ routedAt: daysAgo(4), respondedAt: null, nowMs: now })).toBe('pending')
    expect(responseDeadlineState({ routedAt: daysAgo(5), respondedAt: null, nowMs: now })).toBe('approaching')
  })

  it('is expired from seven days without a response', () => {
    expect(responseDeadlineState({ routedAt: daysAgo(7), respondedAt: null, nowMs: now })).toBe('expired')
    expect(responseDeadlineState({ routedAt: daysAgo(10), respondedAt: null, nowMs: now })).toBe('expired')
  })

  it('ignores unparseable timestamps', () => {
    expect(
      responseDeadlineState({ routedAt: 'not-a-date', respondedAt: null, nowMs: now }),
    ).toBeNull()
  })
})

describe('preselectCountFromFlags (task 8.6)', () => {
  it('defaults to 3 without a settings row or a reserved key', () => {
    expect(DEFAULT_PRESELECT_COUNT).toBe(3)
    expect(preselectCountFromFlags(undefined)).toBe(3)
    expect(preselectCountFromFlags({ muu: true })).toBe(3)
    expect(preselectCountFromFlags({ [ROUTING_SETTINGS_FLAGS_KEY]: 'kolm' })).toBe(3)
  })

  it('reads a clamped integer preselect count from Seaded', () => {
    expect(preselectCountFromFlags({ [ROUTING_SETTINGS_FLAGS_KEY]: { preselectCount: 1 } })).toBe(1)
    expect(preselectCountFromFlags({ [ROUTING_SETTINGS_FLAGS_KEY]: { preselectCount: 0 } })).toBe(0)
    expect(preselectCountFromFlags({ [ROUTING_SETTINGS_FLAGS_KEY]: { preselectCount: 10 } })).toBe(10)
    expect(preselectCountFromFlags({ [ROUTING_SETTINGS_FLAGS_KEY]: { preselectCount: 11 } })).toBe(3)
    expect(preselectCountFromFlags({ [ROUTING_SETTINGS_FLAGS_KEY]: { preselectCount: 2.5 } })).toBe(3)
  })
})

describe('buildManualForwardEmail (task 8.6)', () => {
  it('renders the minimized payload into a copyable plain-text e-mail', () => {
    const email = buildManualForwardEmail({
      type: 'hooldusraie',
      payload: {
        type: 'hooldusraie',
        contact: { name: 'Piret Põld', phone: '+37251110003', email: 'piret@meil.ee' },
        county: 'HH',
        cadastres: ['78402:003:0210'],
        comment: 'Talvel sobib',
      },
      attachments: ['hooldusraie/1-plaan.pdf'],
    })
    expect(email.subject).toBe('Erametsa päring: hooldusraie')
    expect(email.body).toContain('Kontakt: name: Piret Põld, phone: +37251110003, email: piret@meil.ee')
    expect(email.body).toContain('Maakond: HH')
    expect(email.body).toContain('Katastritunnused: 78402:003:0210')
    expect(email.body).toContain('Kommentaar: Talvel sobib')
    expect(email.body).toContain('Manused: hooldusraie/1-plaan.pdf')
    expect(email.body.endsWith(
      'Andmed on edastatud Erametsad OÜ vahendusel. Küsimuste korral vastake otse kliendile.',
    )).toBe(true)
  })

  it('never leaks internal metadata into the fallback text', () => {
    const email = buildManualForwardEmail({
      type: 'kava',
      payload: {
        contact: { name: 'A' },
        isikukood: '38001010000',
        ipHash: 'abc',
        consentAt: '2026-09-01T10:00:00.000Z',
        source: 'google',
      },
      attachments: [],
    })
    expect(email.body).not.toContain('isikukood')
    expect(email.body).not.toContain('abc')
    expect(email.body).not.toContain('google')
    expect(email.body).not.toContain('Manused')
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
