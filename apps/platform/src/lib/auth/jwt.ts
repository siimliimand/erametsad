import crypto from 'node:crypto'

const JWT_ALG = 'HS256'
const ACCESS_TTL = 5 * 60
const REFRESH_TTL = 7 * 24 * 60 * 60

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var is required')
  return secret
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function base64UrlDecode(str: string): Buffer {
  const padded = str.padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function sign(payload: Record<string, unknown>, expiresIn: number): string {
  const header = { alg: JWT_ALG, typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const body = { ...payload, iat: now, exp: now + expiresIn }

  const headerB64 = base64UrlEncode(Buffer.from(JSON.stringify(header)))
  const bodyB64 = base64UrlEncode(Buffer.from(JSON.stringify(body)))
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`${headerB64}.${bodyB64}`)
    .digest()

  return `${headerB64}.${bodyB64}.${base64UrlEncode(signature)}`
}

function verify<T>(token: string): T | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const headerB64 = parts[0]!
  const bodyB64 = parts[1]!
  const sigB64 = parts[2]!

  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(`${headerB64}.${bodyB64}`)
    .digest()
  const actualSig = base64UrlDecode(sigB64)

  if (
    expectedSig.length !== actualSig.length ||
    !crypto.timingSafeEqual(expectedSig, actualSig)
  ) {
    return null
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(base64UrlDecode(bodyB64).toString('utf8'))
  } catch {
    return null
  }

  if (typeof body.exp !== 'number' || Date.now() / 1000 > body.exp) {
    return null
  }

  return body as T
}

export interface AccessTokenPayload {
  userId: string
  role: string
}

export interface RefreshTokenPayload {
  sessionId: string
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return sign({ ...payload }, ACCESS_TTL)
}

export function verifyAccessToken(
  token: string,
): AccessTokenPayload | null {
  const result = verify<AccessTokenPayload>(token)
  if (!result || typeof result.userId !== 'string' || typeof result.role !== 'string') {
    return null
  }
  return { userId: result.userId, role: result.role }
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return sign({ ...payload }, REFRESH_TTL)
}

export function verifyRefreshToken(
  token: string,
): RefreshTokenPayload | null {
  const result = verify<RefreshTokenPayload>(token)
  if (!result || typeof result.sessionId !== 'string') {
    return null
  }
  return { sessionId: result.sessionId }
}