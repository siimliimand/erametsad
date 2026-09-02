import { drizzle } from 'drizzle-orm/d1'

import type {
  ContractPdfJob,
  JobPayload,
  NotificationFanoutJob,
  QueueConsumerEnv,
  QueueExecutionContext,
  QueueMessage,
  QueueMessageBatch,
} from './types'
import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
  type DocFor,
} from '../lib/data/repositories'
import * as schema from '../lib/data/schema'
import type { DbDatabase } from '../lib/db'
import type { SendEmailOptions, SendResult } from '../lib/notifications/email-sender'

type NotificationDoc = DocFor<'notifications'>

type RecipientDeliveryStatus = 'delivered' | 'queued' | 'permanent_bounces' | 'failed'

interface RecipientResult {
  email: string
  status: RecipientDeliveryStatus
}

export interface QueueConsumerDeps {
  /** Test seam; defaults to the sendEmail chain from task 4.1. */
  sendEmail?: (options: SendEmailOptions) => Promise<SendResult>
}

const DEDUPE_KEY_PREFIX = 'queue-dedupe:'
const DEDUPE_TTL_SECONDS = 86_400
const CONTRACT_ID_PATTERN = /^[A-Za-z0-9_-]+$/

/**
 * Repositories over the D1 binding passed by the queue runtime. Same
 * widening as getRepositories in src/lib/data/runtime.ts, which cannot be
 * reused here: it resolves the binding from the OpenNext request context,
 * which a standalone queue consumer does not have.
 */
export function createRepositories(db: DbDatabase): CoreRepositories {
  const database = drizzle(db as unknown as Parameters<typeof drizzle>[0], { schema })
  return createCoreRepositories(database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: (statements) => database.batch(statements),
  })
}

async function resolveSendEmail(
  env: QueueConsumerEnv,
): Promise<(options: SendEmailOptions) => Promise<SendResult>> {
  // Loaded lazily so tests that inject deps.sendEmail never evaluate
  // nodemailer inside workerd. The standalone consumer also has no OpenNext
  // request context, so the EMAIL binding reaches the transport chain
  // through the injection seam instead of sendEmail's own context lookup.
  const { sendEmail, setEmailBindingForTests } = await import('../lib/notifications/email-sender')
  setEmailBindingForTests(env.EMAIL ?? null)
  return sendEmail
}

// Mirrors recipientStatus in src/lib/notifications/service.ts (task 4.3)
// so rows written by the consumer and by the in-request path agree.
function recipientStatus(result: SendResult): RecipientDeliveryStatus {
  if (result.success) return 'delivered'
  if (result.error?.code === 'E_PERMANENT_BOUNCE') return 'permanent_bounces'
  return 'failed'
}

interface DeliveryRecord {
  sentAt?: string
  sendResult?: SendResult
  recipientResults?: RecipientResult[]
  errorCode?: string | null
}

/**
 * Persists the per-recipient delivery status from task 4.3. The columns may
 * not exist yet in a given D1 database (that change ships separately), so a
 * failed full write falls back to the `sentAt` baseline that always exists.
 */
async function recordDelivery(
  repos: CoreRepositories,
  id: string,
  record: DeliveryRecord,
): Promise<void> {
  try {
    await repos.update({ collection: 'notifications', id, data: record })
  } catch (error) {
    console.warn(
      `[queue-consumer] full delivery status write failed for ${id}; falling back to sentAt`,
      error,
    )
    await repos.update({
      collection: 'notifications',
      id,
      data: { sentAt: record.sentAt },
    })
  }
}

async function deliverEmail(
  repos: CoreRepositories,
  notification: NotificationDoc,
  send: (options: SendEmailOptions) => Promise<SendResult>,
): Promise<void> {
  const user = await repos.findByID({ collection: 'users', id: notification.userId })
  const to = user?.email
  if (!to) {
    // Permanent condition: retrying cannot add an email address.
    await recordDelivery(repos, notification.id, {
      errorCode: 'E_NO_RECIPIENT',
      recipientResults: [],
    })
    console.error(
      `[queue-consumer] no email address for user ${notification.userId}; notification ${notification.id} dropped`,
    )
    return
  }

  const html = notification.body ?? notification.title ?? notification.event
  const result = await send({
    to,
    subject: notification.title ?? notification.event,
    html,
  })
  const record: DeliveryRecord = {
    sendResult: result,
    recipientResults: [{ email: to, status: recipientStatus(result) }],
    errorCode: result.error?.code ?? null,
  }
  if (result.success) {
    record.sentAt = new Date().toISOString()
  }
  await recordDelivery(repos, notification.id, record)
  if (!result.success) {
    // Transient until proven otherwise; the retry policy and DLQ own the rest.
    throw new Error(
      `email send failed via ${result.transport} (code ${result.error?.code ?? 'unknown'}): ${result.error?.message ?? 'unknown error'}`,
    )
  }
}

