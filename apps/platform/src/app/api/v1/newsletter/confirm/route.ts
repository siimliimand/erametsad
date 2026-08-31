import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

import { newsletterSubscribers } from '@/lib/data/schema'
import { getD1Database } from '@/lib/db'
import { newsletterRateLimiter } from '@/lib/rate-limit'

function extractIp(request: Request): string {
  const raw = request.headers.get('x-forwarded-for')
  const first = raw?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

// Single-use in one statement: the token hash is consumed by the same
// update that confirms, so a replayed link matches no row (same guarantee
// as the password-reset token flow).
async function confirmByToken(token: string): Promise<boolean> {
  const database = drizzle((await getD1Database()) as unknown as Parameters<typeof drizzle>[0])
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date().toISOString()
  const rows = await database
    .update(newsletterSubscribers)
    .set({ status: 'confirmed', tokenHash: null, confirmedAt: now, updatedAt: now })
    .where(and(eq(newsletterSubscribers.tokenHash, tokenHash), eq(newsletterSubscribers.status, 'pending')))
    .returning({ id: newsletterSubscribers.id })
  return rows.length > 0
}

export async function GET(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = newsletterRateLimiter.check(`newsletter-confirm:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? ''
  if (!token) {
    return NextResponse.json({ error: 'Kinnitustoken puudub' }, { status: 400 })
  }

  try {
    const confirmed = await confirmByToken(token)
    if (!confirmed) {
      return NextResponse.json({ error: 'Link on kehtetu või juba kasutatud' }, { status: 404 })
    }
    return NextResponse.json({ status: 'ok', message: 'Uudiskirja tellimus on kinnitatud' })
  } catch (error) {
    console.error('[newsletter] confirmation failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
