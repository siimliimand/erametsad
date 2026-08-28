import crypto from 'node:crypto'

interface UserClient {
  clientId: string
  controller: ReadableStreamDefaultController<Uint8Array>
}

export type MyStreamEvent =
  | 'bid'
  | 'outbid'
  | 'auction_end'
  | 'notification'
  | 'countdown_sync'

const users = new Map<string, Map<string, UserClient>>()
const encoder = new TextEncoder()

function formatSSE(event: string, data: unknown): Uint8Array {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

function toISO(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

export function addUserClient(
  userId: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): { clientId: string; controller: ReadableStreamDefaultController<Uint8Array> } {
  let userClients = users.get(userId)
  if (!userClients) {
    userClients = new Map()
    users.set(userId, userClients)
  }

  const clientId = crypto.randomUUID()
  const client: UserClient = { clientId, controller }
  userClients.set(clientId, client)
  return { clientId, controller }
}

export function removeUserClient(userId: string, clientId: string): void {
  const userClients = users.get(userId)
  if (!userClients) return

  userClients.delete(clientId)
  if (userClients.size === 0) {
    users.delete(userId)
  }
}

export function sendToUser(userId: string, event: string, data: unknown): void {
  const userClients = users.get(userId)
  if (!userClients) return

  const message = formatSSE(event, data)
  for (const [clientId, client] of userClients) {
    try {
      client.controller.enqueue(message)
    } catch {
      userClients.delete(clientId)
    }
  }

  if (userClients.size === 0) {
    users.delete(userId)
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

export function getUserEventStream(userId: string): ReadableStream<Uint8Array> {
  let clientId = ''
  let heartbeat: ReturnType<typeof setInterval> | undefined

  return new ReadableStream({
    start(controller) {
      const client = addUserClient(userId, controller)
      clientId = client.clientId

      const connected = formatSSE('connected', { status: 'ok' })
      try {
        controller.enqueue(connected)
      } catch {
        removeUserClient(userId, clientId)
        return
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          if (heartbeat !== undefined) clearInterval(heartbeat)
          removeUserClient(userId, clientId)
        }
      }, 30000)
    },
    cancel() {
      if (heartbeat !== undefined) clearInterval(heartbeat)
      removeUserClient(userId, clientId)
    },
  })
}
