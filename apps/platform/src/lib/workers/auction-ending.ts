import { getPayloadClient } from '../../payload/payloadClient'
import { eventBus } from '../notifications/event-bus'
import { broadcast } from '../realtime/auction-stream'

const inProgress = new Set<string>()

interface ProcessResult {
  processed: number
  skipped: number
}

function getTotalArea(auction: Record<string, unknown>): number {
  const cadastres = (auction.cadastres as Record<string, unknown>[] | undefined)
  if (!cadastres) return 0
  return cadastres.reduce((sum, c) => sum + (Number(c.area) || 0), 0)
}

async function upsertSnapshot(
  payload: Awaited<ReturnType<typeof getPayloadClient>>,
  objectType: string,
  eur: number,
  area: number,
): Promise<void> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const existing = await payload.find({
    collection: 'statistics-snapshots',
    where: {
      and: [
        { date: { equals: today.toISOString() } },
        { objectType: { equals: objectType } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  if (existing.docs.length > 0) {
    const doc = existing.docs[0] as Record<string, unknown>
    await payload.update({
      collection: 'statistics-snapshots',
      id: doc.id as string,
      data: {
        count: (Number(doc.count) || 0) + 1,
        area: (Number(doc.area) || 0) + area,
        eur: (Number(doc.eur) || 0) + eur,
      },
      depth: 0,
    })
  } else {
    await payload.create({
      collection: 'statistics-snapshots',
      data: {
        date: today.toISOString(),
        objectType,
        count: 1,
        area,
        eur,
      },
      depth: 0,
    })
  }
}

function isSealedAuction(auction: Record<string, unknown>): boolean {
  if (auction.type === 'sealed') return true
  if ((auction as { isQuickAuction?: boolean }).isQuickAuction) return false
  return false
}

function nowISO(): string {
  return new Date().toISOString()
}

export async function processEndedAuctions(): Promise<ProcessResult> {
  const payload = await getPayloadClient()
  const now = nowISO()

  const auctions = await payload.find({
    collection: 'auctions',
    where: {
      and: [
        { status: { equals: 'active' } },
        { endsAt: { less_than_equal: now } },
      ],
    },
    limit: 100,
    depth: 0,
  })

  let processed = 0
  let skipped = 0

  for (const doc of auctions.docs) {
    const auction = doc as Record<string, unknown>
    const auctionId = auction.id as string

    if (inProgress.has(auctionId)) {
      skipped++
      continue
    }

    inProgress.add(auctionId)

    try {
      const current = await payload.findByID({
        collection: 'auctions',
        id: auctionId,
        depth: 0,
      })

      const currentAuction = current as Record<string, unknown> | null
      if (currentAuction?.status !== 'active') {
        skipped++
        continue
      }

      if (isSealedAuction(currentAuction)) {
        await payload.update({
          collection: 'auctions',
          id: auctionId,
          data: {
            status: 'ended',
            endedAt: nowISO(),
          },
          depth: 0,
        })

        eventBus.emit({
          type: 'auction.ended',
          payload: { auctionId, type: 'sealed' },
        })

        const objectType = currentAuction.objectType as string
        await upsertSnapshot(payload, objectType, 0, getTotalArea(currentAuction))

        broadcast('auction:ended', { auctionId, type: 'sealed' })

        processed++
        continue
      }

      const bids = await payload.find({
        collection: 'bids',
        where: {
          and: [
            { auction: { equals: auctionId } },
            { status: { equals: 'leading' } },
          ],
        },
        limit: 1,
        depth: 0,
      })

      const leadingBid = bids.docs[0] as Record<string, unknown> | undefined

      if (leadingBid) {
        const needsAppraisal = !!currentAuction.needsAppraisal

        const updateData: Record<string, unknown> = {
          status: needsAppraisal ? 'appraised' : 'ended',
          endedAt: nowISO(),
          winningBid: leadingBid.id,
        }

        if (needsAppraisal) {
          updateData.appraisedAt = nowISO()
        }

        await payload.update({
          collection: 'auctions',
          id: auctionId,
          data: updateData,
          depth: 0,
        })

        eventBus.emit({
          type: 'auction.ended',
          payload: { auctionId, type: 'open', winningBidId: leadingBid.id, amount: leadingBid.amount },
        })

        const objectType = currentAuction.objectType as string
        const amount = Number(leadingBid.amount) || 0
        await upsertSnapshot(payload, objectType, amount, getTotalArea(currentAuction))

        broadcast('auction:ended', { auctionId, type: 'open', hasWinner: true })
      } else {
        await payload.update({
          collection: 'auctions',
          id: auctionId,
          data: {
            status: 'unsold',
            endedAt: nowISO(),
          },
          depth: 0,
        })

        eventBus.emit({
          type: 'auction.ended',
          payload: { auctionId, type: 'open', hasWinner: false },
        })

        const objectType = currentAuction.objectType as string
        await upsertSnapshot(payload, objectType, 0, getTotalArea(currentAuction))

        broadcast('auction:ended', { auctionId, type: 'open', hasWinner: false })
      }

      processed++
    } finally {
      inProgress.delete(auctionId)
    }
  }

  return { processed, skipped }
}

export function scheduleAuctionEnding(intervalMs = 30000): ReturnType<typeof setInterval> {
  return setInterval(() => {
    processEndedAuctions().catch((err: unknown) => {
      console.error('[auction-ending] worker error:', err)
    })
  }, intervalMs)
}

export async function checkAndEndAuction(auctionId: string): Promise<boolean> {
  const payload = await getPayloadClient()

  const auction = await payload.findByID({
    collection: 'auctions',
    id: auctionId,
    depth: 0,
  })

  const a = auction as Record<string, unknown> | null

  if (a == null) return false
  if (a.status !== 'active') return false
  if ((a.endsAt as string) <= nowISO()) {
    const result = await processEndedAuctions()
    return result.processed > 0
  }

  return false
}