import { describe, expect, it } from 'vitest'

import {
  buildLeadExportRows,
  buildLeadsCsv,
  buildLeadsExportFilename,
  LEAD_CSV_HEADERS,
  resolveConsentWithdrawnAt,
  type LeadExportContext,
} from './leads-export'

import type { Lead } from '@/lib/data/schema'

function makeLead(overrides: Partial<Lead>): Lead {
  return {
    id: 'lead-1',
    formName: 'hindamisakt',
    pageSlug: 'teenused/metsa-hindamine',
    contactName: 'Jaan Tamm',
    phone: '+372 500 100',
    email: 'jaan@tamm.ee',
    cadastr: '34801:001:0217',
    consentAt: '2026-08-26T09:12:00.000Z',
    source: 'veebivorm',
    status: 'new',
    ipHash: 'hash-1',
    assignedSpecialistId: null,
    internalComment: null,
    createdAt: '2026-08-26T09:12:00.000Z',
    updatedAt: '2026-08-26T09:12:00.000Z',
    ...overrides,
  }
}

const emptyContext: LeadExportContext = {
  consentWithdrawnAtByIpHash: new Map(),
  specialistNames: new Map(),
  nextActionAtByLeadId: new Map(),
  noteCountsByLeadId: new Map(),
}

describe('resolveConsentWithdrawnAt', () => {
  it('returns the latest withdrawal per ip hash', () => {
    const withdrawnAt = resolveConsentWithdrawnAt([
      { ipHash: 'hash-1', categories: { marketing: false }, createdAt: '2026-08-30T10:00:00.000Z' },
      { ipHash: 'hash-2', categories: { marketing: false }, createdAt: '2026-08-31T10:00:00.000Z' },
    ])
    expect(withdrawnAt.get('hash-1')).toBe('2026-08-30T10:00:00.000Z')
    expect(withdrawnAt.get('hash-2')).toBe('2026-08-31T10:00:00.000Z')
  })

  it('ignores a withdrawal that a newer acceptance overrides', () => {
    const withdrawnAt = resolveConsentWithdrawnAt([
      { ipHash: 'hash-1', categories: { marketing: false }, createdAt: '2026-08-30T10:00:00.000Z' },
      { ipHash: 'hash-1', categories: { marketing: true }, createdAt: '2026-09-01T10:00:00.000Z' },
    ])
    expect(withdrawnAt.has('hash-1')).toBe(false)
  })

  it('keeps the withdrawal when a newer decision is again a rejection', () => {
    const withdrawnAt = resolveConsentWithdrawnAt([
      { ipHash: 'hash-1', categories: { marketing: false }, createdAt: '2026-08-30T10:00:00.000Z' },
      { ipHash: 'hash-1', categories: { necessary: true }, createdAt: '2026-09-01T10:00:00.000Z' },
      { ipHash: 'hash-1', categories: { marketing: false }, createdAt: '2026-09-02T10:00:00.000Z' },
    ])
    expect(withdrawnAt.get('hash-1')).toBe('2026-09-02T10:00:00.000Z')
  })

  it('skips entries without an ip hash and non-rejecting decisions', () => {
    const withdrawnAt = resolveConsentWithdrawnAt([
      { ipHash: null, categories: { marketing: false }, createdAt: '2026-08-30T10:00:00.000Z' },
      { ipHash: 'hash-1', categories: { marketing: true }, createdAt: '2026-08-30T10:00:00.000Z' },
    ])
    expect(withdrawnAt.size).toBe(0)
  })
})

