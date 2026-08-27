import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { authRateLimiter } from '@/lib/rate-limit'
import { getPayloadClient } from '@/payload/payloadClient'

export const runtime = 'edge'

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

  const regCode = body.regCode as string | undefined
  const companyName = body.companyName as string | undefined
  const reason = body.reason as string | undefined
  const requesterName = body.requesterName as string | undefined
  const requesterPhone = body.requesterPhone as string | undefined
  const requesterEmail = body.requesterEmail as string | undefined

  if (!regCode || !requesterName || !requesterEmail) {
    return NextResponse.json(
      { error: 'Registrikood, taotleja nimi ja e-post on kohustuslikud' },
      { status: 400 },
    )
  }

  const payload = await getPayloadClient()

  const accessRequest = (await payload.create({
    collection: 'company-access-request',
    data: {
      regCode,
      companyName: companyName ?? '',
      reason: reason ?? '',
      requesterName,
      requesterPhone: requesterPhone ?? '',
      requesterEmail,
      status: 'pending',
    },
  })) as Record<string, unknown>

  return NextResponse.json({
    accessRequest: {
      id: accessRequest.id,
      regCode: accessRequest.regCode,
      companyName: accessRequest.companyName,
      status: accessRequest.status,
    },
  })
}