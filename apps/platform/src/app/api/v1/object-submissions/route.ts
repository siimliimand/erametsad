import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { ZodError } from 'zod'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { saleSubmissionSchema } from '@/lib/object-submission'
import { ingestSaleSubmission } from '@/lib/object-submission/sale-branch'

async function authenticate(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload.userId
}

/** First message per dotted field path (contact.phone, cadastres.0, ...). */
function fieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.map(String).join('.') || 'form'
    if (!(key in errors)) {
      errors[key] = issue.message
    }
  }
  return errors
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sellerId = await authenticate(request)
  if (!sellerId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Vigane JSON' }, { status: 400 })
  }

  const parsed = saleSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ errors: fieldErrors(parsed.error) }, { status: 422 })
  }

  try {
    const { auction, lead, assignedSpecialistId } = await ingestSaleSubmission(
      parsed.data,
      sellerId,
    )
    return NextResponse.json(
      {
        status: 'ok',
        auction: {
          id: auction.id,
          slug: auction.slug,
          status: auction.status,
          objectType: auction.objectType,
          type: auction.type,
        },
        lead: { id: lead.id },
        assignedSpecialistId,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('[object-submissions] ingestion failed:', error)
    return NextResponse.json({ error: 'Sisemine viga' }, { status: 500 })
  }
}
