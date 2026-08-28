import crypto from 'node:crypto'

interface ResetRecord {
  userId: string
  expiresAt: number
}

const tokens = new Map<string, ResetRecord>()

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export const RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000

export async function createResetToken(userId: string): Promise<string> {
  await Promise.resolve()
  const token = crypto.randomBytes(48).toString('hex')
  const expiresAt = Date.now() + RESET_TOKEN_TTL_MS

  tokens.set(hashToken(token), { userId, expiresAt })

  return token
}

export async function consumeResetToken(
  token: string,
): Promise<string | null> {
  await Promise.resolve()
  const key = hashToken(token)
  const record = tokens.get(key)
  if (!record) return null

  // Delete first so a concurrent consume in the same tick cannot reuse it.
  tokens.delete(key)
  if (Date.now() > record.expiresAt) return null

  return record.userId
}