describe('buildLeadExportRows', () => {
  it('blanks contact fields for consent-withdrawn leads and keeps the rest', () => {
    const rows = buildLeadExportRows([makeLead({})], {
      ...emptyContext,
      consentWithdrawnAtByIpHash: new Map([['hash-1', '2026-08-30T10:00:00.000Z']]),
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.contactName).toBe('')
    expect(rows[0]?.phone).toBe('')
    expect(rows[0]?.email).toBe('')
    expect(rows[0]?.cadastr).toBe('34801:001:0217')
    expect(rows[0]?.source).toContain('hindamisakt')
    expect(rows[0]?.consent).toContain('tagasi võetud')
  })

  it('keeps contact fields when marketing consent stands', () => {
    const rows = buildLeadExportRows([makeLead({})], emptyContext)
    expect(rows[0]?.contactName).toBe('Jaan Tamm')
    expect(rows[0]?.phone).toBe('+372 500 100')
    expect(rows[0]?.email).toBe('jaan@tamm.ee')
    expect(rows[0]?.consent).not.toContain('tagasi võetud')
  })

  it('never exports an isikukood-shaped field', () => {
    const rows = buildLeadExportRows([makeLead({})], emptyContext)
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
      [
        'id',
        'createdAt',
        'contactName',
        'phone',
        'email',
        'cadastr',
        'source',
        'status',
        'specialist',
        'consent',
        'nextAction',
        'noteCount',
      ].sort(),
    )
  })

  it('maps status, specialist, next action and note count', () => {
    const rows = buildLeadExportRows(
      [
        makeLead({
          id: 'lead-2',
          status: 'qualified',
          assignedSpecialistId: 'spec-1',
          ipHash: null,
        }),
      ],
      {
        ...emptyContext,
        specialistNames: new Map([['spec-1', 'Kaire Mets']]),
        nextActionAtByLeadId: new Map([['lead-2', '02.09 12:00']]),
        noteCountsByLeadId: new Map([['lead-2', 3]]),
      },
    )
    expect(rows[0]?.status).toBe('Kvalifitseeritud')
    expect(rows[0]?.specialist).toBe('Kaire Mets')
    expect(rows[0]?.nextAction).toBe('02.09 12:00')
    expect(rows[0]?.noteCount).toBe('3')
  })
})

describe('buildLeadsCsv', () => {
  it('starts with a UTF-8 BOM and emits the Estonian header row', () => {
    const csv = buildLeadsCsv([])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.slice(1).split('\r\n')[0]).toBe(LEAD_CSV_HEADERS.join(';'))
  })

  it('joins fields with semicolons and terminates rows with CRLF', () => {
    const csv = buildLeadsCsv([
      {
        id: 'lead-1',
        createdAt: '26.08 09:12',
        contactName: 'Jaan Tamm',
        phone: '+372 500 100',
        email: 'jaan@tamm.ee',
        cadastr: '34801:001:0217',
        source: 'hindamisakt · teenused/metsa-hindamine',
        status: 'Uus',
        specialist: 'määramata',
        consent: '26.08 09:12',
        nextAction: '',
        noteCount: '0',
      },
    ])
    const [, dataLine] = csv.slice(1).split('\r\n')
    expect(dataLine?.split(';')).toEqual([
      'lead-1',
      '26.08 09:12',
      'Jaan Tamm',
      '+372 500 100',
      'jaan@tamm.ee',
      '34801:001:0217',
      'hindamisakt · teenused/metsa-hindamine',
      'Uus',
      'määramata',
      '26.08 09:12',
      '',
      '0',
    ])
    expect(csv.endsWith('\r\n')).toBe(true)
  })

  it('quotes fields containing the delimiter, quotes or newlines', () => {
    const csv = buildLeadsCsv([
      {
        id: 'lead-1',
        createdAt: '26.08 09:12',
        contactName: 'Tamm, Jaan "J" ',
        phone: '',
        email: '',
        cadastr: '',
        source: 'märkus\nteisel real',
        status: 'Uus',
        specialist: 'määramata',
        consent: '26.08 09:12',
        nextAction: '',
        noteCount: '0',
      },
    ])
    expect(csv).toContain('"Tamm, Jaan ""J"" "')
    expect(csv).toContain('"märkus\nteisel real"')
  })
})

describe('buildLeadsExportFilename', () => {
  it('uses an Estonian prefix with the ISO date', () => {
    expect(buildLeadsExportFilename(new Date('2026-09-05T12:00:00.000Z'))).toBe(
      'juhtloimed-2026-09-05.csv',
    )
  })
})
