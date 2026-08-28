import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { placeBid } from '@/lib/bidding/place-bid'
import type { BidResult } from '@/lib/bidding/place-bid'

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const auctionId = body.auctionId as string | undefined
  const amount = body.amount as number | undefined
  const type = body.type as string | undefined
  const idempotencyKey = body.idempotencyKey as string | undefined

  if (!auctionId || typeof auctionId !== 'string') {
    return NextResponse.json({ error: 'auctionId is required' }, { status: 400 })
  }
  if (typeof amount !== 'number' || amount < 0) {
    return NextResponse.json({ error: 'amount must be a non-negative number' }, { status: 400 })
  }
  if (type !== 'open' && type !== 'sealed') {
    return NextResponse.json({ error: 'type must be open or sealed' }, { status: 400 })
  }

  const result: BidResult = await placeBid({
    userId: tokenPayload.userId,
    auctionId,
    amount,
    type,
    source: 'manual',
    requestIp: request.headers.get('x-forwarded-for') ?? 'unknown',
    ...(idempotencyKey !== undefined ? { idempotencyKey } : {}),
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result.bid, { status: 201 })
}