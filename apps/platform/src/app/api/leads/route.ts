import { validators } from '@erametsad/types'
import { NextResponse } from 'next/server'

import { computeIpHash } from '@/lib/bidding/place-bid'
import { ingestLead, validateHoneypot } from '@/lib/leads/ingestion'
import { leadsRateLimiter } from '@/lib/rate-limit'

function extractIp(request: Request): string {
  const raw = request.headers.get('x-forwarded-for')
  const first = raw?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

function fieldError(field: string): { error: string } {
  const labels: Record<string, string> = {
    contactName: 'Nimi on kohustuslik',
    formName: 'Vormi nimi on kohustuslik',
    phone: 'Sobimatu telefoninumber',
    email: 'Sobimatu e-posti aadress',
    consentAt: 'Nõusolek on kohustuslik',
  }
  return { error: labels[field] ?? 'Kohustuslik välja puudub' }
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = leadsRateLimiter.check(`leads:${ip}`)
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane JSON' }, { status: 400 })
  }

  if (!validateHoneypot(body)) {
    return NextResponse.json({ status: 'ok' })
  }

  const contactName = typeof body.contactName === 'string' ? body.contactName.trim() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const consentAt = typeof body.consentAt === 'string' ? body.consentAt.trim() : ''
  const formName = typeof body.formName === 'string' ? body.formName.trim() : ''
  const pageSlug = typeof body.pageSlug === 'string' ? body.pageSlug.trim() : ''
  const cadastr = typeof body.cadastr === 'string' ? body.cadastr.trim() : ''
  const source = typeof body.source === 'string' ? body.source.trim() : 'web'

  if (!contactName) {
    return NextResponse.json(fieldError('contactName'), { status: 400 })
  }

  if (!formName) {
    return NextResponse.json(fieldError('formName'), { status: 400 })
  }

  if (!phone || !validators.EEPhone.safeParse(phone).success) {
    return NextResponse.json(fieldError('phone'), { status: 400 })
  }

  if (!email || !validators.EEEmail.safeParse(email).success) {
    return NextResponse.json(fieldError('email'), { status: 400 })
  }

  if (!consentAt) {
    return NextResponse.json(fieldError('consentAt'), { status: 400 })
  }

  const ipHash = computeIpHash(ip)

  try {
    const lead = await ingestLead({
      formName,
      pageSlug,
      contactName,
      phone,
      email,
      cadastr,
      consentAt,
      source,
      ipHash,
    })

    return NextResponse.json(lead, { status: 201 })
  } catch (error) {
    console.error('[leads] ingestion failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}