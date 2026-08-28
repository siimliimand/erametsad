export type PublicStreamEvent =
  | 'auction:published'
  | 'auction:extended'
  | 'auction:ended'
  | 'bid:created'

const PUBLIC_STREAM_EVENTS: readonly PublicStreamEvent[] = [
  'auction:published',
  'auction:extended',
  'auction:ended',
  'bid:created',
]

const encoder = new TextEncoder()
const HEARTBEAT_MS = 30_000
const HEARTBEAT_FRAME = encoder.encode(': heartbeat\n\n')

/** Base path of the worker route that receives the DO's fan-out POSTs. */
const FAN_OUT_ROUTE = '/api/v1/internal/auction-events'

export class AuctionStreamError extends Error {}

function formatSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// Minimal DO namespace surface (same local-declaration approach as
// src/lib/rate-limit.ts, so lib code never imports cloudflare:workers).
interface AuctionDONamespace {
  idFromName(name: string): unknown
  get(id: unknown): { fetch(input: string, init?: RequestInit): Promise<Response> }
}

interface WorkersContext {
  env?: { AUCTION?: AuctionDONamespace }
}

function auctionNamespace(): AuctionDONamespace | undefined {
  const globalScope = globalThis as unknown as Record<string | symbol, unknown>
  const probes = [
    globalScope[Symbol.for('__cloudflare-context__')],
    globalScope.__opennext_ctx__,
  ]
  for (const probe of probes) {
    if (probe && typeof probe === 'object') {
      const namespace = (probe as WorkersContext).env?.AUCTION
      if (namespace) return namespace
    }
  }
  return undefined
}

export interface AuctionDoCall {
  method: string
  body?: string
}

/**
 * Transport to the AuctionDO. Returns null when the AUCTION binding is
 * absent (plain `next dev`) so callers can degrade to a heartbeat-only
 * stream instead of failing the SSE response.
 */
export type AuctionDoFetch = (
  auctionId: string,
  operation: string,
  call: AuctionDoCall,
) => Promise<Response | null>

async function defaultAuctionDoFetch(
  auctionId: string,
  operation: string,
  call: AuctionDoCall,
): Promise<Response | null> {
  const namespace = auctionNamespace()
  if (!namespace) return null
  const stub = namespace.get(namespace.idFromName(auctionId))
  return stub.fetch(`https://auction-do/${auctionId}/${operation}`, {
    method: call.method,
    ...(call.body !== undefined
      ? { headers: { 'content-type': 'application/json' }, body: call.body }
      : {}),
  })
}

export interface AuctionStreamOptions {
  /** Kept for callers that attribute a stream to a user; not a filter. */
  userId?: string
  /** Origin the DO fan-out POSTs back to; the SSE route passes its own. */
  origin?: string
  /** Transport override for tests. */
  doFetch?: AuctionDoFetch
}

export interface RegisteredFeed {
  auctionId: string
  subscriptionId: string
  /** Unregisters the subscriber URL; safe to call more than once. */
  close(): Promise<void>
}

/**
 * Registers a subscriber URL on the auction's AuctionDO. Throws
 * AuctionStreamError when the DO rejects the subscription (for example an
 * unknown auction); returns null when no DO binding exists.
 */
export async function registerAuctionFeed(
  auctionId: string,
  options: AuctionStreamOptions,
): Promise<RegisteredFeed | null> {
  const doFetch = options.doFetch ?? defaultAuctionDoFetch
  const subscriptionId = crypto.randomUUID()
  const origin = options.origin ?? 'https://auction-stream.invalid'
  const subscriberUrl = `${origin}${FAN_OUT_ROUTE}/${subscriptionId}`

  let response: Response | null
  try {
    response = await doFetch(auctionId, 'subscribe', {
      method: 'POST',
      body: JSON.stringify({ url: subscriberUrl }),
    })
  } catch (error) {
    throw new AuctionStreamError(
      `AuctionDO subscribe failed for auction ${auctionId}: ${String(error)}`,
    )
  }
  if (response === null) return null
  if (!response.ok) {
    throw new AuctionStreamError(
      `AuctionDO subscribe rejected auction ${auctionId} with HTTP ${String(response.status)}`,
    )
  }
  return {
    auctionId,
    subscriptionId,
    close: () =>
      doFetch(auctionId, 'unsubscribe', {
        method: 'POST',
        body: JSON.stringify({ url: subscriberUrl }),
      })
        .then(() => undefined)
        .catch(() => undefined),
  }
}

/**
 * Open streams of THIS isolate, keyed by the opaque subscription id the
 * DO fan-out POSTs to. This is a connection demux, not a fan-out source
 * of truth: the DO owns distribution, and entries live only while their
 * stream is open. Events that land on an isolate without the target are
 * answered 202 so the DO does not prune a live subscriber URL; stream
 * cancellation is the authoritative unsubscribe.
 */
