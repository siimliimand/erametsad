import { describe, expect, it } from 'vitest'

import {
  crossCheckBoardMembership,
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
