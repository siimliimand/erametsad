import type { Payload } from 'payload'

import { getPayloadClient } from '@/payload/payloadClient'
import { eventBus, type DomainEvent, type DomainEventType } from './event-bus'
import {
  bidPlatedTemplate,
  outbidTemplate,
  auctionWonTemplate,
  auctionEndedTemplate,
} from '@eametsad/emails'

interface NotificationPreference {
  email: boolean
  sms: boolean
  inApp: boolean
}

const eventChannels: Record<DomainEventType, (keyof NotificationPreference)[]> = {
  'bid.created': ['email', 'inApp'],
  'auction.ended': ['email', 'inApp'],
  'contract.ready': ['email', 'sms', 'inApp'],
  outbid: ['email', 'inApp'],
  'auction.won': ['email', 'sms', 'inApp'],
}

function getTemplate(eventType: DomainEventType, payload: Record<string, unknown>): string | null {
  switch (eventType) {
    case 'bid.created':
      return bidPlatedTemplate({
        amount: payload.amount as number,
        auctionTitle: payload.auctionTitle as string,
      })
    case 'outbid':
      return outbidTemplate({
        auctionTitle: payload.auctionTitle as string,
        currentBid: payload.currentBid as number,
      })
    case 'auction.won':
      return auctionWonTemplate({
        auctionTitle: payload.auctionTitle as string,
        winningBid: payload.winningBid as number,
      })
    case 'auction.ended':
      return auctionEndedTemplate({
        auctionTitle: payload.auctionTitle as string,
        finalPrice: payload.finalPrice as number,
      })
    default:
      return null
  }
}

async function lookupPreferences(payload: Payload, userId: string | number): Promise<NotificationPreference> {
  try {
    const prefs = await payload.find({
      collection: 'notification-preferences',
      where: { user: { equals: userId } },
      limit: 1,
    })
    if (prefs.docs.length > 0) {
      const doc = prefs.docs[0] as Record<string, unknown>
      return {
        email: (doc.email as boolean) ?? true,
        sms: (doc.sms as boolean) ?? false,
        inApp: (doc.inApp as boolean) ?? true,
      }
    }
  } catch {
    // no preferences found
  }
  return { email: true, sms: false, inApp: true }
}

async function dispatchEmail(userId: string | number, event: DomainEvent, body: string, payload: Payload): Promise<void> {
  console.log(`[NOTIFICATION] Email to user ${userId}: ${body}`)

  await payload.create({
    collection: 'notifications',
    data: {
      user: userId,
      event: event.type,
      channel: 'email',
      title: `Event: ${event.type}`,
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    },
  })
}

async function dispatchSms(userId: string | number, event: DomainEvent, body: string, payload: Payload): Promise<void> {
  console.log(`[NOTIFICATION] SMS stub to user ${userId}: ${body}`)

  await payload.create({
    collection: 'notifications',
    data: {
      user: userId,
      event: event.type,
      channel: 'sms',
      title: `Event: ${event.type}`,
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    },
  })
}

async function dispatchInApp(userId: string | number, event: DomainEvent, body: string, payload: Payload): Promise<void> {
  await payload.create({
    collection: 'notifications',
    data: {
      user: userId,
      event: event.type,
      channel: 'in_app',
      title: `Event: ${event.type}`,
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    },
  })
}

export function startListening(bus: import('./event-bus').EventBus): void {
  const handler = async (event: DomainEvent) => {
    const templateBody = getTemplate(event.type as DomainEventType, event.payload)
    if (!templateBody) return

    const affectedUserId = event.payload.userId as string | number | undefined
    if (!affectedUserId) return

    const pl = await getPayloadClient()
    const prefs = await lookupPreferences(pl, affectedUserId)

    const channels = eventChannels[event.type as DomainEventType] ?? []
    for (const channel of channels) {
      if (!prefs[channel]) continue

      switch (channel) {
        case 'email':
          await dispatchEmail(affectedUserId, event, templateBody, pl)
          break
        case 'sms':
          await dispatchSms(affectedUserId, event, templateBody, pl)
          break
        case 'inApp':
          await dispatchInApp(affectedUserId, event, templateBody, pl)
          break
      }
    }
  }

  bus.on('bid.created', handler)
  bus.on('auction.ended', handler)
  bus.on('contract.ready', handler)
  bus.on('outbid', handler)
  bus.on('auction.won', handler)
}