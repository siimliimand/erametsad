import { getPayloadClient } from '../../payload/payloadClient'

export interface AntiSnipeResult {
  extended: boolean
  newEndTime?: Date
}

export async function checkAntiSnipe(
  auction: { endsAt: string | Date; id: string },
  settings: { antiSnipeDurationMinutes?: number },
): Promise<AntiSnipeResult> {
  const endsAt = new Date(auction.endsAt)
  const now = new Date()

  if (now >= endsAt) {
    return { extended: false }
  }

  const windowMinutes = settings.antiSnipeDurationMinutes ?? 5
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

  return { extended: true, newEndTime }
}