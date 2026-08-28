import type { NextResponse } from 'next/server'
import crypto from 'node:crypto'

import { db } from '../db'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt'

export interface SessionRecord {
  userId: string
  role: string
  profileId: string | undefined
  tokenFamily: string
  active: boolean
  refreshTokenHash: string
  createdAt: Date
}

export interface SessionRow {
  id: string
  user_id: string
  role: string
  profile_id: string | null
  token_family: string
  access_token_hash: string
  refresh_token_hash: string
  expires_at: string
  revoked_at: string | null
  created_at: string
  updated_at: string
}

export type AccessTokenSessionRef =
  | { state: 'active'; sessionId: string }
  | { state: 'revoked' }
  | { state: 'unknown' }

export interface UserSessionInfo {
  sessionId: string
  createdAt: Date
  current: boolean
}

export interface SessionCreateInput {
  sessionId: string
  userId: string
  role: string
  profileId?: string
  tokenFamily: string
  accessToken: string
  refreshToken: string
  expiresAt: string
}

const SESSION_COLUMNS =
  'id, user_id, role, profile_id, token_family, access_token_hash, refresh_token_hash, expires_at, revoked_at, created_at, updated_at'

// Mirrors REFRESH_TTL in ./jwt.ts: every rotation re-signs the refresh
// token with a fresh 7-day exp, so the row horizon slides with it.
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function nowIso(): string {
  return new Date().toISOString()
}

function sessionExpiry(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString()
}

function isLive(row: SessionRow): boolean {
  return row.revoked_at === null && row.expires_at > nowIso()
}

function toRecord(row: SessionRow): SessionRecord {
  return {
    userId: row.user_id,
    role: row.role,
    profileId: row.profile_id ?? undefined,
    tokenFamily: row.token_family,
    active: true,
    refreshTokenHash: row.refresh_token_hash,
    createdAt: new Date(row.created_at),
  }
}

async function getSessionRow(sessionId: string): Promise<SessionRow | null> {
  const result = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?`,
    [sessionId],
  )
  return result.results[0] ?? null
}

export async function createSessionRecord(input: SessionCreateInput): Promise<void> {
  const now = nowIso()
  await db.query(
    `INSERT INTO sessions (${SESSION_COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      input.sessionId,
      input.userId,
      input.role,
      input.profileId ?? null,
      input.tokenFamily,
      hashToken(input.accessToken),
      hashToken(input.refreshToken),
      input.expiresAt,
      now,
      now,
    ],
  )
}

export async function findSessionByAccessToken(
  accessTokenHash: string,
): Promise<SessionRow | null> {
  const result = await db.query<SessionRow>(
    `SELECT ${SESSION_COLUMNS} FROM sessions WHERE access_token_hash = ?`,
    [accessTokenHash],
  )
  return result.results[0] ?? null
}

export async function createSession(
  userId: string,
  role: string,
  profileId?: string,
): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
  const sessionId = crypto.randomUUID()
  const tokenFamily = crypto.randomUUID()

  const accessToken = signAccessToken({
    userId,
    role,
    activeProfileId: profileId,
    sessionId,
  })
  const refreshToken = signRefreshToken({
    sessionId,
    jti: crypto.randomUUID(),
  })

  await createSessionRecord({
    sessionId,
    userId,
    role,
    ...(profileId !== undefined ? { profileId } : {}),
    tokenFamily,
    accessToken,
    refreshToken,
    expiresAt: sessionExpiry(),
  })

  return { accessToken, refreshToken, sessionId }
}

export async function refreshSession(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const payload = verifyRefreshToken(refreshToken)
  if (!payload) return null

  const row = await getSessionRow(payload.sessionId)
  if (!row || !isLive(row)) return null

  const newRefreshToken = signRefreshToken({
    sessionId: row.id,
    jti: crypto.randomUUID(),
  })
  const newAccessToken = signAccessToken({
    userId: row.user_id,
    role: row.role,
    activeProfileId: row.profile_id ?? undefined,
    sessionId: row.id,
  })

  // Compare-and-swap on the stored refresh hash: a replayed token loses
  // the race, which is exactly the family-reuse signal.
  const rotated = await db.query(
    `UPDATE sessions
     SET refresh_token_hash = ?, access_token_hash = ?, expires_at = ?, updated_at = ?
     WHERE id = ? AND refresh_token_hash = ? AND revoked_at IS NULL`,
    [
      hashToken(newRefreshToken),
      hashToken(newAccessToken),
      sessionExpiry(),
      nowIso(),
      row.id,
      hashToken(refreshToken),
    ],
  )

  if (typeof rotated.meta.changes !== 'number' || rotated.meta.changes === 0) {
    await revokeSession(row.id)
    return null
  }

  return { accessToken: newAccessToken, refreshToken: newRefreshToken }
}

export async function revokeSession(sessionId: string): Promise<void> {
  const now = nowIso()
  await db.query(
    `UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE id = ? AND revoked_at IS NULL`,
    [now, now, sessionId],
  )
}

export async function revokeUserSessions(userId: string): Promise<void> {
  const now = nowIso()
  await db.query(
    `UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    [now, now, userId],
  )
}

// Name kept from the pre-D1 API; routes import it for password changes.
export const revokeAllUserSessions = revokeUserSessions

export async function purgeExpiredSessions(): Promise<number> {
  const result = await db.query(`DELETE FROM sessions WHERE expires_at <= ?`, [
    nowIso(),
  ])
  return typeof result.meta.changes === 'number' ? result.meta.changes : 0
}

export async function updateUserProfileId(
  userId: string,
  profileId: string,
): Promise<boolean> {
  const result = await db.query(
    `UPDATE sessions SET profile_id = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    [profileId, nowIso(), userId],
  )
  return typeof result.meta.changes === 'number' && result.meta.changes > 0
}

export async function issueSessionAccessToken(
  sessionId: string,
): Promise<string | null> {
  const row = await getSessionRow(sessionId)
  if (!row || !isLive(row)) return null

  const accessToken = signAccessToken({
    userId: row.user_id,
    role: row.role,
    activeProfileId: row.profile_id ?? undefined,
    sessionId: row.id,
  })

  await db.query(
    `UPDATE sessions SET access_token_hash = ?, updated_at = ? WHERE id = ?`,
    [hashToken(accessToken), nowIso(), row.id],
  )

  return accessToken
}

export async function getUserSession(
  sessionId: string,
): Promise<SessionRecord | null> {
  const row = await getSessionRow(sessionId)
  if (!row || !isLive(row)) return null
  return toRecord(row)
}

export async function listUserSessions(
  userId: string,
  currentSessionId?: string,
): Promise<UserSessionInfo[]> {
  const result = await db.query<{ id: string; created_at: string }>(
    `SELECT id, created_at FROM sessions
     WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC`,
    [userId, nowIso()],
  )
  return result.results.map((row) => ({
    sessionId: row.id,
    createdAt: new Date(row.created_at),
    current: row.id === currentSessionId,
  }))
}

export async function resolveAccessTokenSession(
  token: string,
): Promise<AccessTokenSessionRef> {
  const row = await findSessionByAccessToken(hashToken(token))
  if (!row) return { state: 'unknown' }
  if (!isLive(row)) return { state: 'revoked' }
  return { state: 'active', sessionId: row.id }
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
