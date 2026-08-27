import crypto from 'node:crypto'

interface ResetRecord {
  userId: string
  expiresAt: number
  used: boolean
}

const tokens = new Map<string, ResetRecord>()

export async function createResetToken(userId: string): Promise<string> {
  await Promise.resolve()
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000

  tokens.set(token, { userId, expiresAt, used: false })

  return token
}

export async function consumeResetToken(
  token: string,
): Promise<string | null> {
  await Promise.resolve()
  const record = tokens.get(token)
  if (!record) return null

  if (record.used) return null
  if (Date.now() > record.expiresAt) {
    tokens.delete(token)
    return null
  }

  record.used = true
  tokens.delete(token)

  return record.userId
}