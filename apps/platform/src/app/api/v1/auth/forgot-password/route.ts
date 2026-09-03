import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { MARKETING_BASE_URL } from '@/app/(marketing)/_lib/base-url'
import { createResetToken } from '@/lib/auth/reset-tokens'
import { hash } from '@/lib/crypto'
import { getRepositories } from '@/lib/data/runtime'
import { sendEmail } from '@/lib/notifications/email-sender'
import { authRateLimiter } from '@/lib/rate-limit'

const NEUTRAL_MESSAGE =
  'Kui konto on olemas, saadeti parooli lähtestamise link e-posti aadressile'

function resetEmailHtml(resetLink: string): string {
  return [
    '<p>Tere!</p>',
    '',
    '<p>Taotlesite Erametsad oksjonikeskkonnas parooli lähtestamist.</p>',
    '',
    `<p>Parooli lähtestamiseks avage järgmine link (kehtib 2 tundi): <a href="${resetLink}">${resetLink}</a></p>`,
    '',
    '<p>Kui te parooli lähtestamist ei taotlenud, ignoreerige seda kirja.</p>',
    '',
    '<p>Lugupidamisega,<br>Erametsad</p>',
  ].join('\n')
}

// sendEmail walks the EMAIL binding → Cloudflare API → SMTP chain and
// reports failures as results; transport errors must not leak whether the
// account exists, so a failed send only logs.
async function sendResetEmail(email: string, resetLink: string): Promise<void> {
  const result = await sendEmail({
    // Lazy read: empty falls back to email-sender's DEFAULT_FROM.
    ...(process.env.SMTP_FROM ? { from: process.env.SMTP_FROM } : {}),
    to: email,
    subject: 'Parooli lähtestamine',
    html: resetEmailHtml(resetLink),
  })
  if (!result.success) {
    console.error(
      `[AUTH] Reset email send failed via ${result.transport} (code ${result.error?.code ?? 'unknown'}): ${result.error?.message ?? 'unknown error'}`,
    )
  }
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

  const repos = await getRepositories()

  const isEmail = identifier.includes('@')
  let user: Record<string, unknown> | null = null

  if (isEmail) {
    const result = await repos.find({
      collection: 'users',
      where: { email: { equals: identifier } },
      limit: 1,
    })
    user = (result.docs[0] as Record<string, unknown> | undefined) ?? null
  } else {
    const isikukoodHash = hash(identifier)
    const result = await repos.find({
      collection: 'users',
      where: { isikukoodHash: { equals: isikukoodHash } },
      limit: 1,
    })
    user = (result.docs[0] as Record<string, unknown> | undefined) ?? null
  }

  if (user) {
    const userId = String(user.id)
    const email = user.email as string | undefined

    if (email) {
      const token = await createResetToken(userId)
      const resetLink = `${MARKETING_BASE_URL}/reset-password/${token}`

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
