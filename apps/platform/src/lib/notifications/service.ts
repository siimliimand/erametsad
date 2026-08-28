import {
  bidPlatedTemplate,
  outbidTemplate,
  auctionWonTemplate,
  auctionEndedTemplate,
  contractReadyTemplate,
} from '@eametsad/emails'
import nodemailer, { type Transporter } from 'nodemailer'


import { type DomainEvent, type DomainEventType, type EventBus } from './event-bus'

import { env } from '@/env'
import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'

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

async function lookupPreferences(repos: CoreRepositories, userId: string | number): Promise<NotificationPreference> {
  try {
    // 'notification-preferences' is not a real collection (kept from the
    // Payload call); the UnknownCollectionError lands in the catch below
    // and the caller falls back to the defaults.
    const prefs = (await repos.find({
      collection: 'notification-preferences' as never,
      where: { user: { equals: String(userId) } },
      limit: 1,
    })) as { docs: Record<string, unknown>[] }
    if (prefs.docs.length > 0) {
      const doc = prefs.docs[0] ?? {}
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

async function lookupEmail(repos: CoreRepositories, userId: string | number): Promise<string | undefined> {
  try {
    const user = await repos.findByID({
      collection: 'users',
      id: userId,
    })
    return (user as { email?: string } | null)?.email
  } catch {
    return undefined
  }
}

async function dispatchEmail(userId: string | number, event: DomainEvent, body: string, repos: CoreRepositories): Promise<void> {
  const to = await lookupEmail(repos, userId)
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

  await repos.create({
    collection: 'notifications',
    data: {
      user: userId,
      event: event.type,
      channel: 'email',
      title: eventTitles[event.type],
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    } as never,
  })
}

async function dispatchSms(userId: string | number, event: DomainEvent, body: string, repos: CoreRepositories): Promise<void> {
  console.log(`[NOTIFICATION] SMS stub to user ${String(userId)}: ${body}`)

  await repos.create({
    collection: 'notifications',
    data: {
      user: userId,
      event: event.type,
      channel: 'sms',
      title: eventTitles[event.type],
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    } as never,
  })
}

async function dispatchInApp(userId: string | number, event: DomainEvent, body: string, repos: CoreRepositories): Promise<void> {
  await repos.create({
    collection: 'notifications',
    data: {
      user: userId,
      event: event.type,
      channel: 'in_app',
      title: eventTitles[event.type],
      body,
      payload: event.payload,
      sentAt: new Date().toISOString(),
    } as never,
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

    const repos = await getRepositories()
    const prefs = await lookupPreferences(repos, event.userId)

    const channels = eventChannels[event.type]
    for (const channel of channels) {
      if (!prefs[channel]) continue

      switch (channel) {
        case 'email':
          await dispatchEmail(event.userId, event, templateBody, repos)
          break
        case 'sms':
          await dispatchSms(event.userId, event, templateBody, repos)
          break
        case 'inApp':
          await dispatchInApp(event.userId, event, templateBody, repos)
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
