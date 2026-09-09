'use server'

import { revalidatePath } from 'next/cache'

import { requireAdminRepositories } from '../_lib/admin'
import { assertCan } from '../_lib/permissions'
import { isValidReason } from '../admin/content/_components/settings-audit'
import {
  renderTemplate,
  templateChannelLabels,
  templateEvents,
  templateVariables,
} from '../admin/settings/_components/notification-template-utils'

import type { CoreRepositories } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import { templateChannels, type TemplateChannel } from '@/lib/data/schema'
import { db } from '@/lib/db'
import { sendEmail } from '@/lib/notifications/email-sender'

/**
 * Marks one notification of the signed-in operator as read. Session guard
 * contexts cannot update notifications (guards.ts denies it), so the write
 * runs as system context scoped to the session user — the same pattern as
 * /api/v1/my/notifications/[id]/read. Returns true when the notification
 * counts as read afterwards.
 */
export async function markNotificationReadAction(formData: FormData): Promise<boolean> {
  const { session } = await requireAdminRepositories()

  const value = formData.get('id')
  const id = typeof value === 'string' ? value.trim() : ''
  if (!id) return false

  const repositories = await getRepositories()
  const result = await repositories.find({
    collection: 'notifications',
    where: {
      and: [{ id: { equals: id } }, { userId: { equals: session.userId } }],
    },
    limit: 1,
  })
  const doc = result.docs[0]
  if (!doc) return false

  // Idempotent: an already-read notification keeps its original readAt.
  if (doc.readAt) return true

  try {
    await repositories.update({
      collection: 'notifications',
      id,
      data: { readAt: new Date().toISOString() },
    })
  } catch {
    return false
  }

  revalidatePath('/admin', 'layout')
  return true
}

/**
 * Teavitused (task 4.3): notification template store with versioned rows.
 * The templates tables are not in the repository registry, so rows go
 * through the raw D1 executor (same escape hatch as _actions/users.ts)
 * while audit entries use the audited repository so the hash chain stays
 * intact. One row per version: an edit inserts the next version and
 * deactivates the previous one; restore copies an old row forward.
 */

export interface NotificationTemplateRow {
  id: string
  event: string
  channel: TemplateChannel
  subject: string | null
  body: string
  version: number
  active: boolean
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface TemplateActionResult {
  ok: boolean
  error?: string
}

export interface TemplateTestResult {
  ok: boolean
  recipient?: string
  error?: string
}

const SELECT_TEMPLATE = `SELECT id, event, channel, subject, body, version, active,
  updated_by AS updatedBy, created_at AS createdAt, updated_at AS updatedAt
  FROM notification_templates`

function nowIso(): string {
  return new Date().toISOString()
}

function templateFromRow(row: Record<string, unknown>): NotificationTemplateRow {
  return {
    id: String(row.id),
    event: String(row.event),
    channel: row.channel === 'sms' ? 'sms' : 'email',
    subject: typeof row.subject === 'string' ? row.subject : null,
    body: String(row.body),
    version: Number(row.version),
    active: Number(row.active) === 1,
    updatedBy: typeof row.updatedBy === 'string' ? row.updatedBy : null,
    createdAt: String(row.createdAt),
    updatedAt: String(row.updatedAt),
  }
}

async function findTemplateById(id: string): Promise<NotificationTemplateRow | null> {
  const { results } = await db.query(
    `${SELECT_TEMPLATE} WHERE id = ? LIMIT 1`,
    [id],
  )
  return results[0] ? templateFromRow(results[0]) : null
}

async function findActiveTemplate(
  event: string,
  channel: TemplateChannel,
): Promise<NotificationTemplateRow | null> {
  const { results } = await db.query(
    `${SELECT_TEMPLATE} WHERE event = ? AND channel = ? AND active = 1 LIMIT 1`,
    [event, channel],
  )
  return results[0] ? templateFromRow(results[0]) : null
}

async function nextVersion(event: string, channel: TemplateChannel): Promise<number> {
  const { results } = await db.query<{ maxVersion: number }>(
    `SELECT COALESCE(MAX(version), 0) AS maxVersion FROM notification_templates
     WHERE event = ? AND channel = ?`,
    [event, channel],
  )
  return (results[0]?.maxVersion ?? 0) + 1
}

/** Append-only audit write; the hash chain is handled by the repository. */
async function writeTemplateAudit(
  repositories: CoreRepositories,
  entry: {
    actorId: string
    action: string
    entityId: string
    before?: unknown
    after: unknown
  },
): Promise<void> {
  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: 'notification_template',
      entityId: entry.entityId,
      ...(entry.before !== undefined ? { before: entry.before } : {}),
      after: entry.after,
    },
  })
}

