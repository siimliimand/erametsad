// Task 5.2 dual implementation: the canonical sealed-bid path is Web
// Crypto (crypto.subtle AES-GCM with a PBKDF2-derived key), which is
// async-only. The sync exports stay on node:crypto because sealed-bid.ts,
// the seed, and the local vitest node pool still call them synchronously.
// Both paths derive the same key (PBKDF2-SHA-256, identical parameters)
// and emit the same {encrypted, iv, authTag} envelope, so envelopes move
// freely between them. The KDF moved off scrypt because Web Crypto has
// no scrypt; decision record 1.5 confirmed no production data exists.
import { createCipheriv, createDecipheriv, pbkdf2Sync } from 'node:crypto'

import { concatBytes } from './bytes'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'erametsad-sealed-bid-v1'
const PBKDF2_ITERATIONS = 600_000
const IV_BYTES = 12
const TAG_BYTES = 16

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getSecret(): string {
  const raw = process.env.SEALED_BID_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('SEALED_BID_ENCRYPTION_KEY env var is required')
  }
  return raw
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

// Caches are keyed by the secret value so env swaps (tests, rotations)
// re-derive instead of decrypting with a stale key.
let cachedSecret: string | null = null
let cachedKeyBytes: Uint8Array | null = null

function getKeySync(): Uint8Array {
  const raw = getSecret()
  if (cachedSecret !== raw || cachedKeyBytes === null) {
    cachedKeyBytes = pbkdf2Sync(
      encoder.encode(raw),
      encoder.encode(SALT),
      PBKDF2_ITERATIONS,
      32,
      'sha256',
    )
    cachedSecret = raw
  }
  return cachedKeyBytes
}

let cachedCryptoSecret: string | null = null
let cachedCryptoKey: Promise<CryptoKey> | null = null

function getKeyAsync(): Promise<CryptoKey> {
  const raw = getSecret()
  if (cachedCryptoSecret !== raw || cachedCryptoKey === null) {
    cachedCryptoSecret = raw
    cachedCryptoKey = (async () => {
      const base = await crypto.subtle.importKey(
        'raw',
        encoder.encode(raw),
        'PBKDF2',
        false,
        ['deriveBits'],
      )
      const bits = await crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: encoder.encode(SALT),
          iterations: PBKDF2_ITERATIONS,
          hash: 'SHA-256',
        },
        base,
        256,
      )
      return crypto.subtle.importKey(
        'raw',
        bits,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt'],
      )
    })()
  }
  return cachedCryptoKey
}

export interface SealedEnvelope {
  encrypted: string
  iv: string
  authTag: string
}

export function encryptSealedData(data: string): SealedEnvelope {
  const key = getKeySync()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const encrypted = concatBytes([cipher.update(data, 'utf8'), cipher.final()])
  return {
    encrypted: bytesToHex(encrypted),
    iv: bytesToHex(iv),
    authTag: bytesToHex(cipher.getAuthTag()),
  }
}

export function decryptSealedData(
  encrypted: string,
  iv: string,
  authTag: string,
): string {
  if (!authTag) {
    throw new Error('authTag is required for AES-256-GCM decryption')
  }
  const key = getKeySync()
  const decipher = createDecipheriv(
    ALGORITHM,
    key,
    hexToBytes(iv),
  )
  decipher.setAuthTag(hexToBytes(authTag))

  const decrypted = concatBytes([
    decipher.update(hexToBytes(encrypted)),
    decipher.final(),
  ])
  return decoder.decode(decrypted)
}

export async function encryptSealedDataAsync(data: string): Promise<SealedEnvelope> {
  const key = await getKeyAsync()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  // Web Crypto returns ciphertext with the 16-byte tag appended; split it
  // so the stored envelope shape matches the sync path.
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(data)),
  )
  return {
    encrypted: bytesToHex(sealed.subarray(0, sealed.length - TAG_BYTES)),
    iv: bytesToHex(iv),
    authTag: bytesToHex(sealed.subarray(sealed.length - TAG_BYTES)),
  }
}

export async function decryptSealedDataAsync(
  encrypted: string,
  iv: string,
  authTag: string,
): Promise<string> {
  if (!authTag) {
    throw new Error('authTag is required for AES-256-GCM decryption')
  }
  const key = await getKeyAsync()
  const ciphertext = hexToBytes(encrypted)
  const tag = hexToBytes(authTag)
  const sealed = new Uint8Array(ciphertext.length + tag.length)
  sealed.set(ciphertext)
  sealed.set(tag, ciphertext.length)

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(iv) },
    key,
    sealed,
  )
  return decoder.decode(plaintext)
}
