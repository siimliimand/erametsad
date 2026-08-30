import type { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DbDatabase, DbPreparedStatement, DbResult, SqlParam } from '../../db'
import { setD1ForTests } from '../../db'
import { signRefreshToken, verifyAccessToken } from '../jwt'
import type { SessionRow } from '../session'
import {
  createSession,
  findSessionByAccessToken,
  getUserSession,
  issueSessionAccessToken,
  listUserSessions,
  purgeExpiredSessions,
  refreshSession,
  resolveAccessTokenSession,
  revokeSession,
  revokeUserSessions,
  setSessionCookies,
  updateUserProfileId,
} from '../session'

process.env.JWT_SECRET ??= 'test-jwt-secret'

function sha256(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * D1-compatible stub over an in-memory sessions table, following the
 * fake-d1.ts pattern from the bidding suites: dispatches on normalized
 * SQL shape, maintains `store` rows, and reports meta.changes for
 * mutations. Tests that simulate an isolate restart keep the store and
 * build a second fake over it.
 */
function fakeSessionsD1(store: SessionRow[]): DbDatabase {
  function normalize(sql: string): string {
    return sql.replace(/\s+/g, ' ').trim()
  }

  function run(sql: string, params: unknown[]): DbResult {
    const s = normalize(sql)
    const changes = (n: number): DbResult => ({ results: [], success: true, meta: { changes: n } })

    if (s.startsWith('INSERT INTO sessions')) {
      const [id, userId, role, profileId, tokenFamily, atHash, rtHash, expiresAt, createdAt, updatedAt] =
        params as [string, string, string, string | null, string, string, string, string, string, string]
      store.push({
        id,
        user_id: userId,
        role,
        profile_id: profileId,
        token_family: tokenFamily,
        access_token_hash: atHash,
        refresh_token_hash: rtHash,
        expires_at: expiresAt,
        revoked_at: null,
        created_at: createdAt,
        updated_at: updatedAt,
      })
      return changes(1)
    }

    if (s.includes('FROM sessions WHERE access_token_hash = ?')) {
      const rows = store
        .filter((row) => row.access_token_hash === params[0])
        .map((row) => ({ ...row }))
      return { results: rows, success: true, meta: {} }
    }

    if (s.startsWith('SELECT id, created_at FROM sessions')) {
      const rows = store
        .filter(
          (row) =>
            row.user_id === params[0] &&
            row.revoked_at === null &&
            row.expires_at > (params[1] as string),
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((row) => ({ id: row.id, created_at: row.created_at }))
      return { results: rows, success: true, meta: {} }
    }

    if (s.includes('FROM sessions WHERE id = ?')) {
      const rows = store.filter((row) => row.id === params[0]).map((row) => ({ ...row }))
      return { results: rows, success: true, meta: {} }
    }

    if (s.startsWith('UPDATE sessions SET refresh_token_hash')) {
      const [newRtHash, newAtHash, expiresAt, updatedAt, id, oldRtHash] = params as [
        string,
        string,
        string,
        string,
        string,
        string,
      ]
      const row = store.find(
        (candidate) =>
          candidate.id === id &&
          candidate.refresh_token_hash === oldRtHash &&
          candidate.revoked_at === null,
      )
      if (!row) return changes(0)
      row.refresh_token_hash = newRtHash
      row.access_token_hash = newAtHash
      row.expires_at = expiresAt
      row.updated_at = updatedAt
      return changes(1)
    }

    if (s.startsWith('UPDATE sessions SET revoked_at')) {
      const [revokedAt, updatedAt] = params as [string, string]
      const targets = store.filter(
        (row) =>
          row.revoked_at === null &&
          (s.includes('WHERE user_id = ?') ? row.user_id === params[2] : row.id === params[2]),
      )
      for (const row of targets) {
        row.revoked_at = revokedAt
        row.updated_at = updatedAt
      }
      return changes(targets.length)
    }

    if (s.startsWith('UPDATE sessions SET profile_id')) {
      const [profileId, updatedAt] = params as [string, string]
      const targets = store.filter(
        (row) => row.revoked_at === null && row.user_id === params[2],
      )
      for (const row of targets) {
        row.profile_id = profileId
        row.updated_at = updatedAt
      }
      return changes(targets.length)
    }

    if (s.startsWith('UPDATE sessions SET access_token_hash')) {
      const [atHash, updatedAt, id] = params as [string, string, string]
      const row = store.find((candidate) => candidate.id === id)
      if (!row) return changes(0)
      row.access_token_hash = atHash
      row.updated_at = updatedAt
      return changes(1)
    }

    if (s.startsWith('DELETE FROM sessions')) {
      const cutoff = params[0] as string
      const survivors = store.filter((row) => row.expires_at > cutoff)
      const removed = store.length - survivors.length
      store.length = 0
      store.push(...survivors)
      return changes(removed)
    }

    throw new Error(`fake sessions D1: unhandled statement: ${s}`)
  }

  return {
    prepare(sql: string) {
      let params: SqlParam[] = []
      const statement: DbPreparedStatement = {
        bind(...values: SqlParam[]) {
          params = values
          return statement
        },
        all<T>(): Promise<DbResult<T>> {
          return Promise.resolve(run(sql, params) as DbResult<T>)
        },
      }
      return statement
    },
    batch<T>(prepared: DbPreparedStatement[]): Promise<DbResult<T>[]> {
      return Promise.all(prepared.map((statement) => statement.all<T>()))
    },
  }
}

let store: SessionRow[]

beforeEach(() => {
  store = []
  setD1ForTests(fakeSessionsD1(store))
})

afterEach(() => {
  setD1ForTests(null)
})

describe('session store', () => {
  it('creates a session row findable by its access-token hash', async () => {
    const { accessToken, refreshToken, sessionId } = await createSession(
      'user-create-1',
      'private',
      'profile-1',
    )

    expect(store).toHaveLength(1)
    expect(store[0]).toMatchObject({ id: sessionId, user_id: 'user-create-1' })

    const row = await findSessionByAccessToken(sha256(accessToken))
    expect(row?.refresh_token_hash).toBe(sha256(refreshToken))
    expect(row?.revoked_at).toBeNull()

    expect(await resolveAccessTokenSession(accessToken)).toEqual({
      state: 'active',
      sessionId,
    })
    expect(verifyAccessToken(accessToken)).toMatchObject({ sessionId })
  })

  it('rotates the refresh token and rebinds the access-token hash', async () => {
    const { refreshToken, sessionId } = await createSession('user-refresh-1', 'private')

    const rotated = await refreshSession(refreshToken)
    if (rotated === null) throw new Error('refreshSession returned null')

    expect(rotated.refreshToken).not.toBe(refreshToken)
    expect(verifyAccessToken(rotated.accessToken)).toMatchObject({
      userId: 'user-refresh-1',
      role: 'private',
      sessionId,
    })

    const row = await findSessionByAccessToken(sha256(rotated.accessToken))
    expect(row?.refresh_token_hash).toBe(sha256(rotated.refreshToken))
    expect(await resolveAccessTokenSession(rotated.accessToken)).toEqual({
      state: 'active',
      sessionId,
    })
  })

  it('treats an access token whose hash was superseded as unknown', async () => {
    const { accessToken } = await createSession('user-superseded', 'private')
    const row = store[0]
    if (!row) throw new Error('session row missing')

    // The row tracks only the newest access-token hash; a superseded token
    // stops resolving and dies with its 5-minute JWT exp instead.
    row.access_token_hash = sha256('a-newer-access-token')

    expect(await resolveAccessTokenSession(accessToken)).toEqual({ state: 'unknown' })
  })

  it('kills the session family when a rotated token is reused', async () => {
    const { refreshToken, sessionId } = await createSession('user-refresh-2', 'private')
    const rotated = await refreshSession(refreshToken)
    if (rotated === null) throw new Error('refreshSession returned null')

    expect(await refreshSession(refreshToken)).toBeNull()

    expect(await getUserSession(sessionId)).toBeNull()
    expect(await resolveAccessTokenSession(rotated.accessToken)).toEqual({ state: 'revoked' })
    expect(await refreshSession(rotated.refreshToken)).toBeNull()
  })

  it('returns null for unknown refresh tokens', async () => {
    expect(await refreshSession('not-a-jwt')).toBeNull()

    const orphan = signRefreshToken({ sessionId: 'no-such-session', jti: 'orphan' })
    expect(await refreshSession(orphan)).toBeNull()
  })

  it('rejects refresh once the session row has expired', async () => {
    const { refreshToken } = await createSession('user-expired', 'private')
    const row = store[0]
    if (!row) throw new Error('session row missing')
    row.expires_at = new Date(Date.now() - 1000).toISOString()

    expect(await refreshSession(refreshToken)).toBeNull()
  })

  it('revokes a single session by id', async () => {
    const { sessionId, accessToken } = await createSession('user-revoke-1', 'private')

    await revokeSession(sessionId)

    expect(await getUserSession(sessionId)).toBeNull()
    expect(store[0]?.revoked_at).not.toBeNull()
    expect(await resolveAccessTokenSession(accessToken)).toEqual({ state: 'revoked' })
  })

  it('revokes every session of a user and leaves other users intact', async () => {
    const mine = await createSession('user-revoke-all', 'private')
    const other = await createSession('user-other', 'private')

    await revokeUserSessions('user-revoke-all')

    expect(await getUserSession(mine.sessionId)).toBeNull()
    expect(await getUserSession(other.sessionId)).not.toBeNull()
  })

  it('purges only expired rows', async () => {
    const live = await createSession('user-live', 'private')
    const stale = await createSession('user-stale', 'private')
    const row = store.find((candidate) => candidate.id === stale.sessionId)
    if (!row) throw new Error('session row missing')
    row.expires_at = new Date(Date.now() - 1000).toISOString()

    expect(await purgeExpiredSessions()).toBe(1)

    expect(await getUserSession(live.sessionId)).not.toBeNull()
    expect(await getUserSession(stale.sessionId)).toBeNull()
    expect(await purgeExpiredSessions()).toBe(0)
  })

  it('updates the profile id on live sessions', async () => {
    await createSession('user-profile', 'private')
    await createSession('user-profile', 'private')

    expect(await updateUserProfileId('user-profile', 'profile-9')).toBe(true)
    expect(await getUserSession(store[0]?.id ?? '')).toMatchObject({ profileId: 'profile-9' })
    expect(await updateUserProfileId('user-without-sessions', 'profile-9')).toBe(false)
  })

  it('issues an access token that resolves to the session', async () => {
    const { sessionId } = await createSession('user-issue', 'private')

    const token = await issueSessionAccessToken(sessionId)
    if (token === null) throw new Error('issueSessionAccessToken returned null')
    expect(await resolveAccessTokenSession(token)).toEqual({ state: 'active', sessionId })

    await revokeSession(sessionId)
    expect(await issueSessionAccessToken(sessionId)).toBeNull()
  })

  it('lists live sessions and marks the current one', async () => {
    const first = await createSession('user-list', 'private')
    const second = await createSession('user-list', 'private')
    await createSession('user-list-2', 'private')
    await revokeSession(second.sessionId)

    const sessions = await listUserSessions('user-list', first.sessionId)

    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.sessionId).toBe(first.sessionId)
    expect(sessions[0]?.current).toBe(true)
    expect(sessions[0]?.createdAt).toBeInstanceOf(Date)
  })

  it('survives an isolate restart (fresh module instance, same D1)', async () => {
    const first = await createSession('user-restart', 'private')
    const rotated = await refreshSession(first.refreshToken)
    if (rotated === null) throw new Error('refreshSession returned null')

    vi.resetModules()
    const { setD1ForTests: setD1Fresh } = await import('../../db')
    setD1Fresh(fakeSessionsD1(store))
    const fresh = await import('../session')

    const record = await fresh.getUserSession(first.sessionId)
    expect(record).toMatchObject({ userId: 'user-restart' })

    const again = await fresh.refreshSession(rotated.refreshToken)
    if (again === null) throw new Error('rotation after restart returned null')
    expect(await fresh.resolveAccessTokenSession(again.accessToken)).toEqual({
      state: 'active',
      sessionId: first.sessionId,
    })
  })
})

interface CookieCall {
  name: string
  value: string
  options: Record<string, unknown>
}

function cookieStub(): { calls: CookieCall[]; response: NextResponse } {
  const calls: CookieCall[] = []
  const response = {
    cookies: {
      set(name: string, value: string, options: Record<string, unknown>) {
        calls.push({ name, value, options })
      },
    },
  } as unknown as NextResponse
  return { calls, response }
}

describe('session cookies', () => {
  it('scopes the refresh cookie to the /api/v1/auth path', () => {
    const { calls, response } = cookieStub()

    setSessionCookies(response, 'access-value', 'refresh-value')

    const access = calls.find((call) => call.name === 'access_token')
    const refresh = calls.find((call) => call.name === 'refresh_token')

    expect(access?.options.path).toBe('/')
    expect(refresh?.options.path).toBe('/api/v1/auth')
    expect(refresh?.options.httpOnly).toBe(true)
    expect(refresh?.options.maxAge).toBe(7 * 24 * 60 * 60)
  })
})
