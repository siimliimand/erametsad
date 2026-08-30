import { and, eq, gt, isNull } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import crypto from 'node:crypto'

import { getD1Database } from '../db'
import type { CoreDatabase } from '../data/repositories'
import * as schema from '../data/schema'
import { passwordResetTokens } from '../data/schema'

export const RESET_TOKEN_TTL_MS = 2 * 60 * 60 * 1000

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function nowIso(): string {
  return new Date().toISOString()
}

/**
 * Drizzle instance over the D1 binding, built per call like the repository
 * runtime does (runtime.ts). Callers that already hold a database (tests)
 * pass it explicitly to skip the Cloudflare context.
 */
async function defaultDatabase(): Promise<CoreDatabase> {
  const d1 = await getD1Database()
  return drizzle(d1 as unknown as Parameters<typeof drizzle>[0], { schema })
}

export async function createResetToken(
  userId: string,
  database?: CoreDatabase,
): Promise<string> {
  const db = database ?? (await defaultDatabase())
  const token = crypto.randomBytes(48).toString('hex')
  const now = nowIso()

  await db
    .insert(passwordResetTokens)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
      usedAt: null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: passwordResetTokens.id })

  return token
}

export async function consumeResetToken(
  token: string,
  database?: CoreDatabase,
): Promise<string | null> {
  const db = database ?? (await defaultDatabase())
  const now = nowIso()

  // Single statement: marks used only while unused and unexpired, so a
  // replayed or stale link cannot return the user id.
  const rows = await db
    .update(passwordResetTokens)
    .set({ usedAt: now, updatedAt: now })
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .returning({ userId: passwordResetTokens.userId })

  return rows[0]?.userId ?? null
}
