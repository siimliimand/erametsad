import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RESET_TOKEN_TTL_MS,
  consumeResetToken,
  createResetToken,
} from '../reset-tokens'

import {
  createSqliteTestDb,
  type SqliteTestDb,
} from '@/lib/data/__tests__/sqlite'


describe('reset tokens', () => {
  let testDb: SqliteTestDb

  function seedUser(id: string): void {
    const now = new Date().toISOString()
    testDb.raw
      .prepare(
        'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
      )
      .run(id, `${id}@example.com`, now, now)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    testDb = createSqliteTestDb()
  })

  afterEach(() => {
    testDb.close()
    vi.useRealTimers()
  })

  it('consumes a valid token once and returns the user id', async () => {
    seedUser('user-1')
    const token = await createResetToken('user-1', testDb.database)

    expect(await consumeResetToken(token, testDb.database)).toBe('user-1')
    expect(await consumeResetToken(token, testDb.database)).toBeNull()
  })

  it('rejects an unknown token', async () => {
    expect(await consumeResetToken('does-not-exist', testDb.database)).toBeNull()
  })

  it('rejects an expired token', async () => {
    seedUser('user-1')
    const token = await createResetToken('user-1', testDb.database)

    vi.setSystemTime(Date.now() + RESET_TOKEN_TTL_MS + 1)

    expect(await consumeResetToken(token, testDb.database)).toBeNull()
  })

  it('rejects a reused token even after the password was set', async () => {
    seedUser('user-2')
    const token = await createResetToken('user-2', testDb.database)

    expect(await consumeResetToken(token, testDb.database)).toBe('user-2')
    vi.setSystemTime(Date.now() + 1000)
    expect(await consumeResetToken(token, testDb.database)).toBeNull()
  })
})
