import { env } from 'cloudflare:test'
import { drizzle } from 'drizzle-orm/d1'
import { describe, expect, it, vi } from 'vitest'

import * as schema from '../../lib/data/schema'
import type { RenditionCodecs, RenditionImage } from '../../lib/media/renditions'
import { buildRenditionKey } from '../../lib/media/renditions'
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

// ── media-renditions (design D6) ────────────────────────────────────────────

function fakeRenditionCodecs(
  source: { width: number; height: number },
  overrides: Partial<RenditionCodecs> = {},
): RenditionCodecs & { decodeCalls: unknown[] } {
  const image: RenditionImage = {
    data: new Uint8ClampedArray(source.width * source.height * 4),
    width: source.width,
    height: source.height,
  }
  const decodeImage = vi.fn(() => Promise.resolve(image))
  const codecs: RenditionCodecs = {
    decodeImage,
    resizeImage: vi.fn(
      (_image: RenditionImage, width: number, height: number): Promise<RenditionImage> =>
        Promise.resolve({
          data: new Uint8ClampedArray(width * height * 4),
          width,
          height,
        }),
    ),
    encodeImage: vi.fn(() => Promise.resolve({ bytes: new ArrayBuffer(64), mimeType: 'image/webp' })),
    ...overrides,
  }
  return Object.assign(codecs, { decodeCalls: decodeImage.mock.calls })
}

async function seedMedia(input: {
  mimeType: string
  r2Key?: string | null
  renditions?: string | null
  withObject?: boolean
}): Promise<{ id: string; r2Key: string | null }> {
  const id = crypto.randomUUID()
  const r2Key = input.r2Key === undefined ? `media/${id}-lahendamata.jpg` : input.r2Key
  const timestamp = new Date().toISOString()
  await db.insert(schema.media).values({
    id,
    filename: 'Metsa pilt.jpg',
    mimeType: input.mimeType,
    filesize: 8,
    r2Key,
    url: `/api/v1/media/${id}`,
    renditions: input.renditions ?? null,
    status: 'published',
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  if (input.withObject && typeof r2Key === 'string' && r2Key.length > 0) {
    await env.BUCKET.put(r2Key, new ArrayBuffer(8), {
      httpMetadata: { contentType: input.mimeType },
    })
  }
  return { id, r2Key }
}

function renditionsJob(mediaId: string): JobPayload {
  return { type: 'media-renditions', mediaId, dedupeKey: `renditions:${mediaId}` }
}

describe('media-renditions consumer', () => {
  it('writes the planned variants to R2 and marks the row ready', async () => {
    const { id } = await seedMedia({
      mimeType: 'image/jpeg',
      renditions: JSON.stringify({ status: 'pending' }),
      withObject: true,
    })
    const codecs = fakeRenditionCodecs({ width: 2000, height: 1250 })
    const { batch, tracked } = makeBatch([renditionsJob(id)])

    await queue(batch, env, ctx, { sendEmail: vi.fn(), renditions: codecs })

    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    const doc = await repos.findByID({ collection: 'media', id })
    const renditions = doc?.renditions as unknown as {
      status: string
      variants: Record<string, { key: string; width: number; mimeType: string }>
    }
    expect(renditions.status).toBe('ready')
    expect(Object.keys(renditions.variants).sort()).toEqual(['gallery', 'hero', 'thumb'])
    expect(renditions.variants.hero).toMatchObject({
      key: buildRenditionKey(id, 'Metsa pilt.jpg', 'hero'),
      width: 1600,
      mimeType: 'image/webp',
    })
    for (const name of ['hero', 'gallery', 'thumb'] as const) {
      const key = renditions.variants[name]?.key
      expect(key).toBeDefined()
      expect(await env.BUCKET.get(key ?? '')).not.toBeNull()
    }
  })

  it('marks the row failed and acks when the source cannot be decoded', async () => {
    const { id } = await seedMedia({
      mimeType: 'image/jpeg',
      renditions: JSON.stringify({ status: 'pending' }),
      withObject: true,
    })
    const codecs = fakeRenditionCodecs({ width: 2000, height: 1250 }, {
      decodeImage: () => Promise.reject(new Error('bad bytes')),
    })
    const { batch, tracked } = makeBatch([renditionsJob(id)])

    await queue(batch, env, ctx, { sendEmail: vi.fn(), renditions: codecs })

    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    const doc = await repos.findByID({ collection: 'media', id })
    const renditions = doc?.renditions as unknown as { status: string; error: string }
    expect(renditions.status).toBe('failed')
    expect(renditions.error).toContain('bad bytes')
  })

  it('drops the message when the media row is missing', async () => {
    const missingId = crypto.randomUUID()
    const { batch, tracked } = makeBatch([renditionsJob(missingId)])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await queue(batch, env, ctx, {
        sendEmail: vi.fn(),
        renditions: fakeRenditionCodecs({ width: 2000, height: 1250 }),
      })
    } finally {
      consoleError.mockRestore()
    }

    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
  })

  it('ignores formats without renditions', async () => {
    const { id } = await seedMedia({ mimeType: 'application/pdf', withObject: true })
    const codecs = fakeRenditionCodecs({ width: 2000, height: 1250 })
    const { batch, tracked } = makeBatch([renditionsJob(id)])

    await queue(batch, env, ctx, { sendEmail: vi.fn(), renditions: codecs })

    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    expect(codecs.decodeCalls).toHaveLength(0)
    const doc = await repos.findByID({ collection: 'media', id })
    expect(doc?.renditions).toBeNull()
  })

  it('marks the row failed when the row has no R2 object key', async () => {
    const { id } = await seedMedia({ mimeType: 'image/jpeg', r2Key: null })
    const { batch, tracked } = makeBatch([renditionsJob(id)])

    await queue(batch, env, ctx, {
      sendEmail: vi.fn(),
      renditions: fakeRenditionCodecs({ width: 2000, height: 1250 }),
    })

    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    const doc = await repos.findByID({ collection: 'media', id })
    const renditions = doc?.renditions as unknown as { status: string; error: string }
    expect(renditions.status).toBe('failed')
    expect(renditions.error).toContain('no R2 object key')
  })

  it('marks the row failed when the original object is missing from R2', async () => {
    const { id } = await seedMedia({
      mimeType: 'image/jpeg',
      renditions: JSON.stringify({ status: 'pending' }),
      withObject: false,
    })
    const { batch, tracked } = makeBatch([renditionsJob(id)])

    await queue(batch, env, ctx, {
      sendEmail: vi.fn(),
      renditions: fakeRenditionCodecs({ width: 2000, height: 1250 }),
    })

    expect(tracked[0]).toMatchObject({ acked: true, retried: false })
    const doc = await repos.findByID({ collection: 'media', id })
    const renditions = doc?.renditions as unknown as { status: string; error: string }
    expect(renditions.status).toBe('failed')
    expect(renditions.error).toContain('missing from R2')
  })

  it('retries when the R2 binding is absent', async () => {
    const { id } = await seedMedia({ mimeType: 'image/jpeg', withObject: false })
    const { batch, tracked } = makeBatch([renditionsJob(id)])
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      await queue(batch, { DB: env.DB }, ctx, {
        sendEmail: vi.fn(),
        renditions: fakeRenditionCodecs({ width: 2000, height: 1250 }),
      })
    } finally {
      consoleError.mockRestore()
    }

    expect(tracked[0]).toMatchObject({ acked: false, retried: true })
  })
})
