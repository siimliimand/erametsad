import { describe, expect, it } from 'vitest'

import {
  sealedAuditActionLabel,
  sealedAuditActions,
} from '../_lib/sealed-audit-view'

describe('sealedAuditActions', () => {
  it('pins the canonical sealed-opening action set from the audit registry', () => {
    expect(sealedAuditActions).toEqual([
      'sealed.sign_opener',
      'sealed.sign_approver',
      'sealed.reveal',
      'sealed.winner_confirm',
      'sealed.void',
      'sealed.mark_unsold',
      'sealed.house_backup',
    ])
  })
})

describe('sealedAuditActionLabel', () => {
  it('labels every sealed ceremony action in Estonian', () => {
    expect(sealedAuditActionLabel('sealed.sign_opener')).toBe('Avaja allkiri')
    expect(sealedAuditActionLabel('sealed.sign_approver')).toBe('Kinnitaja allkiri')
    expect(sealedAuditActionLabel('sealed.reveal')).toBe('Pakkumised paljastatud')
    expect(sealedAuditActionLabel('sealed.winner_confirm')).toBe('Võitja kinnitatud')
    expect(sealedAuditActionLabel('sealed.mark_unsold')).toBe('Märgitud müümata')
    expect(sealedAuditActionLabel('sealed.void')).toBe('Avamine tühistatud')
    expect(sealedAuditActionLabel('sealed.house_backup')).toBe('Varupakkumine kasutatud')
  })

  it('falls back to the raw action when the registry grows without a label', () => {
    expect(sealedAuditActionLabel('sealed.future_action')).toBe('sealed.future_action')
  })
})
