import { describe, expect, it } from 'vitest'

import {
  evaluateLeadExitGuard,
  findDuplicateLead,
  kanbanColumns,
  leadSlaBadge,
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
    })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('spetsialist')
  })

  it('allows leaving Uus once a specialist is assigned', () => {
    const result = evaluateLeadExitGuard({
      from: 'new',
      to: 'contacted',
      assignedSpecialistId: 'spec-1',
    })
    expect(result.ok).toBe(true)
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

  it('ignores note requirements for other moves', () => {
    const result = evaluateLeadExitGuard({
      from: 'contacted',
      to: 'contract',
      assignedSpecialistId: 'spec-1',
    })
    expect(result.ok).toBe(true)
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

  it('requires the qualification note even when entering from Uus with a specialist', () => {
    const result = evaluateLeadExitGuard({
      from: 'new',
      to: 'qualified',
      assignedSpecialistId: 'spec-1',
    })
    expect(result.ok).toBe(false)
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
