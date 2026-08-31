import { and, eq, inArray } from 'drizzle-orm'
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
// update that unsubscribes, so a replayed link matches no row.
async function unsubscribeByToken(token: string): Promise<boolean> {
  const database = drizzle((await getD1Database()) as unknown as Parameters<typeof drizzle>[0])
  const tokenHash = createHash('sha256').update(token).digest('hex')
  const now = new Date().toISOString()
  const rows = await database
    .update(newsletterSubscribers)
    .set({ status: 'unsubscribed', tokenHash: null, unsubscribedAt: now, updatedAt: now })
    .where(
      and(
        eq(newsletterSubscribers.tokenHash, tokenHash),
        inArray(newsletterSubscribers.status, ['pending', 'confirmed']),
      ),
    )
    .returning({ id: newsletterSubscribers.id })
  return rows.length > 0
}

export async function GET(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = newsletterRateLimiter.check(`newsletter-unsubscribe:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? ''
  if (!token) {
    return NextResponse.json({ error: 'Eemaldamistoken puudub' }, { status: 400 })
  }

  try {
    const unsubscribed = await unsubscribeByToken(token)
    if (!unsubscribed) {
      return NextResponse.json({ error: 'Link on kehtetu või juba kasutatud' }, { status: 404 })
    }
    return NextResponse.json({
      status: 'ok',
      message: 'Teie e-posti aadress on uudiskirja nimekirjast eemaldatud',
    })
  } catch (error) {
    console.error('[newsletter] unsubscribe failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