async function handleNotificationFanout(
  payload: NotificationFanoutJob,
  env: QueueConsumerEnv,
  send: (options: SendEmailOptions) => Promise<SendResult>,
): Promise<void> {
  const repos = createRepositories(env.DB)
  const notification = await repos.findByID({
    collection: 'notifications',
    id: payload.notificationId,
  })
  if (!notification) {
    // Permanent condition: the row cannot appear by retrying.
    console.error(
      `[queue-consumer] notification ${payload.notificationId} not found; message dropped`,
    )
    return
  }

  if (notification.channel === 'email') {
    await deliverEmail(repos, notification, send)
    return
  }
  if (notification.channel === 'sms') {
    console.log(`[queue-consumer] SMS stub to user ${notification.userId}`)
  }
  await repos.update({
    collection: 'notifications',
    id: notification.id,
    data: { sentAt: notification.sentAt ?? new Date().toISOString() },
  })
}

async function handleContractPdf(
  payload: ContractPdfJob,
  env: QueueConsumerEnv,
): Promise<void> {
  if (!env.BUCKET) {
    throw new Error('R2 binding "BUCKET" not available; cannot store contract PDF')
  }
  if (!CONTRACT_ID_PATTERN.test(payload.contractId)) {
    throw new Error(`invalid contractId "${payload.contractId}"`)
  }
  const placeholder = JSON.stringify({
    contractId: payload.contractId,
    status: 'placeholder',
    generatedAt: new Date().toISOString(),
    note: 'Task 6.1 stub; real PDF generation lands with the PDF library decision',
  })
  await env.BUCKET.put(`contracts/${payload.contractId}-placeholder.json`, placeholder, {
    httpMetadata: { contentType: 'application/json' },
  })
}

async function dispatch(
  payload: JobPayload,
  env: QueueConsumerEnv,
  send: (options: SendEmailOptions) => Promise<SendResult>,
): Promise<void> {
  switch (payload.type) {
    case 'notification-fanout':
      await handleNotificationFanout(payload, env, send)
      return
    case 'contract-pdf':
      await handleContractPdf(payload, env)
      return
    default:
      // Unknown types are permanent poison; dropped until the DLQ (task 6.3).
      console.error(`[queue-consumer] unknown job type; message dropped`)
  }
}

function dedupeKeyOf(message: QueueMessage): string {
  const explicit = message.body.dedupeKey
  if (explicit !== undefined && explicit.length > 0) return `${DEDUPE_KEY_PREFIX}${explicit}`
  // Cloudflare keeps message.id stable across redeliveries of the same
  // message, so it identifies the delivery when the producer set no key.
  return `${DEDUPE_KEY_PREFIX}${message.body.type}:${message.id}`
}

async function isProcessed(env: QueueConsumerEnv, key: string): Promise<boolean> {
  if (!env.KV) return false
  try {
    return (await env.KV.get(key)) !== null
  } catch (error) {
    console.warn(`[queue-consumer] dedupe read failed for ${key}`, error)
    return false
  }
}

async function markProcessed(env: QueueConsumerEnv, key: string): Promise<void> {
  if (!env.KV) return
  try {
    await env.KV.put(key, '1', { expirationTtl: DEDUPE_TTL_SECONDS })
  } catch (error) {
    console.warn(`[queue-consumer] dedupe write failed for ${key}`, error)
  }
}

/**
 * Queue consumer entry point for the `erametsad-jobs` queue. One message per
 * user and channel; per-message failures retry instead of failing the batch.
 */
export async function queue(
  batch: QueueMessageBatch,
  env: QueueConsumerEnv,
  _ctx: QueueExecutionContext,
  deps: QueueConsumerDeps = {},
): Promise<void> {
  const send = deps.sendEmail ?? (await resolveSendEmail(env))
  for (const message of batch.messages) {
    const key = dedupeKeyOf(message)
    try {
      if (await isProcessed(env, key)) {
        message.ack()
        continue
      }
      await dispatch(message.body, env, send)
      await markProcessed(env, key)
      message.ack()
    } catch (error) {
      console.error(`[queue-consumer] message ${message.id} failed`, error)
      message.retry()
    }
  }
}
