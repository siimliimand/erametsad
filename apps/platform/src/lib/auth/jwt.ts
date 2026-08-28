// Task 5.2 dual implementation: the canonical JWT path is Web Crypto
// (crypto.subtle HMAC-SHA256), which is async-only. The sync exports stay
// on node:crypto because session.ts and the local vitest node pool still
// call them synchronously. Both paths derive identical HS256 bytes from
// JWT_SECRET; the interop tests in lib/__tests__/encryption.test.ts lock
// that invariant, so callers can migrate to the Async twins one by one.
import { createHmac, timingSafeEqual } from 'node:crypto'

const JWT_ALG = 'HS256'
const ACCESS_TTL = 5 * 60
const REFRESH_TTL = 7 * 24 * 60 * 60

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var is required')
  return secret
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64UrlToBytes(str: string): Uint8Array<ArrayBuffer> {
  const padded = str.padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function parseBody(bodyB64: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(
      decoder.decode(base64UrlToBytes(bodyB64)),
    ) as Record<string, unknown>
    if (
      typeof parsed.exp !== 'number' ||
      Date.now() / 1000 > parsed.exp
    ) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

let hmacKey: Promise<CryptoKey> | null = null

function getHmacKey(): Promise<CryptoKey> {
  hmacKey ??= crypto.subtle.importKey(
    'raw',
    encoder.encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
  return hmacKey
}

function sign(payload: Record<string, unknown>, expiresIn: number): string {
  const header = { alg: JWT_ALG, typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresIn }

  const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify(header)))
  const bodyB64 = bytesToBase64Url(encoder.encode(JSON.stringify(body)))
  const signature = createHmac('sha256', getSecret())
    .update(`${headerB64}.${bodyB64}`)
    .digest()

  return `${headerB64}.${bodyB64}.${bytesToBase64Url(signature)}`
}

function verify(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, bodyB64, sigB64] = parts as [string, string, string]

  const expectedSig = createHmac('sha256', getSecret())
    .update(`${headerB64}.${bodyB64}`)
    .digest()
  const actualSig = Buffer.from(base64UrlToBytes(sigB64))

  if (
    expectedSig.length !== actualSig.length ||
    !timingSafeEqual(expectedSig, actualSig)
  ) {
    return null
  }

  return parseBody(bodyB64)
}

async function signAsync(
  payload: Record<string, unknown>,
  expiresIn: number,
): Promise<string> {
  const header = { alg: JWT_ALG, typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresIn }

  const headerB64 = bytesToBase64Url(encoder.encode(JSON.stringify(header)))
  const bodyB64 = bytesToBase64Url(encoder.encode(JSON.stringify(body)))
  const signature = await crypto.subtle.sign(
    'HMAC',
    await getHmacKey(),
    encoder.encode(`${headerB64}.${bodyB64}`),
  )

  return `${headerB64}.${bodyB64}.${bytesToBase64Url(new Uint8Array(signature))}`
}

async function verifyAsync(
  token: string,
): Promise<Record<string, unknown> | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const [headerB64, bodyB64, sigB64] = parts as [string, string, string]

  const valid = await crypto.subtle.verify(
    'HMAC',
    await getHmacKey(),
    base64UrlToBytes(sigB64),
    encoder.encode(`${headerB64}.${bodyB64}`),
  )
  if (!valid) return null

  return parseBody(bodyB64)
}

export interface AccessTokenPayload {
  userId: string
  role: string
  activeProfileId?: string | undefined
  // Present on every session-issued token: without a per-session
  // distinguisher, same-second issuances for one user are byte-identical
  // JWTs and collide on the sessions.access_token_hash unique index.
  sessionId?: string | undefined
}

export interface RefreshTokenPayload {
  sessionId: string
  // Unique per issuance: without it a same-second rotation signs a
  // byte-identical token and reuse detection cannot distinguish them.
  jti: string
}

const ADMIN_ROLES: ReadonlySet<string> = new Set(['admin', 'superadmin'])

export function isAdminRole(role: string | null | undefined): boolean {
  return typeof role === 'string' && ADMIN_ROLES.has(role)
}

function toAccessToken(result: Record<string, unknown> | null): AccessTokenPayload | null {
  if (!result || typeof result.userId !== 'string' || typeof result.role !== 'string') {
    return null
  }
  const activeProfileId =
    typeof result.activeProfileId === 'string' ? result.activeProfileId : undefined
  const sessionId =
    typeof result.sessionId === 'string' ? result.sessionId : undefined
  if (activeProfileId === undefined && sessionId === undefined) {
    return { userId: result.userId, role: result.role }
  }
  return {
    userId: result.userId,
    role: result.role,
    ...(activeProfileId !== undefined ? { activeProfileId } : {}),
    ...(sessionId !== undefined ? { sessionId } : {}),
  }
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return sign({ ...payload }, ACCESS_TTL)
}

export function verifyAccessToken(
  token: string,
): AccessTokenPayload | null {
  return toAccessToken(verify(token))
}

export function verifyAdminAccessToken(
  token: string,
): AccessTokenPayload | null {
  const payload = verifyAccessToken(token)
  return payload !== null && isAdminRole(payload.role) ? payload : null
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return sign({ ...payload }, REFRESH_TTL)
}

export function verifyRefreshToken(
  token: string,
): { sessionId: string } | null {
  const result = verify(token)
  if (!result || typeof result.sessionId !== 'string') {
    return null
  }
  return { sessionId: result.sessionId }
}

export async function signAccessTokenAsync(
  payload: AccessTokenPayload,
): Promise<string> {
  return signAsync({ ...payload }, ACCESS_TTL)
}

export async function verifyAccessTokenAsync(
  token: string,
): Promise<AccessTokenPayload | null> {
  return toAccessToken(await verifyAsync(token))
}

export async function signRefreshTokenAsync(
  payload: RefreshTokenPayload,
): Promise<string> {
  return signAsync({ ...payload }, REFRESH_TTL)
}

export async function verifyRefreshTokenAsync(
  token: string,
): Promise<{ sessionId: string } | null> {
  const result = await verifyAsync(token)
  if (!result || typeof result.sessionId !== 'string') {
    return null
  }
  return { sessionId: result.sessionId }
}
