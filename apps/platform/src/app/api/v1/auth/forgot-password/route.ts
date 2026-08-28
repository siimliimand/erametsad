import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import nodemailer, { type Transporter } from 'nodemailer'

import { createResetToken } from '@/lib/auth/reset-tokens'
import { hash } from '@/lib/crypto'
import { authRateLimiter } from '@/lib/rate-limit'
import { env } from '@/env'
import { getPayloadClient } from '@/payload/payloadClient'

const NEUTRAL_MESSAGE =
  'Kui konto on olemas, saadeti parooli lähtestamise link e-posti aadressile'

let transporter: Transporter | null = null

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  }
  return transporter
}

function resetEmailBody(resetLink: string): string {
  return [
    'Tere!',
    '',
    'Taotlesite Eametsad oksjonikeskkonnas parooli lähtestamist.',
    '',
    `Parooli lähtestamiseks avage järgmine link (kehtib 2 tundi): ${resetLink}`,
    '',
    'Kui te parooli lähtestamist ei taotlenud, ignoreerige seda kirja.',
    '',
    'Lugupidamisega',
    'Eametsad',
  ].join('\n')
}

async function sendResetEmail(email: string, resetLink: string): Promise<void> {
  await getTransporter().sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject: 'Parooli lähtestamine',
    text: resetEmailBody(resetLink),
  })
}

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get('x-forwarded-for') ?? 'global'
  const rateLimitResult = authRateLimiter.check(forwarded)

  if (!rateLimitResult.allowed) {
    return NextResponse.json({ error: 'Liiga palju katseid' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigane päringu keha' }, { status: 400 })
  }

  const identifier = body.identifier as string | undefined
  if (!identifier) {
    return NextResponse.json({ error: 'Identifikaator on kohustuslik' }, { status: 400 })
  }

  const payload = await getPayloadClient()

  const isEmail = identifier.includes('@')
  let user: Record<string, unknown> | null = null

  if (isEmail) {
    const result = await payload.find({
      collection: 'users',
      where: { email: { equals: identifier } },
      limit: 1,
      depth: 0,
    })
    user = (result.docs[0] as Record<string, unknown> | undefined) ?? null
  } else {
    const isikukoodHash = hash(identifier)
    const result = await payload.find({
      collection: 'users',
      where: { isikukoodHash: { equals: isikukoodHash } },
      limit: 1,
      depth: 0,
    })
    user = (result.docs[0] as Record<string, unknown> | undefined) ?? null
  }

  if (user) {
    const userId = String(user.id)
    const email = user.email as string | undefined

    if (email) {
      const token = await createResetToken(userId)
      const resetLink = `${env.NEXT_PUBLIC_APP_URL}/parooli-taastamine?token=${token}`

      try {
        await sendResetEmail(email, resetLink)
      } catch (error) {
        // Neutral response either way: a send failure must not reveal
        // whether the account exists.
        console.error(`[AUTH] Reset email failed for user ${userId}:`, error)
      }
    }
  }

  return NextResponse.json({ message: NEUTRAL_MESSAGE })
}
