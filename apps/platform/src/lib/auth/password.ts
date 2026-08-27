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