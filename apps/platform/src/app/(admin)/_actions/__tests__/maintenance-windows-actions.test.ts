import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  deleteMaintenanceWindowAction,
  listMaintenanceWindowsAction,
  saveMaintenanceWindowAction,
} from '../settings'

import { createSqliteTestDb, sqliteBatchRunner, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'
import { createCoreRepositories, nodeIsikukoodCodec } from '@/lib/data/repositories'
import { setD1ForTests } from '@/lib/db'

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
  // better-sqlite3 enforces FKs: created_by references users.id.
  testDb.raw
    .prepare(
      `INSERT INTO users (id, email, role, created_at, updated_at)
       VALUES ('admin-1', 'admin@erametsad.ee', 'superadmin', ?, ?)`,
    )
    .run(NOW, NOW)
})

afterEach(() => {
  setD1ForTests(null)
  testDb.close()
})

function seedAuction(overrides: {
  id: string
  endsAt: string
  status?: string
  title?: string
}): void {
  testDb.raw
    .prepare(
      `INSERT INTO auctions (id, title, slug, status, object_type, min_bid_cents, ends_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'raieoigus', 1000, ?, ?, ?)`,
    )
    .run(
      overrides.id,
      overrides.title ?? 'Raieõigus Võrus',
      `slug-${overrides.id}`,
      overrides.status ?? 'active',
      overrides.endsAt,
      NOW,
      NOW,
    )
}

const baseInput = {
  startsAt: '2026-10-01T08:00:00.000Z',
  endsAt: '2026-10-01T12:00:00.000Z',
  scope: 'portal',
  note: 'plaanihooldus',
  reason: 'serverite plaaniline hooldus',
  force: false,
}

function windows(): { id: string; starts_at: string }[] {
  return testDb.raw
    .prepare(`SELECT id, starts_at FROM maintenance_windows`)
    .all() as { id: string; starts_at: string }[]
}

/** narrows the indexed row for strict TS without non-null assertions */
function must<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('expected a row')
  return value
}

function audits(): { action: string; after: string; before: string | null }[] {
  return testDb.raw
    .prepare(`SELECT action, before, after FROM audit_entries ORDER BY created_at, id`)
    .all() as { action: string; after: string; before: string | null }[]
}

describe('saveMaintenanceWindowAction', () => {
  it('saves a conflict-free window and audits it', async () => {
    const result = await saveMaintenanceWindowAction(baseInput)

    expect(result.ok).toBe(true)
    expect(windows()).toHaveLength(1)
    const audit = audits().at(-1)
    expect(audit?.action).toBe('maintenance.window_create')
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({
      scope: 'portal',
      reason: 'serverite plaaniline hooldus',
      conflictCount: 0,
      forced: false,
    })
  })

  it('blocks a window containing an auction end and lists the conflicts', async () => {
    seedAuction({ id: 'a1', endsAt: '2026-10-01T10:00:00.000Z' })

    const result = await saveMaintenanceWindowAction(baseInput)

    expect(result).toMatchObject({ ok: false, conflict: true })
    if (!('conflict' in result)) return
    expect(result.conflicts).toEqual([
      { id: 'a1', title: 'Raieõigus Võrus', status: 'active', endsAt: '2026-10-01T10:00:00.000Z' },
    ])
    expect(windows()).toHaveLength(0)
    expect(audits()).toHaveLength(0)
  })

  it('ignores auctions that end inside the window with a non-live status', async () => {
    seedAuction({ id: 'a1', endsAt: '2026-10-01T10:00:00.000Z', status: 'ended' })

    const result = await saveMaintenanceWindowAction(baseInput)

    expect(result.ok).toBe(true)
    expect(windows()).toHaveLength(1)
  })

  it('saves a forced window only after the force flag and audits it as forced', async () => {
    seedAuction({ id: 'a1', endsAt: '2026-10-01T10:00:00.000Z' })

    const blocked = await saveMaintenanceWindowAction(baseInput)
    expect(blocked.ok).toBe(false)

    const result = await saveMaintenanceWindowAction({ ...baseInput, force: true })

    expect(result.ok).toBe(true)
    expect(windows()).toHaveLength(1)
    const audit = audits().at(-1)
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({ conflictCount: 1, forced: true })
  })

  it('rejects a window that ends before it starts', async () => {
    const result = await saveMaintenanceWindowAction({ ...baseInput, endsAt: baseInput.startsAt })
    expect(result).toMatchObject({
      ok: false,
      error: 'Akna lõpp peab olema pärast algust.',
    })
    expect(windows()).toHaveLength(0)
  })

  it('rejects a save without a valid reason', async () => {
    const result = await saveMaintenanceWindowAction({ ...baseInput, reason: 'ei' })
    expect(result).toMatchObject({
      ok: false,
      error: 'Põhjendus peab olema vähemalt 5 tähemärki.',
    })
    expect(windows()).toHaveLength(0)
  })

  it('falls back to the portal scope for an unknown value', async () => {
    await saveMaintenanceWindowAction({ ...baseInput, scope: 'mingi' })
    const row = testDb.raw
      .prepare(`SELECT scope FROM maintenance_windows`)
      .get() as { scope: string }
    expect(row.scope).toBe('portal')
  })
})

describe('deleteMaintenanceWindowAction', () => {
  it('removes the window and writes the audit entry', async () => {
    await saveMaintenanceWindowAction(baseInput)
    const row = must(windows()[0])

    const result = await deleteMaintenanceWindowAction(row.id, 'aken ei ole enam vajalik')

    expect(result.ok).toBe(true)
    expect(windows()).toHaveLength(0)
    const audit = audits().at(-1)
    expect(audit?.action).toBe('maintenance.window_delete')
    expect(JSON.parse(audit?.after ?? '{}')).toMatchObject({
      deleted: true,
      reason: 'aken ei ole enam vajalik',
    })
  })

  it('reports a missing window', async () => {
    const result = await deleteMaintenanceWindowAction('nope', 'korrektne põhjendus')
    expect(result).toMatchObject({ ok: false, error: 'Akna ei leitud.' })
  })
})

describe('listMaintenanceWindowsAction', () => {
  it('returns the saved windows ordered by start time', async () => {
    await saveMaintenanceWindowAction({ ...baseInput, startsAt: '2026-11-01T08:00:00.000Z', endsAt: '2026-11-01T09:00:00.000Z' })
    await saveMaintenanceWindowAction(baseInput)

    const rows = await listMaintenanceWindowsAction()

    expect(rows.map((row) => row.startsAt)).toEqual([
      '2026-10-01T08:00:00.000Z',
      '2026-11-01T08:00:00.000Z',
    ])
    expect(rows[0]).toMatchObject({ scope: 'portal', note: 'plaanihooldus', createdBy: 'admin-1' })
  })
})
