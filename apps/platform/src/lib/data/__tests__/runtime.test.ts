import { getTableColumns } from 'drizzle-orm'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { signAccessToken, type AccessTokenPayload } from '../../auth/jwt'
import { setD1ForTests, type DbDatabase, type DbPreparedStatement } from '../../db'
import { publicContext, systemContext, userContext } from '../guards'
import { GuardAccessError } from '../repositories'
import { getRepositories, sessionGuardContext } from '../runtime'
import { autobidders, users } from '../schema'

process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'runtime-test-secret'

interface Recorded {
  sql: string
  params: unknown[]
}

// Scripted rows keyed by table name; the fake maps them onto the column
// order drizzle selected, which is the schema property order.
const columnOrder: Record<string, string[]> = {
  users: Object.keys(getTableColumns(users)),
  autobidders: Object.keys(getTableColumns(autobidders)),
}

function toRawRow(table: string, row: Record<string, unknown>): unknown[] {
  return (columnOrder[table] ?? []).map((field) => row[field] ?? null)
}

/**
 * D1-compatible stub for the drizzle d1 driver: records every statement
 * and answers typed selects (which drizzle executes through
 * `.raw()` with positional rows) from the scripted tables. Injected via
 * the shared setD1ForTests seam, so the runtime helper and the raw
 * executor in src/lib/db.ts see the same database in tests.
 */
function fakeD1(rowsByTable: Record<string, Record<string, unknown>[]>, log: Recorded[]): DbDatabase {
  const statement = (sql: string, params: unknown[]): DbPreparedStatement => {
    const table = Object.keys(rowsByTable).find((name) => sql.includes(`from "${name}"`))
    const rows = (table !== undefined ? rowsByTable[table] : undefined) ?? []
    const bound: DbPreparedStatement = {
      bind(...values: unknown[]) {
        return statement(sql, values)
      },
      all() {
        log.push({ sql, params })
        return Promise.resolve({ results: rows, success: true, meta: {} })
      },
      // drizzle routes typed selects through raw() with positional rows.
      raw() {
        log.push({ sql, params })
        return Promise.resolve(rows.map((row) => toRawRow(table ?? '', row)))
      },
      run: vi.fn(() => Promise.resolve({ results: [], success: true, meta: {} })) as never,
      first: vi.fn(() => Promise.resolve(null)) as never,
    } as unknown as DbPreparedStatement
    return bound
  }
  return {
    prepare(sql: string) {
      return statement(sql, [])
    },
    batch(prepared: DbPreparedStatement[]) {
      return Promise.all(prepared.map((stmt) => stmt.all()))
    },
  } as DbDatabase
}

const userRow = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Test User',
  role: 'private',
  status: 'active',
  authMethod: 'password',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

let log: Recorded[]

beforeEach(() => {
  log = []
  setD1ForTests(fakeD1({ users: [userRow] }, log))
})

afterEach(() => {
  setD1ForTests(null)
})

describe('getRepositories', () => {
  it('runs repository queries against the D1 test seam', async () => {
    const repos = await getRepositories()

    const result = await repos.find({
      collection: 'users',
      where: { email: { equals: 'user@example.com' } },
      limit: 1,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]?.id).toBe('user-1')
    expect(result.docs[0]?.email).toBe('user@example.com')
    expect(log).toHaveLength(1)
    expect(log[0]?.sql).toContain('from "users"')
    expect(log[0]?.params).toContain('user@example.com')
  })

  it('runs unguarded by default (trusted system caller)', async () => {
    const repos = await getRepositories()

    // users.read is admin-only in the guard matrix; the system caller
    // must read without a GuardAccessError.
    await expect(
      repos.find({ collection: 'users', limit: 1 }),
    ).resolves.toBeDefined()
  })

  it('enforces the guard matrix when a guard context is passed', async () => {
    const repos = await getRepositories(publicContext)

    await expect(
      repos.find({ collection: 'users', limit: 1 }),
    ).rejects.toBeInstanceOf(GuardAccessError)
    // The guard rejects before any statement reaches D1.
    expect(log).toHaveLength(0)
  })

  it('honors the system context explicitly', async () => {
    const repos = await getRepositories(systemContext)

    await expect(
      repos.find({ collection: 'users', limit: 1 }),
    ).resolves.toBeDefined()
  })

  it('applies the user-context row filter for own-record collections', async () => {
    const repos = await getRepositories(userContext('user-1', 'private'))

    // autobidders.read filters rows to the caller, so the guard where
    // clause must appear in the executed statement.
    const result = await repos.find({ collection: 'autobidders', limit: 10 })

    expect(result.docs).toEqual([])
    expect(log[0]?.sql).toContain('"user_id"')
    expect(log[0]?.params).toContain('user-1')
  })
})

describe('sessionGuardContext', () => {
  it('maps a verified access token to a user context', () => {
    const token: AccessTokenPayload = { userId: 'user-7', role: 'admin' }

    expect(sessionGuardContext(token)).toEqual({
      kind: 'user',
      user: { id: 'user-7', role: 'admin' },
    })
  })

  it('maps an unknown role to guest instead of throwing', () => {
    const token = signAccessToken({ userId: 'user-8', role: 'not-a-role' })

    expect(token).toBeTruthy()
    expect(sessionGuardContext({ userId: 'user-8', role: 'not-a-role' })).toEqual({
      kind: 'user',
      user: { id: 'user-8', role: 'guest' },
    })
  })

  it('maps a missing token to the public context', () => {
    expect(sessionGuardContext(null)).toEqual({ kind: 'public' })
  })
})
