import type { NextResponse } from 'next/server'
import crypto from 'node:crypto'

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt'

interface SessionRecord {
  userId: string
  role: string
  profileId: string | undefined
  tokenFamily: string
  active: boolean
  refreshTokenHash: string
  createdAt: Date
}

const sessions = new Map<string, SessionRecord>()
const accessTokenSessions = new Map<string, Set<string>>()

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function indexAccessToken(sessionId: string, accessToken: string): void {
  const key = hashToken(accessToken)
  const owners = accessTokenSessions.get(key) ?? new Set<string>()
  owners.add(sessionId)
  accessTokenSessions.set(key, owners)
}

export async function createSession(
  userId: string,
  role: string,
  profileId?: string,
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  await Promise.resolve()
  const sessionId = crypto.randomUUID()
  const tokenFamily = crypto.randomUUID()

  const accessToken = signAccessToken({ userId, role, activeProfileId: profileId })
  const refreshToken = signRefreshToken({
    sessionId,
    jti: crypto.randomUUID(),
  })
  indexAccessToken(sessionId, accessToken)

  sessions.set(sessionId, {
    userId,
    role,
    profileId,
    tokenFamily,
    active: true,
    refreshTokenHash: hashToken(refreshToken),
    createdAt: new Date(),
  })

  return { accessToken, refreshToken, sessionId }
}

export async function refreshSession(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  await Promise.resolve()
  const payload = verifyRefreshToken(refreshToken)
  if (!payload) return null

  const record = sessions.get(payload.sessionId)
  if (!record?.active) return null

  const incomingHash = hashToken(refreshToken)

  if (record.refreshTokenHash !== incomingHash) {
    sessions.delete(payload.sessionId)
    return null
  }

  const newRefreshToken = signRefreshToken({
    sessionId: payload.sessionId,
    jti: crypto.randomUUID(),
  })
  const newAccessToken = signAccessToken({
    userId: record.userId,
    role: record.role,
    activeProfileId: record.profileId,
  })

  record.refreshTokenHash = hashToken(newRefreshToken)
  record.createdAt = new Date()
  indexAccessToken(payload.sessionId, newAccessToken)

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

export async function revokeSession(sessionId: string): Promise<void> {
  await Promise.resolve()
  sessions.delete(sessionId)
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await Promise.resolve()
  for (const [id, record] of sessions) {
    if (record.userId === userId) {
      sessions.delete(id)
    }
  }
}

export async function updateUserProfileId(
  userId: string,
  profileId: string,
): Promise<boolean> {
  await Promise.resolve()
  let updated = false
  for (const record of sessions.values()) {
    if (record.userId === userId && record.active) {
      record.profileId = profileId
      updated = true
    }
  }
  return updated
}

export async function getUserSession(
  sessionId: string,
): Promise<SessionRecord | null> {
  await Promise.resolve()
  return sessions.get(sessionId) ?? null
}

export async function issueSessionAccessToken(
  sessionId: string,
): Promise<string | null> {
  await Promise.resolve()
  const record = sessions.get(sessionId)
  if (!record?.active) return null
  const accessToken = signAccessToken({
    userId: record.userId,
    role: record.role,
    activeProfileId: record.profileId,
  })
  indexAccessToken(sessionId, accessToken)
  return accessToken
}

export interface UserSessionInfo {
  sessionId: string
  createdAt: Date
  current: boolean
}

export async function listUserSessions(
  userId: string,
  currentSessionId?: string,
): Promise<UserSessionInfo[]> {
  await Promise.resolve()
  const result: UserSessionInfo[] = []
  for (const [id, record] of sessions) {
    if (record.userId !== userId) continue
    result.push({
      sessionId: id,
      createdAt: record.createdAt,
      current: id === currentSessionId,
    })
  }
  return result
}

export type AccessTokenSessionRef =
  | { state: 'active'; sessionId: string }
  | { state: 'revoked' }
  | { state: 'unknown' }

export function resolveAccessTokenSession(token: string): AccessTokenSessionRef {
  const owners = accessTokenSessions.get(hashToken(token))
  if (!owners) return { state: 'unknown' }

  // Access tokens carry no session id, and same-second issuances for one user
  // produce identical JWTs; the newest live owner is the current session.
  let newest: { id: string; createdAt: Date } | null = null
  for (const id of owners) {
    const record = sessions.get(id)
    if (!record?.active) continue
    if (!newest || record.createdAt > newest.createdAt) {
      newest = { id, createdAt: record.createdAt }
    }
  }

  return newest ? { state: 'active', sessionId: newest.id } : { state: 'revoked' }
}

export function setAccessTokenCookie(
  response: NextResponse,
  accessToken: string,
): void {
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  })
}

export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  setAccessTokenCookie(response, accessToken)

  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 7 * 24 * 60 * 60,
  })
}

export function clearSessionCookies(response: NextResponse): void {
  response.cookies.set('access_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })

  response.cookies.set('refresh_token', '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 0,
  })
}