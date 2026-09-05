import { describe, expect, it } from 'vitest'

import { selectPartners, type RoutablePartner } from '../routing'

function partner(overrides: Partial<RoutablePartner> & { id: string }): RoutablePartner {
  return {
    active: true,
    serviceTypes: [],
    counties: null,
    ...overrides,
  }
}

describe('selectPartners', () => {
  it('skips inactive partners even when type and county match', () => {
    const partners = [
      partner({ id: 'inactive', active: false, serviceTypes: ['hooldusraie'], counties: ['TA'] }),
    ]
    expect(selectPartners(partners, 'hooldusraie', 'TA')).toEqual([])
  })

  it('skips partners whose service types do not include the request type', () => {
    const partners = [
      partner({ id: 'kava-only', serviceTypes: ['kava'], counties: ['TA'] }),
      partner({ id: 'istutus', serviceTypes: ['istutamine'], counties: null }),
    ]
    expect(selectPartners(partners, 'hooldusraie', 'TA')).toEqual([])
  })

  it('keeps partners whose service types include the request type', () => {
    const partners = [
      partner({ id: 'p1', serviceTypes: ['hooldusraie', 'kava'], counties: ['TA'] }),
    ]
    expect(selectPartners(partners, 'hooldusraie', 'TA').map((p) => p.id)).toEqual(['p1'])
  })

  it('treats a null counties list as all counties', () => {
    const partners = [partner({ id: 'all', serviceTypes: ['hooldusraie'], counties: null })]
    expect(selectPartners(partners, 'hooldusraie', 'TA').map((p) => p.id)).toEqual(['all'])
    expect(selectPartners(partners, 'hooldusraie', 'HH').map((p) => p.id)).toEqual(['all'])
  })

  it('treats an empty counties list as all counties', () => {
    const partners = [partner({ id: 'all', serviceTypes: ['istutamine'], counties: [] })]
    expect(selectPartners(partners, 'istutamine', 'VO').map((p) => p.id)).toEqual(['all'])
  })

  it('excludes partners that do not cover the request county', () => {
    const partners = [
      partner({ id: 'harju', serviceTypes: ['hooldusraie'], counties: ['HH'] }),
      partner({ id: 'tartu', serviceTypes: ['hooldusraie'], counties: ['TA', 'JG'] }),
    ]
    expect(selectPartners(partners, 'hooldusraie', 'TA').map((p) => p.id)).toEqual(['tartu'])
    expect(selectPartners(partners, 'hooldusraie', 'VR')).toEqual([])
  })

  it('matches kava partners regardless of county coverage (kava has no county)', () => {
    const partners = [
      partner({ id: 'harju-only', serviceTypes: ['kava'], counties: ['HH'] }),
      partner({ id: 'all', serviceTypes: ['kava'], counties: null }),
    ]
    expect(selectPartners(partners, 'kava', null).map((p) => p.id)).toEqual([
      'harju-only',
      'all',
    ])
    expect(selectPartners(partners, 'kava', undefined).map((p) => p.id)).toEqual([
      'harju-only',
      'all',
    ])
  })

  it('returns matches in input order', () => {
    const partners = [
      partner({ id: 'b', serviceTypes: ['hooldusraie'], counties: null }),
      partner({ id: 'a', serviceTypes: ['hooldusraie'], counties: ['TA'] }),
    ]
    expect(selectPartners(partners, 'hooldusraie', 'TA').map((p) => p.id)).toEqual(['b', 'a'])
  })

  it('ignores corrupt non-array json values instead of throwing', () => {
    const partners = [
      { id: 'bad-types', active: true, serviceTypes: 'hooldusraie', counties: null },
      { id: 'bad-counties', active: true, serviceTypes: ['hooldusraie'], counties: 'TA' },
    ] as unknown as RoutablePartner[]
    expect(selectPartners(partners, 'hooldusraie', 'TA')).toEqual([])
  })
})
