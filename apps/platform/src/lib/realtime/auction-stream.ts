import crypto from 'node:crypto'

interface SSEClient {
  clientId: string
  controller: ReadableStreamDefaultController<Uint8Array>
}

export type PublicStreamEvent =
  | 'auction:published'
  | 'auction:extended'
  | 'auction:ended'
  | 'bid:created'

const clients = new Map<string, SSEClient>()
const encoder = new TextEncoder()

function formatSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function toISO(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function addClient(
  controller: ReadableStreamDefaultController<Uint8Array>,
): { clientId: string; controller: ReadableStreamDefaultController<Uint8Array> } {
  const clientId = crypto.randomUUID()
  const client: SSEClient = { clientId, controller }
  clients.set(clientId, client)
  return { clientId, controller }
}

export function removeClient(clientId: string): void {
  clients.delete(clientId)
}

export function broadcast(event: string, data: unknown): void {
  const message = formatSSE(event, data)
  for (const [clientId, client] of clients) {
    try {
      client.controller.enqueue(message)
    } catch {
      clients.delete(clientId)
    }
  }
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

// The input type deliberately carries no bidder field: the public
// bid:created payload must stay anonymised by construction.
export function emitBidCreated(input: BidCreatedEventInput): void {
  broadcast('bid:created', {
    auctionId: input.auctionId,
    amount: input.amount,
    placedAt: toISO(input.placedAt ?? new Date()),
  })
}

export function emitAuctionExtended(input: AuctionExtendedEventInput): void {
  broadcast('auction:extended', {
    auctionId: input.auctionId,
    previousEndsAt: toISO(input.previousEndsAt),
    endsAt: toISO(input.endsAt),
  })
}

export function emitAuctionEnded(input: AuctionEndedEventInput): void {
  broadcast('auction:ended', {
    auctionId: input.auctionId,
    type: input.type,
    hasWinner: input.hasWinner,
  })
}

export function emitAuctionPublished(input: AuctionPublishedEventInput): void {
  broadcast('auction:published', {
    auctionId: input.auctionId,
    endsAt: input.endsAt === undefined ? undefined : toISO(input.endsAt),
    objectType: input.objectType,
  })
}

export function getEventStream(): ReadableStream<Uint8Array> {
  let clientId = ''
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream({
    start(controller) {
      const client = addClient(controller)
      clientId = client.clientId

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          if (heartbeat !== undefined) clearInterval(heartbeat)
          removeClient(clientId)
        }
      }, 30000)
    },
    cancel() {
      if (heartbeat !== undefined) clearInterval(heartbeat)
      removeClient(clientId)
    },
  })
}
