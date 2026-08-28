import { env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { describe, expect, it, vi } from 'vitest'

import * as schema from '../../lib/data/schema'
import { createRepositories, queue } from '../queue-consumer'
import type { JobPayload, QueueExecutionContext, QueueMessageBatch } from '../types'

const db = drizzle(env.DB, { schema })
const repos = createRepositories(env.DB)

const ctx: QueueExecutionContext = { waitUntil: () => undefined }

interface TrackedMessage {
  body: JobPayload
  id: string
  acked: boolean
  retried: boolean
}

function makeBatch(bodies: JobPayload[]): { batch: QueueMessageBatch; tracked: TrackedMessage[] } {
  const tracked: TrackedMessage[] = bodies.map((body, index) => ({
    body,
    id: `msg-${String(index)}-${crypto.randomUUID()}`,
    acked: false,
    retried: false,
  }))
  const batch: QueueMessageBatch = {
    messages: tracked.map((message) => ({
      id: message.id,
      body: message.body,
      ack: () => {
        message.acked = true
      },
      retry: () => {
        message.retried = true
      },
    })),
  }
  return { batch, tracked }
}

async function seedNotification(
  channel: 'email' | 'sms' | 'in_app',
): Promise<{ notificationId: string; email: string }> {
  const notificationId = crypto.randomUUID()
  const userId = crypto.randomUUID()
  const email = `winner-${userId.slice(0, 8)}@example.com`
  const timestamp = new Date().toISOString()
  await db.insert(schema.users).values({
    id: userId,
    email,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  await db.insert(schema.notifications).values({
    id: notificationId,
    userId,
    event: 'auction.won',
    channel,
    title: 'Te võitsite oksjoni',
    body: '<p>Palun allkirjastage leping.</p>',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  return { notificationId, email }
}

function fanoutJob(notificationId: string, dedupeKey: string): JobPayload {
  return { type: 'notification-fanout', notificationId, dedupeKey }
}

function successResult() {
  return { success: true, transport: 'email-binding' as const, messageId: '<m-1>' }
}

function rateLimitResult() {
  return {
    success: false,
    transport: 'email-binding' as const,
    error: { code: 'E_RATE_LIMIT_EXCEEDED', message: 'slow down' },
  }
}

describe('queue consumer', () => {
  it('delivers an email notification and records the delivery status', async () => {
    const { notificationId, email } = await seedNotification('email')
    const sendEmail = vi.fn().mockResolvedValue(successResult())
    const dedupeKey = `fanout:${notificationId}`
    const { batch, tracked } = makeBatch([fanoutJob(notificationId, dedupeKey)])

    await queue(batch, env, ctx, { sendEmail })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: email, subject: 'Te võitsite oksjoni' }),
    )
    expect(tracked[0]).toMatchObject({ acked: true, retried: false })

    const doc = await repos.findByID({ collection: 'notifications', id: notificationId })
    expect(doc?.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(doc?.sendResult).toEqual(successResult())
    expect(doc?.recipientResults).toEqual([{ email, status: 'delivered' }])
    expect(doc?.errorCode).toBeNull()

    expect(await env.KV.get(`queue-dedupe:${dedupeKey}`)).toBe('1')
  })

  it('skips a duplicate delivery that carries the same dedupeKey', async () => {
    const { notificationId } = await seedNotification('email')
    const sendEmail = vi.fn().mockResolvedValue(successResult())
    const dedupeKey = `fanout-dup:${notificationId}`
    const first = makeBatch([fanoutJob(notificationId, dedupeKey)])
    const second = makeBatch([fanoutJob(notificationId, dedupeKey)])

    await queue(first.batch, env, ctx, { sendEmail })
    await queue(second.batch, env, ctx, { sendEmail })

    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(second.tracked[0]).toMatchObject({ acked: true, retried: false })
  })

  it('retries the message when the email transport fails', async () => {
    const { notificationId, email } = await seedNotification('email')
    const sendEmail = vi.fn().mockResolvedValue(rateLimitResult())
    const dedupeKey = `fanout-retry:${notificationId}`
    const { batch, tracked } = makeBatch([fanoutJob(notificationId, dedupeKey)])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await queue(batch, env, ctx, { sendEmail })
    } finally {
      consoleError.mockRestore()
    }

    expect(tracked[0]).toMatchObject({ acked: false, retried: true })
    const doc = await repos.findByID({ collection: 'notifications', id: notificationId })
    expect(doc?.sentAt).toBeNull()
    expect(doc?.errorCode).toBe('E_RATE_LIMIT_EXCEEDED')
    expect(doc?.recipientResults).toEqual([{ email, status: 'failed' }])
    expect(await env.KV.get(`queue-dedupe:${dedupeKey}`)).toBeNull()
  })

  it('marks in-app notifications sent without an email round-trip', async () => {
    const { notificationId } = await seedNotification('in_app')
    const sendEmail = vi.fn().mockResolvedValue(successResult())
    const { batch, tracked } = makeBatch([
      fanoutJob(notificationId, `fanout-inapp:${notificationId}`),
    ])

    await queue(batch, env, ctx, { sendEmail })

    expect(sendEmail).not.toHaveBeenCalled()
    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    const doc = await repos.findByID({ collection: 'notifications', id: notificationId })
    expect(doc?.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('drops a fan-out message whose notification row is missing', async () => {
    const sendEmail = vi.fn().mockResolvedValue(successResult())
    const missingId = crypto.randomUUID()
    const { batch, tracked } = makeBatch([fanoutJob(missingId, `fanout-missing:${missingId}`)])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await queue(batch, env, ctx, { sendEmail })
    } finally {
      consoleError.mockRestore()
    }

    expect(sendEmail).not.toHaveBeenCalled()
    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
  })

  it('writes a contract PDF placeholder into R2', async () => {
    const contractId = crypto.randomUUID()
    const dedupeKey = `pdf:${contractId}`
    const { batch, tracked } = makeBatch([
      { type: 'contract-pdf', contractId, dedupeKey },
    ])

    await queue(batch, env, ctx, { sendEmail: vi.fn() })

    const object = await env.BUCKET.get(`contracts/${contractId}-placeholder.json`)
    expect(object).not.toBeNull()
    expect(object?.size ?? 0).toBeGreaterThan(0)
    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    expect(await env.KV.get(`queue-dedupe:${dedupeKey}`)).toBe('1')
  })

  it('retries a contract-pdf message when the R2 binding is absent', async () => {
    const contractId = crypto.randomUUID()
    const { batch, tracked } = makeBatch([{ type: 'contract-pdf', contractId }])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await queue(batch, { DB: env.DB }, ctx, { sendEmail: vi.fn() })
    } finally {
      consoleError.mockRestore()
    }

    expect(tracked[0]).toMatchObject({ acked: false, retried: true })
  })

  it('acks an unknown job type as poison', async () => {
    const sendEmail = vi.fn().mockResolvedValue(successResult())
    const { batch, tracked } = makeBatch([
      { type: 'reindex-search' } as unknown as JobPayload,
    ])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await queue(batch, env, ctx, { sendEmail })
    } finally {
      consoleError.mockRestore()
    }

    expect(sendEmail).not.toHaveBeenCalled()
    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
  })
})
