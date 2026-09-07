import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  createCoreRepositories,
  nodeIsikukoodCodec,
  type CoreRepositories,
} from '../repositories'
import { createSqliteTestDb, type SqliteTestDb } from './sqlite'

process.env.ISIKUKOOD_ENCRYPTION_KEY =
  process.env.ISIKUKOOD_ENCRYPTION_KEY ?? 'integration-test-key'

let testDb: SqliteTestDb
let repos: CoreRepositories

beforeEach(() => {
  testDb = createSqliteTestDb()
  repos = createCoreRepositories(testDb.database, {
    isikukoodCodec: nodeIsikukoodCodec,
  })
})

afterEach(() => {
  testDb.close()
})

describe('audit hash chain', () => {
  it('leaves prevHash null on the genesis entry and chains the next entry to it', async () => {
    const first = await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'auction_publish',
        entityType: 'auction',
        entityId: 'a1',
        after: { s: 1 },
      },
    })
    expect(first.prevHash).toBeNull()
    expect(first.hash).toMatch(/^[0-9a-f]{64}$/)

    const second = await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'auction_end',
        entityType: 'auction',
        entityId: 'a1',
        after: { s: 2 },
      },
    })
    expect(second.prevHash).toBe(first.hash)
    expect(second.hash).toMatch(/^[0-9a-f]{64}$/)
    expect(second.hash).not.toBe(first.hash)
  })

  it('stores hashes that recompute from the canonical serialization of the stored rows', async () => {
    const first = await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'bid_admit',
        entityType: 'bid',
        entityId: 'b1',
        before: { a: 1 },
        after: { a: 2 },
      },
    })
    const second = await repos.create({
      collection: 'audit-entry',
      data: {
        action: 'bid_admit',
        entityType: 'bid',
        entityId: 'b2',
        after: null,
      },
    })

    const rows = testDb.raw
      .prepare('SELECT * FROM audit_entries ORDER BY rowid')
      .all() as Record<string, unknown>[]
    expect(rows).toHaveLength(2)
    const [firstRow, secondRow] = rows as [
      Record<string, unknown>,
      Record<string, unknown>,
    ]

    for (const [row, expected] of [
      [firstRow, first.hash],
      [secondRow, second.hash],
    ] as const) {
      const canonical = JSON.stringify([
        row.id,
        row.actor_id,
        row.action,
        row.entity_type,
        row.entity_id,
        row.before,
        row.after,
        row.created_at,
        row.updated_at,
        row.prev_hash,
      ])
      const digest = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(canonical),
      )
      const hex = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
      expect(hex).toBe(expected)
    }
  })
})

describe('page blocks and versions via the registry', () => {
  it('round-trips a page block with its config JSON', async () => {
    const page = await repos.create({
      collection: 'pages',
      data: { title: 'Avaleht', slug: 'avaleht' },
    })
    const block = await repos.create({
      collection: 'page-blocks',
      data: {
        pageId: page.id,
        type: 'hero',
        ordinal: 0,
        configJson: { heading: 'Tere', theme: 'dark' },
      },
    })
    expect(block.configJson).toEqual({ heading: 'Tere', theme: 'dark' })

    const found = await repos.findByID({
      collection: 'page-blocks',
      id: block.id,
    })
    expect(found?.configJson).toEqual({ heading: 'Tere', theme: 'dark' })
  })

  it('round-trips a page version snapshot', async () => {
    const page = await repos.create({
      collection: 'pages',
      data: { title: 'Info', slug: 'info' },
    })
    const version = await repos.create({
      collection: 'page-versions',
      data: {
        pageId: page.id,
        version: 1,
        label: 'Enne kampaaniat',
        snapshotJson: [{ type: 'hero', config: { heading: 'Tere' } }],
      },
    })
    expect(version.snapshotJson).toEqual([
      { type: 'hero', config: { heading: 'Tere' } },
    ])
    expect(version.createdAt).toBe(version.updatedAt)
  })
})
