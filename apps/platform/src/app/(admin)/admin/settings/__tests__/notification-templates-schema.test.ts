import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 4.3 schema (change admin-spec-gap-fixes): migration 0023 creates
 * notification_templates with a channel CHECK (email/sms), version >= 1,
 * and one active version per (event, channel) group.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertTemplate(overrides: Record<string, string | number | null> = {}): void {
  const values = {
    id: 't1',
    event: 'auction.won',
    channel: 'email',
    subject: 'Te võitsite',
    body: 'Palju õnne!',
    version: 1,
    active: 1,
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  }
  testDb.raw
    .prepare(
      `INSERT INTO notification_templates
        (id, event, channel, subject, body, version, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      values.id,
      values.event,
      values.channel,
      values.subject,
      values.body,
      values.version,
      values.active,
      values.created_at,
      values.updated_at,
    )
}

describe('notification_templates (migration 0023)', () => {
  it.each(['email', 'sms'])('accepts the %s channel', (channel) => {
    expect(() => {
      insertTemplate({ channel })
    }).not.toThrow()
  })

  it('rejects an unknown channel', () => {
    expect(() => {
      insertTemplate({ channel: 'in_app' })
    }).toThrow()
  })

  it('rejects a version below 1', () => {
    expect(() => {
      insertTemplate({ version: 0 })
    }).toThrow()
  })

  it('defaults the version to 1', () => {
    testDb.raw
      .prepare(
        `INSERT INTO notification_templates (id, event, channel, body, created_at, updated_at)
         VALUES ('t1', 'auction.won', 'email', 'tere', ?, ?)`,
      )
      .run(NOW, NOW)
    const row = testDb.raw
      .prepare(`SELECT version FROM notification_templates WHERE id = 't1'`)
      .get() as { version: number }
    expect(row.version).toBe(1)
  })

  it('keeps exactly one active version per event and channel', () => {
    insertTemplate({ id: 't1', version: 1, active: 1 })
    expect(() => {
      insertTemplate({ id: 't2', version: 2, active: 1 })
    }).toThrow()

    testDb.raw
      .prepare(`UPDATE notification_templates SET active = 0 WHERE id = 't1'`)
      .run()
    expect(() => {
      insertTemplate({ id: 't2', version: 2, active: 1 })
    }).not.toThrow()
  })

  it('allows the same event active on both channels', () => {
    expect(() => {
      insertTemplate({ id: 't1', channel: 'email', active: 1 })
    }).not.toThrow()
    expect(() => {
      insertTemplate({ id: 't2', channel: 'sms', subject: null, active: 1 })
    }).not.toThrow()
  })
})
