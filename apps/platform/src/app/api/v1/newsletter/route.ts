import { newsletterConfirmationTemplate } from '@eametsad/emails'
import { validators } from '@eametsad/types'
import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'

import { env } from '@/env'
import { getRepositories } from '@/lib/data/runtime'
import { validateHoneypot } from '@/lib/leads/ingestion'
import { marketingEmailHeaders, sendEmail } from '@/lib/notifications/email-sender'
import { newsletterRateLimiter } from '@/lib/rate-limit'

const NEUTRAL_MESSAGE =
  'Kui e-posti aadress pole juba uudiskirjas, saadeti kinnituskiri aadressile'

function extractIp(request: Request): string {
  const raw = request.headers.get('x-forwarded-for')
  const first = raw?.split(',')[0]?.trim()
  return first && first.length > 0 ? first : 'unknown'
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function POST(request: Request): Promise<NextResponse> {
  const ip = extractIp(request)
  const rateCheck = newsletterRateLimiter.check(`newsletter:${ip}`)
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
    return NextResponse.json({ status: 'ok', message: NEUTRAL_MESSAGE })
  }

  const email = typeof body.email === 'string' ? body.email.trim() : ''
  if (!email || !validators.EEEmail.safeParse(email).success) {
    return NextResponse.json({ error: 'Sobimatu e-posti aadress' }, { status: 400 })
  }

  try {
    const repos = await getRepositories()
    const existing = await repos.find({
      collection: 'newsletter-subscribers',
      where: { email: { equals: email } },
      limit: 1,
    })
    // Neutral success for an existing address: no new row, no resend.
    if (existing.docs.length > 0) {
      return NextResponse.json({ status: 'ok', message: NEUTRAL_MESSAGE })
    }

    const token = crypto.randomUUID()
    await repos.create({
      collection: 'newsletter-subscribers',
      data: {
        email,
        status: 'pending',
        tokenHash: hashToken(token),
      },
    })

    const confirmUrl = `${env.NEXT_PUBLIC_APP_URL}/api/v1/newsletter/confirm?token=${encodeURIComponent(token)}`
    try {
      await sendEmail({
        from: env.SMTP_FROM,
        to: email,
        subject: 'Kinnitage uudiskirja tellimus',
        html: newsletterConfirmationTemplate({ confirmUrl }),
        headers: marketingEmailHeaders(),
      })
    } catch (error) {
      // The pending row keeps the intent; a delivery retry is manual.
      console.error(`[newsletter] confirmation email failed for ${email}:`, error)
    }

    return NextResponse.json({ status: 'ok', message: NEUTRAL_MESSAGE })
  } catch (error) {
    console.error('[newsletter] subscription failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
