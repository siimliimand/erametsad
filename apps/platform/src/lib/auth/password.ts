import crypto from 'node:crypto'

const ITERATIONS = 310_000
const KEY_LENGTH = 64
const DIGEST = 'sha512'
const SALT_LENGTH = 32

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex')
  const derivedKey = await deriveKey(password, salt)
  return `${salt}:${derivedKey}`
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const parts = hash.split(':')
  if (parts.length !== 2) return false

  const [salt, key] = parts
  if (!salt || !key) return false

  const derivedKey = await deriveKey(password, salt)
  return crypto.timingSafeEqual(Buffer.from(key), Buffer.from(derivedKey))
}

function deriveKey(password: string, salt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, ITERATIONS, KEY_LENGTH, DIGEST, (err, key) => {
      if (err) reject(err)
      else resolve(key.toString('hex'))
    })
  })
}

// The users.password_hash/password_salt columns follow the seed's scrypt
// scheme (16-byte hex salt, 64-byte key) until the Phase 4 auth port
// fixes the verification format.
const CREDENTIAL_SALT_BYTES = 16
const CREDENTIAL_KEY_BYTES = 64

export interface CredentialHash {
  hash: string
  salt: string
}

export function hashCredentialPassword(password: string): CredentialHash {
  const salt = crypto.randomBytes(CREDENTIAL_SALT_BYTES).toString('hex')
  const hash = crypto.scryptSync(password, salt, CREDENTIAL_KEY_BYTES).toString('hex')
  return { hash, salt }
}

export function verifyCredentialPassword(
  password: string,
  storedHash: string | null,
  salt: string | null,
): boolean {
  if (!storedHash || !salt) return false
  const candidate = crypto.scryptSync(password, salt, CREDENTIAL_KEY_BYTES)
  const expected = Buffer.from(storedHash, 'hex')
  return (
    candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected)
  )
}