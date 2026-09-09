import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteNotificationTemplateAction,
  listNotificationTemplatesAction,
  restoreNotificationTemplateAction,
  saveNotificationTemplateAction,
  sendNotificationTestAction,
} from '../notifications'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { createCoreRepositories, nodeIsikukoodCodec } from '@/lib/data/repositories'
import { setD1ForTests } from '@/lib/db'
import { sendEmail } from '@/lib/notifications/email-sender'

vi.mock('@/lib/notifications/email-sender', () => ({
  sendEmail: vi.fn(),
}))

const state = vi.hoisted((): {
  // D-6 tier: settings:write is superadmin-only (permissions.ts).
  session: { userId: string; role: string }
  repositories: unknown
} => ({
  session: { userId: 'admin-1', role: 'superadmin' },
  repositories: null,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('../../_lib/admin', () => ({
  requireAdminRepositories: vi.fn(() =>
    Promise.resolve({ session: state.session, repositories: state.repositories }),
  ),
}))

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
  setD1ForTests(testDb.d1)
  state.repositories = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
    batch: sqliteBatchRunner(testDb.raw),
  })
  testDb.raw
    .prepare(
      `INSERT INTO users (id, email, role, created_at, updated_at)
       VALUES ('admin-1', 'admin@erametsad.ee', 'admin', ?, ?)`,
    )
    .run(NOW, NOW)
})

afterEach(() => {
  setD1ForTests(null)
  testDb.close()
  vi.mocked(sendEmail).mockReset()
})

const form = (entries: Record<string, string>): FormData => {
  const formData = new FormData()
  for (const [key, value] of Object.entries(entries)) {
    formData.set(key, value)
  }
  return formData
}

interface AuditRow {
  action: string
  entity_type: string
  entity_id: string
  before: string | null
  after: string
}

function audits(): AuditRow[] {
  return (
    testDb.raw
      .prepare(
        `SELECT action, entity_type, entity_id, before, after FROM audit_entries
         ORDER BY created_at, id`,
      )
      .all() as AuditRow[]
  ).map((row) => row)
}

function templates(): { id: string; version: number; active: number; body: string }[] {
  return testDb.raw
    .prepare(
      `SELECT id, version, active, body FROM notification_templates
       ORDER BY event, channel, version`,
    )
    .all() as { id: string; version: number; active: number; body: string }[]
}

/** narrows the indexed row for strict TS without non-null assertions */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a row')
  return value
}

function createForm(): FormData {
  return form({
    event: 'auction.won',
    channel: 'email',
    subject: 'Te võitsite',
    body: 'Oksjon {{auctionTitle}} on võidetud.',
    reason: 'uus mall võiduteavitusele',
  })
}

describe('saveNotificationTemplateAction', () => {
  it('creates a v1 template and writes the audited reason', async () => {
    const result = await saveNotificationTemplateAction(createForm())

    expect(result.ok).toBe(true)
    const rows = templates()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ version: 1, active: 1 })

    const audit = audits()
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: 'notification.template_create',
      entity_type: 'notification_template',
    })
    expect(JSON.parse(must(audit[0]).after)).toMatchObject({
      event: 'auction.won',
      channel: 'email',
      version: 1,
      reason: 'uus mall võiduteavitusele',
    })
  })

  it('rejects a save without a valid reason and writes nothing', async () => {
    const result = await saveNotificationTemplateAction(
      form({ event: 'auction.won', channel: 'email', subject: 'x', body: 'y', reason: 'ei' }),
    )
    expect(result.ok).toBe(false)
    expect(templates()).toHaveLength(0)
    expect(audits()).toHaveLength(0)
  })

  it('rejects an unknown event', async () => {
    const result = await saveNotificationTemplateAction(
      form({ event: 'mingi.muu', channel: 'email', subject: 'x', body: 'y', reason: 'korrektne põhjendus' }),
    )
    expect(result.ok).toBe(false)
    expect(templates()).toHaveLength(0)
  })

  it('requires a subject for the email channel', async () => {
    const result = await saveNotificationTemplateAction(
      form({ event: 'auction.won', channel: 'email', body: 'y', reason: 'korrektne põhjendus' }),
    )
    expect(result.ok).toBe(false)
    expect(templates()).toHaveLength(0)
  })

  it('refuses a second active template for the same event and channel', async () => {
    await saveNotificationTemplateAction(createForm())
    const result = await saveNotificationTemplateAction(createForm())
    expect(result.ok).toBe(false)
    expect(templates()).toHaveLength(1)
  })

  it('saves an edit as the next inactive-then-active version pair', async () => {
    await saveNotificationTemplateAction(createForm())
    const v1 = must(templates()[0])

    const result = await saveNotificationTemplateAction(
      form({
        id: v1.id,
        event: 'auction.won',
        channel: 'email',
        subject: 'Te võitsite!',
        body: 'Uus sisu.',
        reason: 'pealkirja parandus',
      }),
    )

    expect(result.ok).toBe(true)
    const rows = templates()
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ version: 1, active: 0 })
    expect(rows[1]).toMatchObject({ version: 2, active: 1, body: 'Uus sisu.' })

    const audit = audits().at(-1)
    expect(audit?.action).toBe('notification.template_update')
    expect(JSON.parse(audit?.before ?? '{}')).toMatchObject({ version: 1, reason: 'pealkirja parandus' })
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({ version: 2, body: 'Uus sisu.' })
  })
})

