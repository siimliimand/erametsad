import type { DbDatabase } from '../lib/db'
import type { EmailSenderBinding } from '../lib/notifications/email-sender'

/**
 * Message body for the `erametsad-jobs` queue consumer. Producers send one
 * message per user and channel: the notification row already carries both,
 * so the consumer only delivers it.
 */
export interface NotificationFanoutJob {
  type: 'notification-fanout'
  notificationId: string
  /**
   * Producer-supplied identity for idempotency. Also matches the KV marker
   * written after a successful delivery, so redeliveries become no-ops.
   */
  dedupeKey?: string
}

/** Message body for contract PDF generation into the R2 `BUCKET` binding. */
export interface ContractPdfJob {
  type: 'contract-pdf'
  contractId: string
  dedupeKey?: string
}

/**
 * Message body for editor-image rendition generation (design D6). The media
 * row carries `r2Key` and the `renditions` column; the consumer writes the
 * variant objects into R2 and flips the column to `ready`/`failed`.
 */
export interface MediaRenditionsJob {
  type: 'media-renditions'
  mediaId: string
  dedupeKey?: string
}

export type JobPayload = NotificationFanoutJob | ContractPdfJob | MediaRenditionsJob

// Minimal runtime shapes for the queue handler entry point and the KV/R2
// bindings, declared locally for the same reason as DbDatabase in
// src/lib/db.ts: @cloudflare/workers-types conflicts with the other local
// minimal declarations in src. The real runtime bindings satisfy these
// structurally.

export interface QueueMessage<Body = JobPayload> {
  /** Stable across redeliveries of the same message. */
  id: string
  body: Body
  ack(): void
  retry(): void
}

export interface QueueMessageBatch<Body = JobPayload> {
  messages: QueueMessage<Body>[]
}

export interface QueueExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

export interface QueueKvNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

export interface QueueR2Bucket {
  put(
    key: string,
    value: string | ReadableStream | ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>
  get(key: string): Promise<QueueR2Object | null>
}

/** R2 GET result; the body bytes are read through arrayBuffer(). */
export interface QueueR2Object {
  key: string
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface QueueConsumerEnv {
  DB: DbDatabase
  KV?: QueueKvNamespace
  BUCKET?: QueueR2Bucket
  EMAIL?: EmailSenderBinding
}
