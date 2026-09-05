/**
 * Guest draft-preview tokens for the Ülevaade step (docs 03 step 7: link
 * expiry 24h). The auctions schema has no preview-token column, so the
 * token is stateless: base64url(JSON{id, exp}) plus an HMAC-SHA256
 * signature over that payload, keyed with the same JWT_SECRET the admin
 * sessions use. Verification needs no lookup; expiry is encoded in the
 * payload.
 */

const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000

export interface GuestPreviewVerification {
  ok: true
  auctionId: string
  expiresAtMs: number
}

export type GuestPreviewRejection =
  | { ok: false; reason: 'invalid' }
  | { ok: false; reason: 'expired'; expiresAtMs: number }

function base64UrlOfBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function bytesFromBase64Url(value: string): Uint8Array | null {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const withPadding = padded + '='.repeat((4 - (padded.length % 4)) % 4)
  try {
    const binary = atob(withPadding)
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

async function signatureOf(payload: string): Promise<string> {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET env var is required')
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return base64UrlOfBytes(new Uint8Array(signature))
}

function signaturesEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let diff = 0
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return diff === 0
}

export async function createGuestPreviewToken(auctionId: string): Promise<string> {
  const payload = base64UrlOfBytes(
    new TextEncoder().encode(JSON.stringify({ id: auctionId, exp: Date.now() + PREVIEW_TTL_MS })),
  )
  return `${payload}.${await signatureOf(payload)}`
}

export async function verifyGuestPreviewToken(
  token: string,
): Promise<GuestPreviewVerification | GuestPreviewRejection> {
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return { ok: false, reason: 'invalid' }
  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  const expected = await signatureOf(payload)
  if (!signaturesEqual(signature, expected)) return { ok: false, reason: 'invalid' }

  const payloadBytes = bytesFromBase64Url(payload)
  if (payloadBytes === null) return { ok: false, reason: 'invalid' }
  let parsed: unknown
  try {
    parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (typeof parsed !== 'object' || parsed === null) return { ok: false, reason: 'invalid' }
  const record = parsed as { id?: unknown; exp?: unknown }
  if (typeof record.id !== 'string' || record.id === '') return { ok: false, reason: 'invalid' }
  if (typeof record.exp !== 'number' || !Number.isFinite(record.exp)) {
    return { ok: false, reason: 'invalid' }
  }
  if (Date.now() > record.exp) {
    return { ok: false, reason: 'expired', expiresAtMs: record.exp }
  }
  return { ok: true, auctionId: record.id, expiresAtMs: record.exp }
}
