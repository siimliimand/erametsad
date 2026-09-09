import { describe, expect, it } from 'vitest'

import {
  UNGROUPED_GROUP_ID,
  actionLabel,
  auditActionGroups,
  auditEntryReason,
  groupForAction,
  groupLabel,
  userAgentFamily,
} from '../action-registry'

describe('audit action registry', () => {
  it('registers every action in exactly one group', () => {
    const seen = new Map<string, string>()
    for (const group of auditActionGroups) {
      expect(group.actions.length, `group "${group.id}" has no actions`).toBeGreaterThan(0)
      for (const action of group.actions) {
        expect(seen.has(action), `${action} is listed twice`).toBe(false)
        seen.set(action, group.id)
      }
    }
    expect(seen.size).toBeGreaterThan(0)
  })

  it('resolves group ids and the "muu" fallback', () => {
    expect(groupForAction('maintenance.end')).toBe('settings')
    expect(groupForAction('settings.key_reveal')).toBe('settings')
    expect(groupForAction('bid.reject')).toBe('bids')
    expect(groupForAction('totally.unknown')).toBeNull()
  })

  it('keeps maintenance and key-reveal keys aligned with the writers', () => {
    const settings = auditActionGroups.find((group) => group.id === 'settings')
    expect(settings).toBeDefined()
    expect(settings?.actions).toContain('maintenance.start')
    expect(settings?.actions).toContain('maintenance.end')
    expect(settings?.actions).toContain('settings.key_reveal')
    expect(settings?.actions).toContain('maintenance.window_create')
    expect(settings?.actions).toContain('maintenance.window_delete')
    expect(settings?.actions).not.toContain('maintenance.cancel')
  })

  it('returns Estonian human labels for the settings actions', () => {
    expect(actionLabel('maintenance.end')).toBe('Hooldusrežiimi väljalülitamine')
    expect(actionLabel('maintenance.start')).toBe('Hooldusrežiimi sisselülitamine')
    expect(actionLabel('settings.key_reveal')).toBe('Integratsioonivõtme paljastamine')
  })

  it('labels every registry action in Estonian (task 4.7 full coverage)', () => {
    for (const group of auditActionGroups) {
      for (const action of group.actions) {
        expect(actionLabel(action), `${action} has no Estonian label`).not.toBe(action)
      }
    }
  })

  it('labels the dotted keys writers emit outside the groups', () => {
    expect(actionLabel('content.version.create')).toBe('Lehe versiooni salvestamine')
    expect(actionLabel('content.version.restore')).toBe('Lehe versiooni taastamine')
    expect(actionLabel('content.blocks.save')).toBe('Lehe blokkide salvestamine')
    expect(actionLabel('user.shill_flag')).toBe('Shill-uurimise märkimine')
    expect(actionLabel('bid.void')).toBe('Juhtiva pakkumise tühistamine')
    expect(actionLabel('redirect.update')).toBe('Suunamise muutmine')
  })

  it('falls back to the raw key for unlabeled actions', () => {
    expect(actionLabel('totally.unknown')).toBe('totally.unknown')
  })

  it('labels groups and falls back for unknown group ids', () => {
    expect(groupLabel(UNGROUPED_GROUP_ID)).toBe('Muud tegevused')
    expect(groupLabel('settings')).toBe('Seaded')
    expect(groupLabel('nope')).toBe('nope')
  })
})

describe('userAgentFamily (drawer browser field)', () => {
  it('resolves the common families without Chromium mask errors', () => {
    expect(userAgentFamily('Mozilla/5.0 (Windows NT 10.0) Edg/126.0')).toBe('Edge')
    expect(userAgentFamily('Mozilla/5.0 OPR/109.0')).toBe('Opera')
    expect(userAgentFamily('Mozilla/5.0 SamsungBrowser/25.0')).toBe('Samsung Internet')
    expect(userAgentFamily('Mozilla/5.0 Gecko/20100101 Firefox/126.0')).toBe('Firefox')
    expect(userAgentFamily('Mozilla/5.0 Chrome/126.0 Safari/537.36')).toBe('Chrome')
    expect(userAgentFamily('Mozilla/5.0 Version/17.4 Safari/605.1.15')).toBe('Safari')
    expect(userAgentFamily('curl/8.5.0')).toBe('curl')
  })

  it('reports unknown and empty agents without throwing', () => {
    expect(userAgentFamily('SomeObscureBot/1.0')).toBe('Tundmatu')
    expect(userAgentFamily('')).toBe('—')
    expect(userAgentFamily(null)).toBe('—')
    expect(userAgentFamily(undefined)).toBe('—')
  })
})

describe('auditEntryReason (Põhjus column + drawer)', () => {
  it('prefers the dedicated era column', () => {
    expect(auditEntryReason({ reason: 'Veerg', after: { reason: 'JSON' } })).toBe('Veerg')
  })

  it('falls back to the before/after JSON for legacy entries', () => {
    expect(auditEntryReason({ after: { reason: 'Järel-põhjus' } })).toBe('Järel-põhjus')
    expect(auditEntryReason({ before: { reason: 'Enne-põhjus' } })).toBe('Enne-põhjus')
  })

  it('returns null when no reason exists anywhere', () => {
    expect(auditEntryReason({ after: { key: 'smtp' }, before: null })).toBeNull()
    expect(auditEntryReason({})).toBeNull()
  })
})
