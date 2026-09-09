import { describe, expect, it } from 'vitest'

import {
  DEFAULT_LEAD_AUTO_ASSIGN_SETTINGS,
  LEAD_AUTO_ASSIGN_FLAGS_KEY,
  countyRoundRobinPick,
  evaluateLeadExitGuard,
  findDuplicateLead,
  kanbanColumns,
  leadAutoAssignSettings,
  leadSlaBadge,
  resolveLeadLifecycleFlags,
  roundRobinSuggestion,
} from './lead-flow'

describe('kanban columns', () => {
  it('has the five pipeline columns in order', () => {
    expect(kanbanColumns.map((column) => column.status)).toEqual([
      'new',
      'contacted',
      'qualified',
      'contract',
      'disqualified',
    ])
  })
})

describe('evaluateLeadExitGuard', () => {
  it('blocks leaving Uus without an assigned specialist', () => {
    const result = evaluateLeadExitGuard({
      from: 'new',
      to: 'contacted',
      assignedSpecialistId: null,
      note: 'Esimene kontakt, klient huvitatud',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('spetsialist')
  })

  it('requires the first note to reach Võetud ühendust (task 8.2)', () => {
    const blocked = evaluateLeadExitGuard({
      from: 'new',
      to: 'contacted',
      assignedSpecialistId: 'spec-1',
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error).toContain('Esimene märkus')

    const short = evaluateLeadExitGuard({
      from: 'new',
      to: 'contacted',
      assignedSpecialistId: 'spec-1',
      note: 'ok',
    })
    expect(short.ok).toBe(false)

    const ok = evaluateLeadExitGuard({
      from: 'new',
      to: 'contacted',
      assignedSpecialistId: 'spec-1',
      note: 'Helistasin, klient huvitatud',
    })
    expect(ok.ok).toBe(true)
  })

  it('requires an auction/contract reference or a note to reach Leping (task 8.2)', () => {
    const blocked = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'contract',
      assignedSpecialistId: 'spec-1',
    })
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.error).toContain('viide')

    const withReference = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'contract',
      assignedSpecialistId: 'spec-1',
      reference: 'oksjon 42 / leping LP-2026-001',
    })
    expect(withReference.ok).toBe(true)

    const withNote = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'contract',
      assignedSpecialistId: 'spec-1',
      note: 'Raamleping allkirjastamisel',
    })
    expect(withNote.ok).toBe(true)
  })

  it('requires a qualification note to enter Kvalifitseeritud', () => {
    const short = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'qualified',
      assignedSpecialistId: 'spec-1',
      note: 'ok',
    })
    expect(short.ok).toBe(false)

    const ok = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'qualified',
      assignedSpecialistId: 'spec-1',
      note: 'Mets hindamisel, ootame tulemusi',
    })
    expect(ok.ok).toBe(true)
  })

  it('requires a typed reason to enter Mittekvalifitseeritud', () => {
    const missing = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'disqualified',
      assignedSpecialistId: 'spec-1',
    })
    expect(missing.ok).toBe(false)

    const ok = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'disqualified',
      assignedSpecialistId: 'spec-1',
      note: 'Klient loobus teenusest',
    })
    expect(ok.ok).toBe(true)
  })

  it('requires the qualification note even when entering from Uus with a specialist', () => {
    const result = evaluateLeadExitGuard({
      from: 'new',
      to: 'qualified',
      assignedSpecialistId: 'spec-1',
    })
    expect(result.ok).toBe(false)
  })

  it('lets a same-status move pass every guard', () => {
    const result = evaluateLeadExitGuard({
      from: 'disqualified',
      to: 'disqualified',
      assignedSpecialistId: null,
    })
    expect(result.ok).toBe(true)
  })

  it('rejects a whitespace-only qualification note', () => {
    const result = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'qualified',
      assignedSpecialistId: 'spec-1',
      note: '     ',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Kvalifitseerimise märkus')
  })
})

describe('leadAutoAssignSettings (task 8.2)', () => {
  it('defaults to enabled with the documented design default', () => {
    expect(DEFAULT_LEAD_AUTO_ASSIGN_SETTINGS).toEqual({ enabled: true })
    expect(leadAutoAssignSettings(undefined)).toEqual({ enabled: true })
    expect(leadAutoAssignSettings('sõna')).toEqual({ enabled: true })
    expect(leadAutoAssignSettings([1, 2])).toEqual({ enabled: true })
  })

  it('reads the reserved leadAutoAssign featureFlags key', () => {
    expect(leadAutoAssignSettings({ [LEAD_AUTO_ASSIGN_FLAGS_KEY]: { enabled: false } })).toEqual({
      enabled: false,
    })
    expect(leadAutoAssignSettings({ [LEAD_AUTO_ASSIGN_FLAGS_KEY]: { enabled: true } })).toEqual({
      enabled: true,
    })
    expect(leadAutoAssignSettings({ [LEAD_AUTO_ASSIGN_FLAGS_KEY]: 'vigane' })).toEqual({
      enabled: true,
    })
  })
})

