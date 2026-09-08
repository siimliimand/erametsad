import { auditActionGroups } from '../../../../audit/_components/action-registry'

/**
 * Canonical sealed-opening audit actions, derived from the shared audit
 * action registry (group "sealed") so the ceremony strip can never drift
 * from the registry the audit page filters with.
 */
export const sealedAuditActions: readonly string[] =
  auditActionGroups.find((group) => group.id === 'sealed')?.actions ?? []

const sealedAuditActionLabels: Record<string, string> = {
  'sealed.sign_opener': 'Avaja allkiri',
  'sealed.sign_approver': 'Kinnitaja allkiri',
  'sealed.reveal': 'Pakkumised paljastatud',
  'sealed.winner_confirm': 'Võitja kinnitatud',
  'sealed.mark_unsold': 'Märgitud müümata',
  'sealed.void': 'Avamine tühistatud',
  'sealed.house_backup': 'Varupakkumine kasutatud',
}

export function sealedAuditActionLabel(action: string): string {
  return sealedAuditActionLabels[action] ?? action
}

/** One rendered audit line in the live strip (newest-first order). */
export interface SealedAuditLineView {
  id: string
  createdAt: string
  action: string
  actorLabel: string | null
}

export type SealedAuditResult =
  | { ok: true; lines: SealedAuditLineView[] }
  | { ok: false; error: string }

/** Stream health of the live strip, same states as the bid monitor. */
export type SealedAuditFeedState = 'connecting' | 'live' | 'offline'
