import type { NextResponse } from 'next/server'
import crypto from 'node:crypto'

import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from './jwt'

interface SessionRecord {
  userId: string
  profileId: string | undefined
  tokenFamily: string
  active: boolean
  refreshTokenHash: string
  createdAt: Date
}

const sessions = new Map<string, SessionRecord>()

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSession(
  userId: string,
  profileId?: string,
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  await Promise.resolve()
  const sessionId = crypto.randomUUID()
  const tokenFamily = crypto.randomUUID()

  const accessToken = signAccessToken({ userId, role: 'user' })
  const refreshToken = signRefreshToken({ sessionId })

  sessions.set(sessionId, {
    userId,
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

  const newRefreshToken = signRefreshToken({ sessionId: payload.sessionId })
  const newAccessToken = signAccessToken({
    userId: record.userId,
    role: 'user',
  })

  record.refreshTokenHash = hashToken(newRefreshToken)
  record.createdAt = new Date()

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

export function setSessionCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
): void {
  response.cookies.set('access_token', accessToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 5 * 60,
  })

  response.cookies.set('refresh_token', refreshToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/api/auth',
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
    path: '/api/auth',
    maxAge: 0,
  })
}