interface FanOutTarget {
  auctionId: string
  /** Throws when the underlying stream is closed; ingest cleans up. */
  deliver(type: PublicStreamEvent, data: unknown): void
}

const fanOutTargets = new Map<string, FanOutTarget>()

export function addFanOutTarget(subscriptionId: string, target: FanOutTarget): void {
  fanOutTargets.set(subscriptionId, target)
}

export function removeFanOutTarget(subscriptionId: string): void {
  fanOutTargets.delete(subscriptionId)
}

export interface FanOutPayload {
  type: PublicStreamEvent
  auctionId?: string
  data: unknown
}

function isFanOutPayload(value: unknown): value is FanOutPayload {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    typeof record.type === 'string' &&
    (PUBLIC_STREAM_EVENTS as readonly string[]).includes(record.type) &&
    'data' in record
  )
}

/** Bridge between the internal fan-out route and an open stream. */
export function ingestAuctionEvent(subscriptionId: string, payload: unknown): boolean {
  if (!isFanOutPayload(payload)) return false
  const target = fanOutTargets.get(subscriptionId)
  if (!target) return false
  try {
    target.deliver(payload.type, payload.data)
    return true
  } catch {
    fanOutTargets.delete(subscriptionId)
    return false
  }
}

function pipeFeedsToStream(
  feeds: readonly RegisteredFeed[],
): ReadableStream<Uint8Array> {
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let tornDown = false

  const teardown = (): void => {
    if (tornDown) return
    tornDown = true
    if (heartbeat !== undefined) clearInterval(heartbeat)
    for (const feed of feeds) {
      removeFanOutTarget(feed.subscriptionId)
      void feed.close()
    }
  }

  return new ReadableStream({
    start(controller) {
      for (const feed of feeds) {
        addFanOutTarget(feed.subscriptionId, {
          auctionId: feed.auctionId,
          deliver: (type, data) => {
            controller.enqueue(formatSSE(type, data))
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

/**
 * Per-auction public SSE stream. Subscribes to the auction's AuctionDO;
 * DO fan-out events arrive on the internal bridge route and are piped
 * through this isolate's demux as-is, so the frame bytes match the
 * frontend contract exactly. Without a DO binding the stream degrades to
 * the 30-second heartbeat.
 */
export async function createAuctionStream(
  auctionId: string,
  options: AuctionStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const feed = await registerAuctionFeed(auctionId, options)
  return pipeFeedsToStream(feed === null ? [] : [feed])
}

/**
 * Merged public stream over several auctions (the no-parameter
 * /api/v1/auctions/stream contract). Feeds that fail to subscribe are
 * skipped so one dead auction cannot take down the global stream.
 */
export async function createAuctionFeedStream(
  auctionIds: readonly string[],
  options: AuctionStreamOptions = {},
): Promise<ReadableStream<Uint8Array>> {
  const feeds: RegisteredFeed[] = []
  for (const auctionId of auctionIds) {
    try {
      const feed = await registerAuctionFeed(auctionId, options)
      if (feed !== null) feeds.push(feed)
    } catch (error) {
      console.error('[auction-stream] subscribe failed, skipping feed', {
        auctionId,
        error,
      })
    }
  }
  return pipeFeedsToStream(feeds)
}

export interface BidCreatedEventInput {
  auctionId: string
  amount: number
  placedAt?: string | Date
}

export interface AuctionExtendedEventInput {
  auctionId: string
  previousEndsAt: string | Date
  endsAt: string | Date
}

export interface AuctionEndedEventInput {
  auctionId: string
  type: 'open' | 'sealed'
  hasWinner?: boolean
}

export interface AuctionPublishedEventInput {
  auctionId: string
  endsAt?: string | Date
  objectType?: string
}

// The AuctionDO owns emission since this rebuild: admitBid and publish
// broadcast these event names to every registered subscriber. The shims
// below keep the legacy call sites (anti-snipe fallback, bids/create
// mirror, the auction-ending polling worker) compiling; emitting there
// would duplicate DO frames.
// eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate no-op shim, the AuctionDO owns emission
export function emitBidCreated(_input: BidCreatedEventInput): void {}
// eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate no-op shim, the AuctionDO owns emission
export function emitAuctionExtended(_input: AuctionExtendedEventInput): void {}
// eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate no-op shim, the AuctionDO owns emission
export function emitAuctionEnded(_input: AuctionEndedEventInput): void {}
// eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate no-op shim, the AuctionDO owns emission
export function emitAuctionPublished(_input: AuctionPublishedEventInput): void {}

// eslint-disable-next-line @typescript-eslint/no-empty-function -- deliberate no-op shim, the auction-ending worker's DO successor (task 6.2) owns this emission
export function broadcast(_event: string, _data: unknown): void {}
