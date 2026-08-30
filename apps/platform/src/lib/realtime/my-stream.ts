import {
  addFanOutTarget,
  registerAuctionFeed,
  removeFanOutTarget,
  type AuctionDoFetch,
  type AuctionStreamOptions,
  type PublicStreamEvent,
  type RegisteredFeed,
} from './auction-stream'
import { getRepositories } from '../data/runtime'

export type MyStreamEvent =
  | 'bid'
  | 'outbid'
  | 'auction_end'
  | 'notification'
  | 'countdown_sync'

const encoder = new TextEncoder()
const HEARTBEAT_MS = 30_000
const HEARTBEAT_FRAME = encoder.encode(': heartbeat\n\n')
const MAX_USER_FEEDS = 20

function formatSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function toISO(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function relationToString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (value !== null && typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return ''
}

// ---- per-user push demux (same-isolate supplement) ----
// The cross-isolate backbone is the merged AuctionDO feed below: outbid
// and auction_end are derived there for the authenticated user. These
// push targets only cover callers that run in the same isolate as the
// open stream (seller approval routes, the bid-route mirror), which is
// why the public push functions stay exported.
interface PushTarget {
  deliver(frame: Uint8Array): void
}

const pushTargets = new Map<string, Set<PushTarget>>()

function sendToUser(userId: string, event: string, data: unknown): void {
  const targets = pushTargets.get(userId)
  if (!targets) return

  const message = formatSSE(event, data)
  for (const target of [...targets]) {
    try {
      target.deliver(message)
    } catch {
      targets.delete(target)
    }
  }
  if (targets.size === 0) {
    pushTargets.delete(userId)
  }
}

export interface BidEventInput {
  auctionId: string
  bidId?: string
  amount: number
  status?: string
  placedAt?: string | Date
}

export interface OutbidEventInput {
  auctionId: string
  auctionTitle?: string
  previousAmount?: number
  newAmount: number
  placedAt?: string | Date
}

export interface AuctionEndEventInput {
  auctionId: string
  auctionTitle?: string
  outcome: 'won' | 'lost' | 'unsold' | 'ended'
  finalPrice?: number
  endedAt?: string | Date
}

export interface NotificationEventInput {
  notificationId?: string
  event: string
  title: string
  body?: string
  sentAt?: string | Date
}

export interface CountdownSyncEventInput {
  auctionId: string
  endsAt: string | Date
  serverTime?: string | Date
}

export function pushBidEvent(userId: string | number, input: BidEventInput): void {
  sendToUser(String(userId), 'bid', {
    auctionId: input.auctionId,
    bidId: input.bidId,
    amount: input.amount,
    status: input.status,
    placedAt: toISO(input.placedAt ?? new Date()),
  })
}

export function pushOutbid(userId: string | number, input: OutbidEventInput): void {
  sendToUser(String(userId), 'outbid', {
    auctionId: input.auctionId,
    auctionTitle: input.auctionTitle,
    previousAmount: input.previousAmount,
    newAmount: input.newAmount,
    placedAt: toISO(input.placedAt ?? new Date()),
  })
}

export function pushAuctionEnd(userId: string | number, input: AuctionEndEventInput): void {
  sendToUser(String(userId), 'auction_end', {
    auctionId: input.auctionId,
    auctionTitle: input.auctionTitle,
    outcome: input.outcome,
    finalPrice: input.finalPrice,
    endedAt: toISO(input.endedAt ?? new Date()),
  })
}

export function pushNotification(userId: string | number, input: NotificationEventInput): void {
  sendToUser(String(userId), 'notification', {
    notificationId: input.notificationId,
    event: input.event,
    title: input.title,
    body: input.body,
    sentAt: toISO(input.sentAt ?? new Date()),
  })
}

export function pushCountdownSync(userId: string | number, input: CountdownSyncEventInput): void {
  sendToUser(String(userId), 'countdown_sync', {
    auctionId: input.auctionId,
    endsAt: toISO(input.endsAt),
    serverTime: toISO(input.serverTime ?? new Date()),
  })
}

// ---- DO feed aggregation and per-user derivation ----

export interface UserAuctionFeedState {
  auctionId: string
  auctionTitle?: string | undefined
  endsAt?: string | undefined
  /** Latest known leading amount (EUR) on the auction. */
  lastAmount?: number | undefined
  /** The user's own leading amount while they hold the lead. */
  userLeadingAmount?: number | undefined
}

export interface UserStreamFrame {
  event: MyStreamEvent
  data: Record<string, unknown>
}

/**
 * Pure mapping from a public DO event onto this user's stream frames,
 * mutating `state` so later events see the updated lead and end time.
 * Payload key order mirrors the legacy push functions byte for byte;
 * JSON.stringify drops the keys whose value is undefined, exactly like
 * the in-memory implementation did.
 */
export function deriveUserFrames(
  state: UserAuctionFeedState,
  type: PublicStreamEvent,
  data: Record<string, unknown>,
  now: Date = new Date(),
): UserStreamFrame[] {
  switch (type) {
    case 'bid:created': {
      const amount = data.amount
      if (typeof amount !== 'number' || !Number.isFinite(amount)) return []
      const frames: UserStreamFrame[] = []
      if (
        state.userLeadingAmount !== undefined &&
        amount > state.userLeadingAmount
      ) {
        frames.push({
          event: 'outbid',
          data: {
            auctionId: state.auctionId,
            auctionTitle: state.auctionTitle,
            previousAmount: state.userLeadingAmount,
            newAmount: amount,
            placedAt: typeof data.placedAt === 'string' ? data.placedAt : undefined,
          },
        })
        state.userLeadingAmount = undefined
      }
      state.lastAmount = amount
      return frames
    }
    case 'auction:extended': {
      if (typeof data.endsAt === 'string') state.endsAt = data.endsAt
      return [
        {
          event: 'countdown_sync',
          data: {
            auctionId: state.auctionId,
            endsAt: data.endsAt,
            serverTime: now.toISOString(),
          },
        },
      ]
    }
    case 'auction:ended': {
      const hasWinner = data.hasWinner
      const outcome =
        hasWinner === false
          ? 'unsold'
          : state.userLeadingAmount !== undefined
            ? 'won'
            : 'lost'
      return [
        {
          event: 'auction_end',
          data: {
            auctionId: state.auctionId,
            auctionTitle: state.auctionTitle,
            outcome,
            finalPrice: state.lastAmount,
            endedAt: now.toISOString(),
          },
        },
      ]
    }
    case 'auction:published':
      return []
  }
}

/**
 * Auctions the user is tied to: distinct auctions from their bids, most
 * recent first, filtered to still-active ones. `auction-subscriptions`
 * rows carry notification channel preferences, not auction ids, so bids
 * are the per-auction linkage.
 */
async function loadUserAuctionFeeds(userId: string): Promise<UserAuctionFeedState[]> {
  const repos = await getRepositories()

  const bidsResult = await repos.find({
    collection: 'bids',
    where: { user: { equals: userId } },
    sort: '-createdAt',
    limit: 100,
  })
  const auctionIds: string[] = []
  for (const doc of bidsResult.docs as Record<string, unknown>[]) {
    const auctionId = relationToString(doc.auction)
    if (auctionId.length > 0 && !auctionIds.includes(auctionId)) {
      auctionIds.push(auctionId)
      if (auctionIds.length >= MAX_USER_FEEDS) break
    }
  }
  if (auctionIds.length === 0) return []

  const auctionsResult = await repos.find({
    collection: 'auctions',
    where: { id: { in: auctionIds } },
    limit: auctionIds.length,
  })
  const activeIds: string[] = []
  const titles = new Map<string, string | undefined>()
  const endsAts = new Map<string, string | undefined>()
  for (const doc of auctionsResult.docs as Record<string, unknown>[]) {
    const id = relationToString(doc.id)
    if (doc.status !== 'active') continue
    activeIds.push(id)
    titles.set(id, typeof doc.title === 'string' ? doc.title : undefined)
    endsAts.set(id, typeof doc.endsAt === 'string' ? doc.endsAt : undefined)
  }
  if (activeIds.length === 0) return []

  const leadingResult = await repos.find({
    collection: 'bids',
    where: { auction: { in: activeIds }, status: { equals: 'leading' } },
    limit: activeIds.length,
  })
  const leadingByAuction = new Map<string, Record<string, unknown>>()
  for (const doc of leadingResult.docs as Record<string, unknown>[]) {
    const auctionId = relationToString(doc.auction)
    if (!leadingByAuction.has(auctionId)) leadingByAuction.set(auctionId, doc)
  }

  return activeIds.map((auctionId) => {
    const leading = leadingByAuction.get(auctionId)
    const leadingAmount = typeof leading?.amount === 'number' ? leading.amount : undefined
    const title = titles.get(auctionId)
    const endsAt = endsAts.get(auctionId)
    return {
      auctionId,
      ...(title !== undefined ? { auctionTitle: title } : {}),
      ...(endsAt !== undefined ? { endsAt } : {}),
      ...(leadingAmount !== undefined ? { lastAmount: leadingAmount } : {}),
      ...(leadingAmount !== undefined && relationToString(leading?.user) === userId
        ? { userLeadingAmount: leadingAmount }
        : {}),
    }
  })
}

export interface MyStreamOptions {
  origin?: string
  doFetch?: AuctionDoFetch
  /** State loader override for tests; defaults to the repository read. */
  loadUserAuctionFeeds?: (userId: string) => Promise<UserAuctionFeedState[]>
}

/**
 * Authenticated per-user stream: opens one AuctionDO feed per auction the
 * user bid on, merges them, and derives the per-user event names
 * (`outbid`, `auction_end`, `countdown_sync`) from the anonymised public
 * events. Same-isolate pushes via the push functions above still land on
 * the stream; the first frame is the legacy `connected` event.
 */
export async function createMyStream(
  userId: string,
  options: MyStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const load = options.loadUserAuctionFeeds ?? loadUserAuctionFeeds
  let states: UserAuctionFeedState[] = []
  try {
    states = await load(userId)
  } catch (error) {
    console.error('[my-stream] subscription load failed', error)
  }

  const feedOptions: AuctionStreamOptions = {
    ...(options.origin !== undefined ? { origin: options.origin } : {}),
    ...(options.doFetch !== undefined ? { doFetch: options.doFetch } : {}),
  }
  const feeds: RegisteredFeed[] = []
  for (const state of states) {
    try {
      const feed = await registerAuctionFeed(state.auctionId, feedOptions)
      if (feed !== null) feeds.push(feed)
    } catch (error) {
      console.error('[my-stream] subscribe failed, skipping feed', {
        auctionId: state.auctionId,
        error,
      })
    }
  }

  const stateByAuction = new Map(states.map((state) => [state.auctionId, state]))
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let tornDown = false
  let activePushTarget: PushTarget | undefined

  const teardown = (): void => {
    if (tornDown) return
    tornDown = true
    if (heartbeat !== undefined) clearInterval(heartbeat)
    if (activePushTarget !== undefined) {
      const targets = pushTargets.get(userId)
      if (targets) {
        targets.delete(activePushTarget)
        if (targets.size === 0) pushTargets.delete(userId)
      }
    }
    for (const feed of feeds) {
      removeFanOutTarget(feed.subscriptionId)
      void feed.close()
    }
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(formatSSE('connected', { status: 'ok' }))

      const pushTarget: PushTarget = {
        deliver: (frame) => {
          controller.enqueue(frame)
        },
      }
      activePushTarget = pushTarget
      let targets = pushTargets.get(userId)
      if (!targets) {
        targets = new Set()
        pushTargets.set(userId, targets)
      }
      targets.add(pushTarget)

      for (const feed of feeds) {
        addFanOutTarget(feed.subscriptionId, {
          auctionId: feed.auctionId,
          deliver: (type, data) => {
            const state = stateByAuction.get(feed.auctionId)
            if (!state) return
            const payload =
              data !== null && typeof data === 'object'
                ? (data as Record<string, unknown>)
                : {}
            const frames = deriveUserFrames(state, type, payload, new Date())
            for (const frame of frames) {
              controller.enqueue(formatSSE(frame.event, frame.data))
            }
          },
        })
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(HEARTBEAT_FRAME)
        } catch {
          teardown()
        }
      }, HEARTBEAT_MS)
    },
    cancel() {
      teardown()
    },
  })
}
