import type { AuditEntryDoc } from '@/lib/data/repositories'
import type { AuctionObjectType } from '@/lib/data/schema'
import { auctionObjectTypes } from '@/lib/data/schema'

import { auctionObjectTypeLabels } from '../../../../_lib/labels'

export interface SuspensionInfo {
  active: boolean
  duration: string | null
  suspendedUntil: string | null
  reason: string | null
  changedAt: string | null
}

export interface RightAuditPayload {
  objectType?: unknown
  reason?: unknown
  status?: unknown
  duration?: unknown
  suspendedUntil?: unknown
}

export function readPayload(after: unknown): RightAuditPayload {
  if (typeof after === 'object' && after !== null) {
    return after
  }
  return {}
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

export function suspensionFromAudit(entries: AuditEntryDoc[]): SuspensionInfo {
  const latest = entries[0]
  if (!latest) return { active: false, duration: null, suspendedUntil: null, reason: null, changedAt: null }
  const payload = readPayload(latest.after)
  return {
    active: payload.status === 'suspended',
    duration: asString(payload.duration),
    suspendedUntil: asString(payload.suspendedUntil),
    reason: asString(payload.reason),
    changedAt: latest.createdAt,
  }
}

export function actionLabel(action: string): string {
  switch (action) {
    case 'user.right_grant':
      return 'Õigus antud'
    case 'user.right_revoke':
      return 'Õigus tühistatud'
    case 'user.suspend':
      return 'Konto peatus'
    default:
      return action
  }
}

export function objectTypeLabel(objectType: string): string {
  return (auctionObjectTypes as readonly string[]).includes(objectType)
    ? auctionObjectTypeLabels[objectType as AuctionObjectType]
    : objectType
}