describe('restoreNotificationTemplateAction', () => {
  it('copies an old version forward as a new active version', async () => {
    await saveNotificationTemplateAction(createForm())
    const v1 = must(templates()[0])
    await saveNotificationTemplateAction(
      form({
        id: v1.id,
        event: 'auction.won',
        channel: 'email',
        subject: 'v2',
        body: 'Versioon kaks.',
        reason: 'teksti uuendus',
      }),
    )

    const result = await restoreNotificationTemplateAction(v1.id, 'taastame eelmise teksti')

    expect(result.ok).toBe(true)
    const rows = templates()
    expect(rows).toHaveLength(3)
    expect(rows[2]).toMatchObject({ version: 3, active: 1, body: 'Oksjon {{auctionTitle}} on võidetud.' })
    expect(rows[1]).toMatchObject({ version: 2, active: 0 })

    const audit = audits().at(-1)
    expect(audit?.action).toBe('notification.template_restore')
    const after = JSON.parse(audit?.after ?? '{}') as { version: number; reason: string }
    expect(after).toMatchObject({ version: 3, reason: 'taastame eelmise teksti' })
  })

  it('refuses to restore the already-active version', async () => {
    await saveNotificationTemplateAction(createForm())
    const active = must(templates()[0])
    const result = await restoreNotificationTemplateAction(active.id, 'korrektne põhjendus')
    expect(result.ok).toBe(false)
  })
})

describe('deleteNotificationTemplateAction', () => {
  it('removes the whole version group and audits it', async () => {
    await saveNotificationTemplateAction(createForm())
    const v1 = must(templates()[0])
    await saveNotificationTemplateAction(
      form({ id: v1.id, event: 'auction.won', channel: 'email', subject: 's', body: 'b', reason: 'uuendus' }),
    )

    const result = await deleteNotificationTemplateAction(v1.id, 'mall pole enam vajalik')

    expect(result.ok).toBe(true)
    expect(templates()).toHaveLength(0)
    const audit = audits().at(-1)
    expect(audit?.action).toBe('notification.template_delete')
    expect(JSON.parse(audit?.before ?? '{}')).toMatchObject({
      event: 'auction.won',
      versionCount: 2,
      reason: 'mall pole enam vajalik',
    })
  })
})

describe('sendNotificationTestAction', () => {
  it('sends an email test to the operator with sample values filled in', async () => {
    await saveNotificationTemplateAction(createForm())
    const template = must(templates()[0])
    vi.mocked(sendEmail).mockResolvedValue({ success: true, transport: 'smtp', messageId: 'm1' })

    const result = await sendNotificationTestAction(template.id)

    expect(result).toMatchObject({ ok: true, recipient: 'admin@erametsad.ee' })
    const call = vi.mocked(sendEmail).mock.calls[0]?.[0]
    expect(call?.to).toBe('admin@erametsad.ee')
    expect(call?.subject).toBe('Te võitsite')
    expect(call?.html).toContain('Oksjon Raieõigus, Võru maakond on võidetud.')
    const audit = audits().at(-1)
    expect(audit?.action).toBe('notification.test_send')
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({
      channel: 'email',
      recipient: 'admin@erametsad.ee',
      ok: true,
    })
  })

  it('stubs the SMS test and records the attempt', async () => {
    await saveNotificationTemplateAction(
      form({ event: 'auction.won', channel: 'sms', body: 'SMS {{amount}}', reason: 'sms-i mall' }),
    )
    const template = must(templates()[0])
    const logSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const result = await sendNotificationTestAction(template.id)

    expect(result.ok).toBe(true)
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('SMS test stub'))
    const audit = audits().at(-1)
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({ channel: 'sms', ok: true })
    logSpy.mockRestore()
  })

  it('reports the transport failure with the reason', async () => {
    await saveNotificationTemplateAction(createForm())
    const template = must(templates()[0])
    vi.mocked(sendEmail).mockResolvedValue({
      success: false,
      transport: 'smtp',
      error: { code: 'E_SMTP', message: 'ühendus katkes' },
    })

    const result = await sendNotificationTestAction(template.id)

    expect(result.ok).toBe(false)
    expect(result.error).toBe('ühendus katkes')
  })
})

describe('listNotificationTemplatesAction', () => {
  it('returns the rows newest version first', async () => {
    await saveNotificationTemplateAction(createForm())
    const v1 = must(templates()[0])
    await saveNotificationTemplateAction(
      form({ id: v1.id, event: 'auction.won', channel: 'email', subject: 's', body: 'b', reason: 'uuendus' }),
    )

    const rows = await listNotificationTemplatesAction()

    expect(rows.map((row) => row.version)).toEqual([2, 1])
    expect(must(rows[0]).active).toBe(true)
  })
})
