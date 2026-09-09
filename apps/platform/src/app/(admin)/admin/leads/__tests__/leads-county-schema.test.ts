import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { createSqliteTestDb, type SqliteTestDb } from '@/lib/data/__tests__/sqlite'

/**
 * Task 8.1 schema addition on `leads` (change admin-spec-gap-fixes):
 * migration 0021 adds the nullable county_id column used by the Maakond
 * filter, kanban chip and table column.
 */

const NOW = '2026-01-01T00:00:00.000Z'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function insertLead(countyId: string | null, id = 'l1'): void {
  testDb.raw
    .prepare(
      `INSERT INTO leads (id, form_name, contact_name, consent_at, created_at, updated_at, county_id)
       VALUES (?, 'telefon', 'Mari Maasikas', ?, ?, ?, ?)`,
    )
    .run(id, NOW, NOW, NOW, countyId)
}

function leadRow(id = 'l1'): Record<string, unknown> {
  return testDb.raw
    .prepare(`SELECT county_id, cadastr FROM leads WHERE id = ?`)
    .get(id) as Record<string, unknown>
}

describe('leads county_id column (migration 0021)', () => {
  it('adds county_id as a nullable column', () => {
    insertLead(null)
    expect(leadRow()).toMatchObject({ county_id: null })
  })

  it('stores a county reference and keeps it on update', () => {
    insertLead('county-1')
    expect(leadRow()).toMatchObject({ county_id: 'county-1' })

    testDb.raw.prepare(`UPDATE leads SET county_id = 'county-2' WHERE id = 'l1'`).run()
    expect(leadRow()).toMatchObject({ county_id: 'county-2' })

    testDb.raw.prepare(`UPDATE leads SET county_id = NULL WHERE id = 'l1'`).run()
    expect(leadRow()).toMatchObject({ county_id: null })
  })

  it('maps the drizzle column so repository queries filter by county', () => {
    testDb.raw
      .prepare(
        `INSERT INTO counties (id, name, code, created_at, updated_at)
         VALUES ('county-1', 'Harju', 'HH', ?, ?)`,
      )
      .run(NOW, NOW)
    insertLead('county-1')
    insertLead(null, 'l2')

    const countyLeadIds = testDb.raw
      .prepare(`SELECT id FROM leads WHERE county_id = 'county-1'`)
      .all() as { id: string }[]
    expect(countyLeadIds).toEqual([{ id: 'l1' }])
    expect(leadRow()).toMatchObject({ cadastr: null })
  })
})
