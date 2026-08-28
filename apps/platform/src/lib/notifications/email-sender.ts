import { getCloudflareContext } from '@opennextjs/cloudflare'
import nodemailer, { type Transporter } from 'nodemailer'

export type EmailTransportName = 'email-binding' | 'cloudflare-api' | 'smtp'

export interface SendResult {
  success: boolean
  messageId?: string
  transport: EmailTransportName
  error?: { code?: string; message: string }
}

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

// Prototype sender on the ww0.dev zone per the design addendum
// (2026-08-28); the production cutover swaps this to noreply@erametsad.ee.
const DEFAULT_FROM = 'noreply@erametsad.ww0.dev'

const CLOUDFLARE_API_BASE = 'https://api.cloudflare.com/client/v4'
const API_SEND_TIMEOUT_MS = 10_000

// Minimal local surface of the Workers `send_email` binding. Declared here
// because @cloudflare/workers-types is deliberately not installed
// (same approach as the D1 types in src/lib/db.ts).
export interface EmailSenderBinding {
  send(message: {
    from: string
    to: string | string[]
    subject: string
    html: string
  }): Promise<{ messageId?: string } | undefined>
}

declare global {
  interface CloudflareEnv {
    /** `send_email` binding; absent until the wrangler wiring lands (task 4.2). */
    EMAIL?: EmailSenderBinding
  }
}

interface OutgoingEmail {
  from: string
  to: string[]
  subject: string
  html: string
}

interface EmailTransport {
  readonly name: EmailTransportName
  canSend(): boolean
  send(message: OutgoingEmail): Promise<SendResult>
}

let emailBindingForTests: EmailSenderBinding | null | undefined

// Test seam in the style of setD1ForTests (src/lib/db.ts): when set, the
// Cloudflare context is never touched, so unit tests run in plain Node.
export function setEmailBindingForTests(binding: EmailSenderBinding | null): void {
  emailBindingForTests = binding
}

async function resolveEmailBinding(): Promise<EmailSenderBinding | undefined> {
  if (emailBindingForTests !== undefined) return emailBindingForTests ?? undefined
  try {
    // Fetched per call, never cached as a module singleton: isolates are
    // reused across requests and a cached binding could outlive its
    // invocation (same reasoning as getD1Database).
    const context = await getCloudflareContext({ async: true })
    return context.env.EMAIL
  } catch {
    return undefined
  }
}

function resolveApiConfig(): { token: string; accountId: string } | undefined {
  const token = process.env.CLOUDFLARE_EMAIL_TOKEN
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !accountId) return undefined
  return { token, accountId }
}

function normalizeOptions(options: SendEmailOptions): OutgoingEmail {
  const to = (Array.isArray(options.to) ? options.to : [options.to])
    .map((recipient) => recipient.trim())
    .filter((recipient) => recipient.length > 0)
  if (to.length === 0) {
    throw new TypeError('sendEmail: "to" must contain at least one recipient')
  }
  if (typeof options.subject !== 'string' || options.subject.length === 0) {
    throw new TypeError('sendEmail: "subject" is required')
  }
  if (typeof options.html !== 'string' || options.html.length === 0) {
    throw new TypeError('sendEmail: "html" is required')
  }
  const from = options.from?.trim()
  return {
    from: from !== undefined && from !== '' ? from : DEFAULT_FROM,
    to,
    subject: options.subject,
    html: options.html,
  }
}

function successResult(transport: EmailTransportName, messageId: string | undefined): SendResult {
  const result: SendResult = { success: true, transport }
  if (messageId !== undefined) result.messageId = messageId
  return result
}

function transportFailure(transport: EmailTransportName, error: unknown): SendResult {
  const coded = error as { code?: string | number } | null
  const failure: { code?: string; message: string } = {
    message: error instanceof Error ? error.message : String(error),
  }
  if (coded?.code !== undefined) failure.code = String(coded.code)
  return { success: false, transport, error: failure }
}

function emailBindingTransport(binding: EmailSenderBinding | undefined): EmailTransport {
  return {
    name: 'email-binding',
    canSend: () => binding !== undefined,
    async send(message) {
      if (!binding) {
        return transportFailure('email-binding', new Error('EMAIL binding unavailable'))
      }
      try {
        const outcome = await binding.send({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        })
        return successResult('email-binding', outcome?.messageId)
      } catch (error) {
        return transportFailure('email-binding', error)
      }
    },
  }
}

