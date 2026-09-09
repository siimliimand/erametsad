import { describe, expect, it } from 'vitest'

import {
  UNGROUPED_GROUP_ID,
  actionLabel,
  auditActionGroups,
  groupForAction,
  groupLabel,
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
    expect(settings?.actions).not.toContain('maintenance.cancel')
  })

  it('returns Estonian human labels for the settings actions', () => {
    expect(actionLabel('maintenance.end')).toBe('Hooldusrežiimi väljalülitamine')
    expect(actionLabel('maintenance.start')).toBe('Hooldusrežiimi sisselülitamine')
    expect(actionLabel('settings.key_reveal')).toBe('Integratsioonivõtme paljastamine')
  })

  it('falls back to the raw key for unlabeled actions', () => {
    expect(actionLabel('bid.reject')).toBe('bid.reject')
    expect(actionLabel('totally.unknown')).toBe('totally.unknown')
  })

  it('labels groups and falls back for unknown group ids', () => {
    expect(groupLabel(UNGROUPED_GROUP_ID)).toBe('Muud tegevused')
    expect(groupLabel('settings')).toBe('Seaded')
    expect(groupLabel('nope')).toBe('nope')
  })
})