function revalidateSettings(): void {
  revalidatePath('/admin/settings')
}

/** Template list for the Teavitused section, versions newest first. */
export async function listNotificationTemplatesAction(): Promise<NotificationTemplateRow[]> {
  await requireAdminRepositories()

  const { results } = await db.query(
    `${SELECT_TEMPLATE} ORDER BY event, channel, version DESC`,
  )
  return results.map(templateFromRow)
}

/**
 * Creates a template (no id) or saves a new version of one (id of the
 * active row). Every save is audited with the mandatory reason; the
 * previous version stays as an inactive history row.
 */
export async function saveNotificationTemplateAction(
  formData: FormData,
): Promise<TemplateActionResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const read = (key: string): string => {
    const value = formData.get(key)
    return typeof value === 'string' ? value.trim() : ''
  }
  const reason = read('reason')
  const event = read('event')
  const channelRaw = read('channel')
  const subject = read('subject')
  const body = formData.get('body')
  const bodyText = typeof body === 'string' ? body.trim() : ''
  const id = read('id')

  if (!isValidReason(reason)) {
    return { ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' }
  }
  if (!templateEvents.some((definition) => definition.event === event)) {
    return { ok: false, error: 'Vali teadaolev sündmus.' }
  }
  if (!(templateChannels as readonly string[]).includes(channelRaw)) {
    return { ok: false, error: 'Vali kanal: e-post või SMS.' }
  }
  const channel = channelRaw as TemplateChannel
  if (channel === 'email' && subject.length === 0) {
    return { ok: false, error: 'E-posti mall vajab pealkirja.' }
  }
  if (bodyText.length === 0) {
    return { ok: false, error: 'Malli sisu on tühi.' }
  }

  const timestamp = nowIso()

  if (id) {
    const current = await findTemplateById(id)
    if (!current) {
      return { ok: false, error: 'Malli ei leitud.' }
    }
    const version = await nextVersion(current.event, current.channel)
    const newId = crypto.randomUUID()
    await db.batch([
      {
        sql: `UPDATE notification_templates SET active = 0, updated_at = ? WHERE id = ?`,
        params: [timestamp, current.id],
      },
      {
        sql: `INSERT INTO notification_templates
          (id, event, channel, subject, body, version, active, updated_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
        params: [newId, current.event, current.channel, subject || null, bodyText, version, session.userId, timestamp, timestamp],
      },
    ])

    await writeTemplateAudit(repositories, {
      actorId: session.userId,
      action: 'notification.template_update',
      entityId: newId,
      before: {
        templateId: current.id,
        event: current.event,
        channel: current.channel,
        version: current.version,
        subject: current.subject,
        body: current.body,
        reason,
      },
      after: {
        templateId: newId,
        event: current.event,
        channel: current.channel,
        version,
        subject: subject || null,
        body: bodyText,
        reason,
      },
    })

    revalidateSettings()
    return { ok: true }
  }

  const existing = await findActiveTemplate(event, channel)
  if (existing) {
    return {
      ok: false,
      error: `Mall sündmusele "${event}" (${templateChannelLabels[channel]}) on juba olemas — ava see muutmiseks.`,
    }
  }

  const newId = crypto.randomUUID()
  await db.query(
    `INSERT INTO notification_templates
      (id, event, channel, subject, body, version, active, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, 1, ?, ?, ?)`,
    [newId, event, channel, subject || null, bodyText, session.userId, timestamp, timestamp],
  )

  await writeTemplateAudit(repositories, {
    actorId: session.userId,
    action: 'notification.template_create',
    entityId: newId,
    after: {
      templateId: newId,
      event,
      channel,
      version: 1,
      subject: subject || null,
      body: bodyText,
      reason,
    },
  })

  revalidateSettings()
  return { ok: true }
}

/** Copies an old version forward as a new active version; audited. */
export async function restoreNotificationTemplateAction(
  id: string,
  reason: string,
): Promise<TemplateActionResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const trimmed = reason.trim()
  if (!isValidReason(trimmed)) {
    return { ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' }
  }
  const target = await findTemplateById(id)
  if (!target) {
    return { ok: false, error: 'Malli versiooni ei leitud.' }
  }
  if (target.active) {
    return { ok: false, error: 'See versioon on jubi aktiivne.' }
  }

  const version = await nextVersion(target.event, target.channel)
  const newId = crypto.randomUUID()
  const timestamp = nowIso()
  const active = await findActiveTemplate(target.event, target.channel)
  const statements = active
    ? [
        {
          sql: `UPDATE notification_templates SET active = 0, updated_at = ? WHERE id = ?`,
          params: [timestamp, active.id],
        },
        {
          sql: `INSERT INTO notification_templates
            (id, event, channel, subject, body, version, active, updated_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          params: [newId, target.event, target.channel, target.subject, target.body, version, session.userId, timestamp, timestamp],
        },
      ]
    : [
        {
          sql: `INSERT INTO notification_templates
            (id, event, channel, subject, body, version, active, updated_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
          params: [newId, target.event, target.channel, target.subject, target.body, version, session.userId, timestamp, timestamp],
        },
      ]
  await db.batch(statements)

  await writeTemplateAudit(repositories, {
    actorId: session.userId,
    action: 'notification.template_restore',
    entityId: newId,
    before: {
      restoredFrom: target.id,
      event: target.event,
      channel: target.channel,
      version: target.version,
      subject: target.subject,
      body: target.body,
      reason: trimmed,
    },
    after: {
      templateId: newId,
      event: target.event,
      channel: target.channel,
      version,
      subject: target.subject,
      body: target.body,
      reason: trimmed,
    },
  })

  revalidateSettings()
  return { ok: true }
}

/** Deletes the whole template group (every version); audited. */
export async function deleteNotificationTemplateAction(
  id: string,
  reason: string,
): Promise<TemplateActionResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const trimmed = reason.trim()
  if (!isValidReason(trimmed)) {
    return { ok: false, error: 'Põhjendus peab olema vähemalt 5 tähemärki.' }
  }
  const target = await findTemplateById(id)
  if (!target) {
    return { ok: false, error: 'Malli ei leitud.' }
  }

  const { results } = await db.query<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notification_templates WHERE event = ? AND channel = ?`,
    [target.event, target.channel],
  )
  const versionCount = results[0]?.n ?? 1
  await db.query(
    `DELETE FROM notification_templates WHERE event = ? AND channel = ?`,
    [target.event, target.channel],
  )

  await writeTemplateAudit(repositories, {
    actorId: session.userId,
    action: 'notification.template_delete',
    entityId: target.id,
    before: {
      templateId: target.id,
      event: target.event,
      channel: target.channel,
      version: target.version,
      versionCount,
      reason: trimmed,
    },
    after: { deleted: true, reason: trimmed },
  })

  revalidateSettings()
  return { ok: true }
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

/**
 * Test send (spec: attempted to the operator's own address, result shown).
 * Email rides the notification service transport (Mailpit in dev); SMS is
 * the same console stub the dispatcher uses. The attempt is audited, and
 * variables are filled with the documented sample values.
 */
export async function sendNotificationTestAction(id: string): Promise<TemplateTestResult> {
  const { session, repositories } = await requireAdminRepositories()
  assertCan(session.role, 'settings:write')

  const template = await findTemplateById(id)
  if (!template) {
    return { ok: false, error: 'Malli ei leitud.' }
  }

  const samples: Record<string, string> = {}
  for (const variable of templateVariables) {
    samples[variable.name] = variable.sample
  }
  const subject = template.subject ? renderTemplate(template.subject, samples) : ''
  const body = renderTemplate(template.body, samples)

  if (template.channel === 'sms') {
    console.warn(`[NOTIFICATION] SMS test stub (template ${template.id}): ${body}`)
    await writeTemplateAudit(repositories, {
      actorId: session.userId,
      action: 'notification.test_send',
      entityId: template.id,
      after: { templateId: template.id, channel: 'sms', ok: true },
    })
    return { ok: true }
  }

  const { results } = await db.query<{ email: string }>(
    `SELECT email FROM users WHERE id = ? LIMIT 1`,
    [session.userId],
  )
  const recipient = results[0]?.email
  if (!recipient) {
    return { ok: false, error: 'Operaatori e-posti aadress ei ole teada.' }
  }

  const result = await sendEmail({
    ...(process.env.SMTP_FROM ? { from: process.env.SMTP_FROM } : {}),
    to: recipient,
    subject,
    html: `<p>${escapeHtml(body).replaceAll('\n', '<br>')}</p>`,
  })

  await writeTemplateAudit(repositories, {
    actorId: session.userId,
    action: 'notification.test_send',
    entityId: template.id,
    after: {
      templateId: template.id,
      channel: 'email',
      recipient,
      ok: result.success,
      ...(result.success ? {} : { error: result.error?.message ?? 'tundmatu viga' }),
    },
  })

  return result.success
    ? { ok: true, recipient }
    : { ok: false, recipient, error: result.error?.message ?? 'Saamine ebaõnnestus.' }
}
