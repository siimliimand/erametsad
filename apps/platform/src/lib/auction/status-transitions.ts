// Structural stand-in for the Payload CollectionBeforeChangeHook args this
// hook consumed; src/payload/collections/Auction.ts still passes it to a
// Payload beforeChange slot, so the shape must stay compatible.
export interface StatusTransitionHookArgs {
  data: Record<string, unknown>
  originalDoc?: Record<string, unknown> | null
}

export const STATUSES = [
  'draft',
  'scheduled',
  'active',
  'ended',
  'appraised',
  'unsold',
  'contract',
  'completed',
  'archived',
] as const

export type AuctionStatus = (typeof STATUSES)[number]

export const validTransitions: Record<AuctionStatus, AuctionStatus[]> = {
  draft: ['scheduled'],
  scheduled: ['active'],
  active: ['ended'],
  ended: ['appraised', 'unsold'],
  appraised: ['contract'],
  unsold: ['completed'],
  contract: ['completed'],
  completed: ['archived'],
  archived: [],
}

export function validateTransition(from: string, to: string): boolean {
  const allowed = validTransitions[from as AuctionStatus]
  return allowed.includes(to as AuctionStatus)
}

export function getValidNextStatuses(currentStatus: string): string[] {
  return validTransitions[currentStatus as AuctionStatus]
}

const STATUS_TIMESTAMP_MAP: Partial<Record<AuctionStatus, string>> = {
  scheduled: 'scheduledAt',
  active: 'activatedAt',
  ended: 'endedAt',
  appraised: 'appraisedAt',
  contract: 'contractAt',
  completed: 'completedAt',
  archived: 'archivedAt',
}

export const statusTransitionHook = ({
  data,
  originalDoc,
}: StatusTransitionHookArgs): Record<string, unknown> => {
  const newStatus = data.status as string | undefined
  const oldStatus = originalDoc?.status as string | undefined

  if (!newStatus || newStatus === oldStatus) return data

  if (oldStatus && !validateTransition(oldStatus, newStatus)) {
    throw new Error(
      `Invalid status transition: ${oldStatus} → ${newStatus}`,
    )
  }

  const timestampField = STATUS_TIMESTAMP_MAP[newStatus as AuctionStatus]
  if (timestampField) {
    return { ...data, [timestampField]: new Date().toISOString() }
  }

  return data
}