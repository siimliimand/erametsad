import { NextResponse } from 'next/server'

import { ingestLead, validateHoneypot } from '@/lib/leads/ingestion'
import { apiRateLimiter } from '@/lib/rate-limit'

export async function POST(request: Request): Promise<NextResponse> {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  const rateCheck = apiRateLimiter.check(`leads:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!validateHoneypot(body)) {
    return NextResponse.json({ status: 'ok' })
  }

  if (!body.consentAt) {
    return NextResponse.json({ error: 'consentAt is required' }, { status: 400 })
  }

  try {
    const lead = await ingestLead({
      formName: body.formName as string,
      pageSlug: (body.pageSlug as string | undefined) ?? '',
      contactName: body.contactName as string,
      phone: (body.phone as string | undefined) ?? '',
      email: (body.email as string | undefined) ?? '',
      cadastr: (body.cadastr as string | undefined) ?? '',
      consentAt: body.consentAt as string,
      source: (body.source as string | undefined) ?? 'web',
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}