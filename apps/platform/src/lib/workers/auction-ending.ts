import { centsToEuros, eurosToCents } from '../data/repositories/money'
import { getRepositories } from '../data/runtime'
import { eventBus } from '../notifications/event-bus'
import { broadcast } from '../realtime/auction-stream'
import { upsertSnapshot } from '../stats/aggregation'

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

function isSealedAuction(auction: Record<string, unknown>): boolean {
  return auction.type === 'sealed'
}

function nowISO(): string {
  return new Date().toISOString()
}

function relationUserId(value: unknown): string | number | undefined {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value != null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return id
  }
  return undefined
}

export async function processEndedAuctions(): Promise<ProcessResult> {
  const repos = await getRepositories()
  const now = nowISO()

  const auctions = await repos.find({
    collection: 'auctions',
    where: {
      and: [
        { status: { equals: 'active' } },
        { endsAt: { less_than_equal: now } },
      ],
    },
    limit: 100,
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
      const currentAuction = await repos.findByID({
        collection: 'auctions',
        id: auctionId,
      })
      if (currentAuction?.status !== 'active') {
        skipped++
        continue
      }

      await repos.update({
        collection: 'auctions',
        id: auctionId,
        data: {
          status: 'ended',
          endedAt: nowISO(),
        },
      })

      const objectType = currentAuction.objectType as string
      const auctionTitle = currentAuction.title as string | undefined
      const area = getTotalArea(currentAuction)
      const seller = relationUserId(currentAuction.sellerId)

      if (isSealedAuction(currentAuction)) {
        if (seller !== undefined) {
          eventBus.emit({
            type: 'auction.ended',
            userId: seller,
            payload: { auctionId, auctionTitle, type: 'sealed' },
          })
        }

        await upsertSnapshot(repos, { objectType, eur: 0, area, count: 1 })

        broadcast('auction:ended', { auctionId, type: 'sealed' })

        processed++
        continue
      }

      const bids = await repos.find({
        collection: 'bids',
        where: {
          and: [
            { auction: { equals: auctionId } },
            { status: { equals: 'leading' } },
          ],
        },
        limit: 1,
      })

      const leadingBid = bids.docs[0] as Record<string, unknown> | undefined
      const leadingAmount =
        leadingBid === undefined ? 0 : centsToEuros(leadingBid.amountCents as number)
      const rawReserveCents = currentAuction.reservePriceCents
      const reserveSet = typeof rawReserveCents === 'number'
      const reserveMet =
        leadingBid !== undefined &&
        (!reserveSet || eurosToCents(leadingAmount) >= (rawReserveCents))

      if (leadingBid !== undefined && reserveMet) {
        await repos.update({
          collection: 'auctions',
          id: auctionId,
          data: {
            status: 'appraised',
            winningBid: leadingBid.id as string,
          },
        })

        const winner = relationUserId(leadingBid.userId)
        if (winner !== undefined) {
          eventBus.emit({
            type: 'auction.won',
            userId: winner,
            payload: { auctionId, auctionTitle, winningBid: leadingAmount },
          })
        }
        if (seller !== undefined) {
          eventBus.emit({
            type: 'auction.ended',
            userId: seller,
            payload: {
              auctionId,
              auctionTitle,
              type: 'open',
              hasWinner: true,
              finalPrice: leadingAmount,
            },
          })
        }

        await upsertSnapshot(repos, { objectType, eur: leadingAmount, area, count: 1 })

        broadcast('auction:ended', { auctionId, type: 'open', hasWinner: true })
      } else {
        await repos.update({
          collection: 'auctions',
          id: auctionId,
          data: {
            status: 'unsold',
          },
        })

        if (leadingBid !== undefined) {
          const bidder = relationUserId(leadingBid.userId)
          if (bidder !== undefined) {
            eventBus.emit({
              type: 'auction.ended',
              userId: bidder,
              payload: {
                auctionId,
                auctionTitle,
                type: 'open',
                hasWinner: false,
                reserveNotMet: true,
                amount: leadingAmount,
              },
            })
          }
        }
        if (seller !== undefined) {
          eventBus.emit({
            type: 'auction.ended',
            userId: seller,
            payload: {
              auctionId,
              auctionTitle,
              type: 'open',
              hasWinner: false,
              reserveNotMet: leadingBid !== undefined,
            },
          })
        }

        await upsertSnapshot(repos, { objectType, eur: 0, area, count: 1 })

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
  const repos = await getRepositories()

  const a = await repos.findByID({
    collection: 'auctions',
    id: auctionId,
  }) as Record<string, unknown> | null

  if (a == null) return false
  if (a.status !== 'active') return false
  if ((a.endsAt as string) <= nowISO()) {
    const result = await processEndedAuctions()
    return result.processed > 0
  }

  return false
}
