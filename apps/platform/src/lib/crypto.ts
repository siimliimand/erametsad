import crypto from 'node:crypto'

import { concatBytes, fromHex, toHex, utf8Decode } from './bytes'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'eametsad-isikukood-v1'

function getKey(): Uint8Array {
  const raw = process.env.ISIKUKOOD_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ISIKUKOOD_ENCRYPTION_KEY env var is required')
  }
  return crypto.scryptSync(raw, SALT, 32)
}

export function encrypt(text: string): {
  encrypted: string
  iv: string
  authTag: string
} {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = concatBytes([cipher.update(text, 'utf8'), cipher.final()])
  return {
    encrypted: toHex(encrypted),
    iv: toHex(iv),
    authTag: toHex(cipher.getAuthTag()),
  }
}

export function decrypt(
  encrypted: string,
  iv: string,
  authTag: string,
): string {
  if (!authTag) {
    throw new Error('authTag is required for AES-256-GCM decryption')
  }
  const key = getKey()
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    fromHex(iv),
  )
  decipher.setAuthTag(fromHex(authTag))

  const decrypted = concatBytes([
    decipher.update(fromHex(encrypted)),
    decipher.final(),
  ])
  return utf8Decode(decrypted)
}

export function hash(value: string): string {
  const salted = `${SALT}:${value}`
  return crypto.createHash('sha256').update(salted).digest('hex')
}