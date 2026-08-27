import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { getPayloadClient } from '@/payload/payloadClient'

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const auctionId = body.auctionId as string | undefined
  const maxAmount = body.maxAmount as number | undefined

  if (!auctionId || typeof auctionId !== 'string') {
    return NextResponse.json({ error: 'auctionId is required' }, { status: 400 })
  }
  if (typeof maxAmount !== 'number' || maxAmount < 0) {
    return NextResponse.json(
      { error: 'maxAmount must be a non-negative number' },
      { status: 400 },
    )
  }

  const payload = await getPayloadClient()

  const existing = await payload.find({
    collection: 'autobidders',
    where: {
      and: [
        { user: { equals: tokenPayload.userId } },
        { auction: { equals: auctionId } },
      ],
    },
    limit: 1,
    depth: 0,
  })

  let autobidder: Record<string, unknown>

  if (existing.docs.length > 0) {
    const existingDoc = existing.docs[0] as Record<string, unknown>
    autobidder = await payload.update({
      collection: 'autobidders',
      id: existingDoc.id as string,
      data: {
        maxAmount,
        status: 'active',
      },
    })
  } else {
    autobidder = await payload.create({
      collection: 'autobidders',
      data: {
        user: tokenPayload.userId,
        auction: auctionId,
        maxAmount,
        status: 'active',
      },
    })
  }

  return NextResponse.json(autobidder, { status: 201 })
}