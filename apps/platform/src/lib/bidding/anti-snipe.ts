import { getPayloadClient } from '../../payload/payloadClient'
import { emitAuctionExtended } from '../realtime/auction-stream'

export const ANTI_SNIPE_DEFAULT_MINUTES = 5
export const ANTI_SNIPE_MIN_MINUTES = 1
export const ANTI_SNIPE_MAX_MINUTES = 30

export interface AntiSnipeAuction {
  id: string
  endsAt: string | Date
  type?: string | null
}

export interface AntiSnipeSettings {
  antiSnipeDurationMinutes?: number
}

export interface AntiSnipeResult {
  extended: boolean
  newEndTime?: Date
  previousEndTime?: Date
  windowMinutes?: number
}

export interface AntiSnipeContext {
  actorId?: string
  triggeredByBidId?: string
}

export function clampAntiSnipeMinutes(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ANTI_SNIPE_DEFAULT_MINUTES
  }
  return Math.min(
    ANTI_SNIPE_MAX_MINUTES,
    Math.max(ANTI_SNIPE_MIN_MINUTES, Math.round(value)),
  )
}

async function loadAntiSnipeSettings(): Promise<AntiSnipeSettings> {
  const payload = await getPayloadClient()
  const result = await payload.find({
    collection: 'settings',
    limit: 1,
    depth: 0,
  })
  const settings = result.docs[0] as AntiSnipeSettings | undefined
  return settings ?? {}
}

export interface AntiSnipeAuditInput {
  auctionId: string
  previousEndTime: Date
  newEndTime: Date
  windowMinutes: number
  actorId?: string
  triggeredByBidId?: string
}

export async function recordAntiSnipeExtension(input: AntiSnipeAuditInput): Promise<void> {
  const payload = await getPayloadClient()
  // Relationship fields reject numeric strings for number-typed ids.
  const actorValue =
    input.actorId !== undefined && /^\d+$/.test(input.actorId)
      ? Number(input.actorId)
      : input.actorId
  await payload.create({
    collection: 'audit-entry',
    data: {
      action: 'anti_snipe_extension',
      entityType: 'auction',
      entityId: input.auctionId,
      ...(actorValue !== undefined ? { actor: actorValue } : {}),
      before: { endsAt: input.previousEndTime.toISOString() },
      after: {
        endsAt: input.newEndTime.toISOString(),
        windowMinutes: input.windowMinutes,
        ...(input.triggeredByBidId ? { bidId: input.triggeredByBidId } : {}),
      },
    },
  })
}

export async function checkAntiSnipe(
  auction: AntiSnipeAuction,
  settings?: AntiSnipeSettings,
  context?: AntiSnipeContext,
): Promise<AntiSnipeResult> {
  if (auction.type === 'sealed') {
    return { extended: false }
  }

  const endsAt = new Date(auction.endsAt)
  const now = new Date()

  if (now >= endsAt) {
    return { extended: false }
  }

  const resolvedSettings = settings ?? (await loadAntiSnipeSettings())
  const windowMinutes = clampAntiSnipeMinutes(resolvedSettings.antiSnipeDurationMinutes)
  const windowMs = windowMinutes * 60 * 1000
  const snipeThreshold = new Date(endsAt.getTime() - windowMs)

  if (now < snipeThreshold) {
    return { extended: false }
  }

  const newEndTime = new Date(endsAt.getTime() + windowMs)

  const payload = await getPayloadClient()
  await payload.update({
    collection: 'auctions',
    id: auction.id,
    data: { endsAt: newEndTime.toISOString() },
  })

  await recordAntiSnipeExtension({
    auctionId: auction.id,
    previousEndTime: endsAt,
    newEndTime,
    windowMinutes,
    ...(context?.actorId ? { actorId: context.actorId } : {}),
    ...(context?.triggeredByBidId ? { triggeredByBidId: context.triggeredByBidId } : {}),
  })

  emitAuctionExtended({
    auctionId: auction.id,
    previousEndsAt: endsAt,
    endsAt: newEndTime,
  })

  return { extended: true, newEndTime, previousEndTime: endsAt, windowMinutes }
}
