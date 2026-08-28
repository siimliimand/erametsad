import {
  bidPlatedTemplate,
  outbidTemplate,
  auctionWonTemplate,
  auctionEndedTemplate,
  contractReadyTemplate,
} from '@eametsad/emails'
import nodemailer, { type Transporter } from 'nodemailer'
import type { Payload } from 'payload'


import { type DomainEvent, type DomainEventType, type EventBus } from './event-bus'

import { env } from '@/env'
import { getPayloadClient } from '@/payload/payloadClient'

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
  // No email templates exist for seller decisions yet; in-app only.
  'bid.approved': ['inApp'],
  'bid.rejected': ['inApp'],
}

const eventTitles: Record<DomainEventType, string> = {
  'bid.created': 'Pakkumus registreeritud',
  'auction.ended': 'Oksjon on lõppenud',
  'contract.ready': 'Leping on allkirjastamiseks valmis',
  outbid: 'Teie pakkumus on üle pakutud',
  'auction.won': 'Te võitsite oksjoni',
  'bid.approved': 'Teie pakkumus on kinnitatud',
  'bid.rejected': 'Teie pakkumus on tagasi lükatud',
}

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  transporter ??= nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: false,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  })
  return transporter
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
    case 'contract.ready':
      return contractReadyTemplate({
        auctionTitle: payload.auctionTitle as string,
      })
    case 'bid.approved':
      return `Teie pakkumus ${String(payload.amount)} EUR oksjonil "${String(
        payload.auctionTitle,
      )}" on müüja poolt kinnitatud ja juhtiv.`
    case 'bid.rejected':
      return `Müüja lükkas teie pakkumuse ${String(payload.amount)} EUR oksjonil "${String(
        payload.auctionTitle,
      )}" tagasi.`
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
        email: (doc.email as boolean | undefined) ?? true,
        sms: (doc.sms as boolean | undefined) ?? false,
        inApp: (doc.inApp as boolean | undefined) ?? true,
      }
    }
  } catch {
    // no preferences found
  }
  return { email: true, sms: false, inApp: true }
}

async function lookupEmail(payload: Payload, userId: string | number): Promise<string | undefined> {
  try {
    const user = (await payload.findByID({
      collection: 'users',
      id: userId,
      depth: 0,
    })) as Record<string, unknown>
    return user.email as string | undefined
  } catch {
    return undefined
  }
}

// Relationship fields reject numeric strings for number-typed ids, and
// every emitter (JWT subject, decrypted bids) carries userId as a string.
function relationUser(value: string | number): string | number {
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number(value)
  return value
}

async function dispatchEmail(userId: string | number, event: DomainEvent, body: string, payload: Payload): Promise<void> {
  const to = await lookupEmail(payload, userId)
  if (!to) {
    console.warn(`[NOTIFICATION] No email address for user ${String(userId)}; email skipped`)
  } else {
    await getTransporter().sendMail({
      from: env.SMTP_FROM,
      to,
      subject: eventTitles[event.type],
      text: body,
    })
  }

  await payload.create({
    collection: 'notifications',
    data: {
      user: relationUser(userId),
      event: event.type,
      channel: 'email',
      title: eventTitles[event.type],
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    },
  })
}

async function dispatchSms(userId: string | number, event: DomainEvent, body: string, payload: Payload): Promise<void> {
  console.log(`[NOTIFICATION] SMS stub to user ${String(userId)}: ${body}`)

  await payload.create({
    collection: 'notifications',
    data: {
      user: relationUser(userId),
      event: event.type,
      channel: 'sms',
      title: eventTitles[event.type],
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
      user: relationUser(userId),
      event: event.type,
      channel: 'in_app',
      title: eventTitles[event.type],
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    },
  })
}

const dispatched = new Set<string>()

function dedupeKey(event: DomainEvent): string {
  return `${String(event.userId)}:${event.type}:${JSON.stringify(event.payload)}`
}

export function startListening(bus: EventBus): void {
  const handler = async (event: DomainEvent) => {
    const templateBody = getTemplate(event.type, event.payload)
    if (!templateBody) return

    const key = dedupeKey(event)
    if (dispatched.has(key)) return
    dispatched.add(key)

    const pl = await getPayloadClient()
    const prefs = await lookupPreferences(pl, event.userId)

    const channels = eventChannels[event.type]
    for (const channel of channels) {
      if (!prefs[channel]) continue

      switch (channel) {
        case 'email':
          await dispatchEmail(event.userId, event, templateBody, pl)
          break
        case 'sms':
          await dispatchSms(event.userId, event, templateBody, pl)
          break
        case 'inApp':
          await dispatchInApp(event.userId, event, templateBody, pl)
          break
      }
    }
  }

  const handleSafely = async (event: DomainEvent) => {
    try {
      await handler(event)
    } catch (error) {
      console.error(`[NOTIFICATION] Dispatch failed for ${event.type} (user ${String(event.userId)}):`, error)
    }
  }

  bus.on('bid.created', (event) => { void handleSafely(event) })
  bus.on('auction.ended', (event) => { void handleSafely(event) })
  bus.on('contract.ready', (event) => { void handleSafely(event) })
  bus.on('outbid', (event) => { void handleSafely(event) })
  bus.on('auction.won', (event) => { void handleSafely(event) })
  bus.on('bid.approved', (event) => { void handleSafely(event) })
  bus.on('bid.rejected', (event) => { void handleSafely(event) })
}