interface CloudflareApiSendBody {
  success?: boolean
  errors?: { code?: number | string; message?: string }[]
  result?: {
    delivered?: string[] | number
    queued?: string[] | number
    permanent_bounces?: string[] | number
    message_id?: string
  }
}

function countRecipients(value: string[] | number | undefined): number {
  if (Array.isArray(value)) return value.length
  return typeof value === 'number' ? value : 0
}

function cloudflareApiTransport(
  config: { token: string; accountId: string } | undefined,
): EmailTransport {
  return {
    name: 'cloudflare-api',
    canSend: () => config !== undefined,
    async send(message) {
      if (!config) {
        return transportFailure(
          'cloudflare-api',
          new Error('CLOUDFLARE_EMAIL_TOKEN and CLOUDFLARE_ACCOUNT_ID are required'),
        )
      }
      try {
        // Endpoint per apps/platform/spikes/email/REPORT.md, "Send
        // interfaces, for later use".
        const response = await fetch(
          `${CLOUDFLARE_API_BASE}/accounts/${config.accountId}/email/sending/send`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${config.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: message.from,
              to: message.to,
              subject: message.subject,
              html: message.html,
            }),
            signal: AbortSignal.timeout(API_SEND_TIMEOUT_MS),
          },
        )
        const body = (await response.json().catch(() => null)) as CloudflareApiSendBody | null
        if (!response.ok || body?.success === false) {
          const first = body?.errors?.[0]
          const httpStatus = String(response.status)
          return {
            success: false,
            transport: 'cloudflare-api',
            error: {
              code: first?.code !== undefined ? String(first.code) : `E_HTTP_${httpStatus}`,
              message:
                first?.message ?? `Cloudflare API request failed (HTTP ${httpStatus})`,
            },
          }
        }
        const result = body?.result
        const accepted = countRecipients(result?.delivered) + countRecipients(result?.queued)
        if (accepted === 0) {
          return {
            success: false,
            transport: 'cloudflare-api',
            error: {
              code: 'E_PERMANENT_BOUNCE',
              message: 'All recipients permanently bounced',
            },
          }
        }
        return successResult('cloudflare-api', result?.message_id)
      } catch (error) {
        return transportFailure('cloudflare-api', error)
      }
    },
  }
}

let smtpTransporter: Transporter | null = null

function getSmtpTransporter(): Transporter {
  // Mirrors the transporter factory in src/lib/notifications/service.ts so
  // `next dev` keeps sending through Mailpit unchanged. The empty-string
  // host and the 587 port are unreachable defaults: canSend() gates on
  // SMTP_HOST, and 587 is nodemailer's own default port.
  smtpTransporter ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? '',
    port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
    secure: false,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })
  return smtpTransporter
}

function smtpTransport(): EmailTransport {
  return {
    name: 'smtp',
    canSend: () => Boolean(process.env.SMTP_HOST),
    async send(message) {
      try {
        // @types/nodemailer types the send result as `any`; narrowed to the
        // only field this chain consumes.
        const info = (await getSmtpTransporter().sendMail({
          from: message.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
        })) as { messageId?: string }
        return successResult('smtp', info.messageId)
      } catch (error) {
        return transportFailure('smtp', error)
      }
    },
  }
}

/**
 * Transport chain: Workers EMAIL binding, then the Cloudflare Email Service
 * REST API, then SMTP (Mailpit in `next dev`). Transports whose
 * prerequisites are absent are skipped; the first success wins.
 */
export async function sendEmail(options: SendEmailOptions): Promise<SendResult> {
  const message = normalizeOptions(options)
  const transports: EmailTransport[] = [
    emailBindingTransport(await resolveEmailBinding()),
    cloudflareApiTransport(resolveApiConfig()),
    smtpTransport(),
  ]

  let lastFailure: SendResult | undefined
  for (const transport of transports) {
    if (!transport.canSend()) continue
    const result = await transport.send(message)
    if (result.success) return result
    lastFailure = result
  }

  // Nothing succeeded. When no transport was even attemptable, label the
  // result with the final chain entry so the union stays closed.
  return (
    lastFailure ?? {
      success: false,
      transport: 'smtp',
      error: {
        code: 'E_NO_TRANSPORT',
        message:
          'No email transport available: EMAIL binding absent, CLOUDFLARE_EMAIL_TOKEN/CLOUDFLARE_ACCOUNT_ID unset, SMTP_HOST unset',
      },
    }
  )
}
