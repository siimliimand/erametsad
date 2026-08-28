import type { NextResponse } from 'next/server'
import { beforeAll, describe, expect, it } from 'vitest'

import { signRefreshToken, verifyAccessToken } from '../jwt'
import {
  createSession,
  getUserSession,
  refreshSession,
  resolveAccessTokenSession,
  setSessionCookies,
} from '../session'

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

describe('session store', () => {
  beforeAll(() => {
    process.env.JWT_SECRET ??= 'test-jwt-secret'
  })

  it('rotates the refresh token and issues a new access token', async () => {
    const { accessToken, refreshToken, sessionId } = await createSession(
      'user-refresh-1',
      'user',
      'profile-1',
    )

    const rotated = await refreshSession(refreshToken)
    if (rotated === null) throw new Error('refreshSession returned null')

    expect(rotated.refreshToken).not.toBe(refreshToken)
    expect(
      verifyAccessToken(rotated.accessToken),
    ).toMatchObject({
      userId: 'user-refresh-1',
      role: 'user',
      activeProfileId: 'profile-1',
    })

    expect(await getUserSession(sessionId)).not.toBeNull()
    expect(resolveAccessTokenSession(accessToken)).toEqual({
      state: 'active',
      sessionId,
    })
    expect(resolveAccessTokenSession(rotated.accessToken)).toEqual({
      state: 'active',
      sessionId,
    })
  })

  it('kills the session family when a rotated token is reused', async () => {
    const { accessToken, refreshToken, sessionId } = await createSession(
      'user-refresh-2',
      'user',
    )
    const rotated = await refreshSession(refreshToken)
    if (rotated === null) throw new Error('refreshSession returned null')

    expect(await refreshSession(refreshToken)).toBeNull()

    expect(await getUserSession(sessionId)).toBeNull()
    expect(resolveAccessTokenSession(accessToken)).toEqual({ state: 'revoked' })
    expect(resolveAccessTokenSession(rotated.accessToken)).toEqual({
      state: 'revoked',
    })
    expect(await refreshSession(rotated.refreshToken)).toBeNull()
  })

  it('returns null for an unknown refresh token', async () => {
    expect(await refreshSession('not-a-jwt')).toBeNull()

    const orphan = signRefreshToken({
      sessionId: 'no-such-session',
      jti: 'orphan',
    })
    expect(await refreshSession(orphan)).toBeNull()
  })
})

describe('session cookies', () => {
  beforeAll(() => {
    process.env.JWT_SECRET ??= 'test-jwt-secret'
  })

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
