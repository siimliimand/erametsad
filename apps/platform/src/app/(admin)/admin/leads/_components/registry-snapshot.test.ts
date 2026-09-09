import { describe, expect, it } from 'vitest'

import {
  crossCheckBoardMembership,
  detectNameDiscrepancy,
  deriveLegalForm,
  resolveRegistrySnapshot,
} from './registry-snapshot'

describe('deriveLegalForm', () => {
  it('maps Estonian suffixes to legal forms', () => {
    expect(deriveLegalForm('Metsatark OÜ')).toBe('Osaühing')
    expect(deriveLegalForm('Eramets AS')).toBe('Aktsiaselts')
    expect(deriveLegalForm('Metsaühistu Põhja-Talu')).toBeNull()
  })

  it('returns null without a name', () => {
    expect(deriveLegalForm(null)).toBeNull()
    expect(deriveLegalForm('')).toBeNull()
  })
})

describe('resolveRegistrySnapshot', () => {
  it('builds a verified snapshot from a known fixture', () => {
    const snapshot = resolveRegistrySnapshot('12345678', 'Muud nimi OÜ', '2026-09-01T10:00:00.000Z')
    expect(snapshot.status).toBe('REGISTREERITUD')
    expect(snapshot.legalName).toBe('Metsatark OÜ')
    expect(snapshot.legalForm).toBe('Osaühing')
    expect(snapshot.boardMembers).toHaveLength(2)
    expect(snapshot.fetchedAt).toBe('2026-09-01T10:00:00.000Z')
    expect(snapshot.verified).toBe(true)
  })

  it('carries the registry panel fields asukoht and KMKR nr', () => {
    const snapshot = resolveRegistrySnapshot('12345678', null, null)
    expect(snapshot).toHaveProperty('address')
    expect(snapshot).toHaveProperty('kmkrNr')
  })

  it('leaves asukoht and KMKR nr empty while the fixtures carry none', () => {
    const known = resolveRegistrySnapshot('12345678', 'Metsatark OÜ', null)
    expect(known.address).toBeNull()
    expect(known.kmkrNr).toBeNull()
    const unknown = resolveRegistrySnapshot('00000000', 'Tundmatu OÜ', null)
    expect(unknown.address).toBeNull()
    expect(unknown.kmkrNr).toBeNull()
  })

  it('marks a deleted registry entry as KUSTUTATUD', () => {
    const snapshot = resolveRegistrySnapshot('45678901', 'Puidukoda OÜ', null)
    expect(snapshot.status).toBe('KUSTUTATUD')
    expect(snapshot.verified).toBe(true)
  })

  it('falls back to unverified submitted data for unknown codes', () => {
    const snapshot = resolveRegistrySnapshot('00000000', 'Tundmatu OÜ', null)
    expect(snapshot.status).toBeNull()
    expect(snapshot.verified).toBe(false)
    expect(snapshot.legalName).toBe('Tundmatu OÜ')
    expect(snapshot.boardMembers).toEqual([])
  })
})

describe('detectNameDiscrepancy', () => {
  it('reports both names when the applicant name differs from the registry name', () => {
    const discrepancy = detectNameDiscrepancy('Mari Mets OÜ', 'Metsatark OÜ', true)
    expect(discrepancy).toEqual({ applicantName: 'Mari Mets OÜ', registryName: 'Metsatark OÜ' })
  })

  it('ignores case and extra whitespace', () => {
    expect(detectNameDiscrepancy('  mari   mets OÜ ', 'Mari Mets OÜ', true)).toBeNull()
  })

  it('needs a verified registry hit', () => {
    expect(detectNameDiscrepancy('Mari Mets OÜ', 'Metsatark OÜ', false)).toBeNull()
  })

  it('returns null when either name is missing', () => {
    expect(detectNameDiscrepancy(null, 'Metsatark OÜ', true)).toBeNull()
    expect(detectNameDiscrepancy('Mari Mets OÜ', null, true)).toBeNull()
    expect(detectNameDiscrepancy('', '', true)).toBeNull()
  })
})

describe('crossCheckBoardMembership', () => {
  const board = [
    { name: 'Jaan Tamm', role: 'Juhatuse liige' },
    { name: 'Mari Mets', role: 'Juhatuse liige', idCode: '38001010000' },
  ]

  it('matches strongly by personal code when the payload carries one', () => {
    const check = crossCheckBoardMembership('Mari Mets', '38001010000', board)
    expect(check.level).toBe('strong')
    expect(check.matchedName).toBe('Mari Mets')
  })

  it('matches weakly by exact name, including reversed word order', () => {
    expect(crossCheckBoardMembership('Jaan Tamm', null, board).level).toBe('weak')
    expect(crossCheckBoardMembership('Tamm Jaan', undefined, board).level).toBe('weak')
  })

  it('prefers strong over weak', () => {
    const check = crossCheckBoardMembership('Mari Mets', '38001010000', [
      ...board,
      { name: 'Mari Mets', role: 'Juhatuse liige' },
    ])
    expect(check.level).toBe('strong')
  })

  it('reports none when nothing matches', () => {
    expect(crossCheckBoardMembership('Kadri Leht', '48002020000', board).level).toBe('none')
    expect(crossCheckBoardMembership(null, null, board).level).toBe('none')
  })
})
