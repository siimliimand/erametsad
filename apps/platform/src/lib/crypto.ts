import crypto from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const SALT = 'eametsad-isikukood-v1'

function getKey(): Buffer {
  const raw = process.env.ISIKUKOOD_ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ISIKUKOOD_ENCRYPTION_KEY env var is required')
  }
  return crypto.scryptSync(raw, SALT, 32)
}

export function encrypt(text: string): { encrypted: string; iv: string } {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return {
    encrypted: encrypted.toString('hex'),
    iv: iv.toString('hex'),
  }
}

export function decrypt(encrypted: string, iv: string): string {
  const key = getKey()
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(iv, 'hex'),
  )

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'hex')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

export function hash(value: string): string {
  const salted = `${SALT}:${value}`
  return crypto.createHash('sha256').update(salted).digest('hex')
}