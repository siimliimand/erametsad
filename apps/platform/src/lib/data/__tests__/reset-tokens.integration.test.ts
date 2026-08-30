import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RESET_TOKEN_TTL_MS,
  consumeResetToken,
  createResetToken,
} from '../../auth/reset-tokens'
import { createSqliteTestDb, type SqliteTestDb } from './sqlite'

let testDb: SqliteTestDb

beforeEach(() => {
  testDb = createSqliteTestDb()
})

afterEach(() => {
  testDb.close()
})

function seedUser(id: string): void {
  const now = new Date().toISOString()
  testDb.raw
    .prepare(
      'INSERT INTO users (id, email, created_at, updated_at) VALUES (?, ?, ?, ?)',
    )
    .run(id, `${id}@example.com`, now, now)
}

function storedRows(): { user_id: string; token_hash: string; expires_at: string; used_at: string | null }[] {
  return testDb.raw
    .prepare(
      'SELECT user_id, token_hash, expires_at, used_at FROM password_reset_tokens',
    )
    .all() as {
    user_id: string
    token_hash: string
    expires_at: string
    used_at: string | null
  }[]
}

describe('password reset token store against SQLite', () => {
  it('inserts on forgot, consumes once, then rejects the replay', async () => {
    seedUser('user-1')
    const token = await createResetToken('user-1', testDb.database)

    const rows = storedRows()
    expect(rows).toHaveLength(1)
    expect(rows[0]?.user_id).toBe('user-1')
    // Only the hash is stored; the raw token exists in the emailed link alone.
    expect(rows[0]?.token_hash).not.toBe(token)
    expect(rows[0]?.token_hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(rows[0]?.used_at).toBeNull()

    expect(await consumeResetToken(token, testDb.database)).toBe('user-1')
    expect(storedRows()[0]?.used_at).not.toBeNull()
    expect(await consumeResetToken(token, testDb.database)).toBeNull()
  })

  it('rejects an expired token without marking it used', async () => {
    vi.useFakeTimers()
    try {
      seedUser('user-2')
      const token = await createResetToken('user-2', testDb.database)

      vi.setSystemTime(Date.now() + RESET_TOKEN_TTL_MS + 1)

      expect(await consumeResetToken(token, testDb.database)).toBeNull()
      expect(storedRows()[0]?.used_at).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