describe('countyRoundRobinPick (task 8.2)', () => {
  it('rotates to the active specialist with the fewest county leads', () => {
    const pick = countyRoundRobinPick([
      { id: 'a', active: true, countyLeadCount: 2 },
      { id: 'b', active: true, countyLeadCount: 0 },
      { id: 'c', active: true, countyLeadCount: 1 },
    ])
    expect(pick?.id).toBe('b')
  })

  it('skips inactive specialists and returns null without active ones', () => {
    expect(
      countyRoundRobinPick([
        { id: 'a', active: false, countyLeadCount: 0 },
        { id: 'b', active: true, countyLeadCount: 5 },
      ])?.id,
    ).toBe('b')
    expect(countyRoundRobinPick([{ id: 'a', active: false, countyLeadCount: 0 }])).toBeNull()
  })

  it('breaks ties with the roster order so consecutive picks rotate', () => {
    const roster = [
      { id: 'a', active: true, countyLeadCount: 1 },
      { id: 'b', active: true, countyLeadCount: 1 },
    ]
    expect(countyRoundRobinPick(roster)?.id).toBe('a')
    expect(countyRoundRobinPick([...roster].reverse())?.id).toBe('b')
  })
})

describe('resolveLeadLifecycleFlags (task 8.2)', () => {
  it('resolves the merge cross-link and the soft-delete tombstone', () => {
    const flags = resolveLeadLifecycleFlags([
      { action: 'lead.note', after: { text: 'märkus' } },
      { action: 'lead.merge', after: { mergedInto: 'target-1', taken: ['countyId'] } },
      { action: 'lead.delete', after: { deleted: true, reason: 'Spam, testikirje' } },
    ])
    expect(flags).toEqual({
      mergedIntoId: 'target-1',
      deleted: true,
      deleteReason: 'Spam, testikirje',
    })
  })

  it('stays empty for ordinary timelines', () => {
    expect(
      resolveLeadLifecycleFlags([{ action: 'lead.status', after: { status: 'contacted' } }]),
    ).toEqual({ mergedIntoId: null, deleted: false, deleteReason: null })
  })

  it('ignores malformed audit payloads', () => {
    expect(
      resolveLeadLifecycleFlags([
        { action: 'lead.merge', after: 'vigane' },
        { action: 'lead.delete', after: { deleted: false } },
      ]),
    ).toEqual({ mergedIntoId: null, deleted: false, deleteReason: null })
  })
})

describe('leadSlaBadge', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z')

  it('returns nothing under 24 hours', () => {
    const created = new Date(now - 10 * 3600000).toISOString()
    expect(leadSlaBadge(created, 'new', now)).toBeNull()
  })

  it('returns amber past 24 hours', () => {
    const created = new Date(now - 26 * 3600000).toISOString()
    const badge = leadSlaBadge(created, 'new', now)
    expect(badge?.level).toBe('amber')
    expect(badge?.hours).toBe(26)
  })

  it('returns red past 48 hours', () => {
    const created = new Date(now - 50 * 3600000).toISOString()
    const badge = leadSlaBadge(created, 'new', now)
    expect(badge?.level).toBe('red')
  })

  it('only applies to the Uus column', () => {
    const created = new Date(now - 72 * 3600000).toISOString()
    expect(leadSlaBadge(created, 'qualified', now)).toBeNull()
  })

  it('returns nothing for an unparseable creation time', () => {
    expect(leadSlaBadge('pole-kuupäev', 'new', now)).toBeNull()
  })
})

describe('roundRobinSuggestion', () => {
  const candidates = [
    { id: 'a', name: 'Marit', active: true, openLeadCount: 3 },
    { id: 'b', name: 'Kaire', active: true, openLeadCount: 1 },
    { id: 'c', name: 'Puuduv', active: false, openLeadCount: 0 },
  ]
  const inactive = candidates.find((candidate) => candidate.id === 'c')
  if (!inactive) throw new Error('fixture missing')

  it('picks the active specialist with the fewest open leads', () => {
    expect(roundRobinSuggestion(candidates)?.id).toBe('b')
  })

  it('returns null without active specialists', () => {
    expect(roundRobinSuggestion([inactive])).toBeNull()
  })
})

describe('findDuplicateLead', () => {
  const now = Date.parse('2026-09-05T12:00:00.000Z')
  const old = {
    id: 'old',
    phone: '+37251110001',
    email: 'vananut@meil.ee',
    createdAt: new Date(now - 40 * 24 * 3600000).toISOString(),
  }
  const recent = {
    id: 'recent',
    phone: '+37251110001',
    email: 'muu@meil.ee',
    createdAt: new Date(now - 2 * 24 * 3600000).toISOString(),
  }

  it('finds a same-phone lead inside the 30-day window', () => {
    const duplicate = findDuplicateLead([old, recent], { phone: '+37251110001' }, 'self', now)
    expect(duplicate?.id).toBe('recent')
  })

  it('ignores matches older than 30 days', () => {
    const stale = { id: 'stale', phone: '', email: 'muu@meil.ee', createdAt: old.createdAt }
    expect(findDuplicateLead([stale], { email: 'muu@meil.ee' }, 'self', now)).toBeNull()
  })

  it('matches by e-mail inside the window', () => {
    const emailLead = { id: 'mail', phone: '+37251119999', email: 'piret@meil.ee', createdAt: recent.createdAt }
    expect(findDuplicateLead([emailLead], { phone: '+37251110002', email: 'Piret@Meil.EE' }, 'self', now)?.id).toBe('mail')
  })

  it('never reports the edited lead itself as a duplicate', () => {
    const self = { id: 'self', phone: '+37251110001', email: 'mina@meil.ee', createdAt: recent.createdAt }
    expect(findDuplicateLead([self], { phone: '+37251110001' }, 'self', now)).toBeNull()
  })
})
