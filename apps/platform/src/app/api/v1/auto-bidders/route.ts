import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { centsToEuros, eurosToCents } from '@/lib/data/repositories/money'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'

// Only an active row counts: DELETE cancels by flipping status to 'paused',
// and a paused autobidder must surface as 204 so the UI treats it as absent.
function toOwnAutobidder(row: Record<string, unknown>): { id: string; max: number } | null {
  if (typeof row.id !== 'string' || typeof row.maxAmountCents !== 'number') {
    return null
  }
  return { id: row.id, max: centsToEuros(row.maxAmountCents) }
}

// The caller's own active autobidder row for one auction: the id enables
// PATCH/DELETE and `max` prefills the editor. Foreign rows are invisible
// through the session guard context.
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Autentimata' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Sessioon on aegunud' }, { status: 401 })
  }

  const auctionId = request.nextUrl.searchParams.get('auction')
  if (auctionId === null || auctionId === '') {
    return NextResponse.json(
      { error: 'auction query parameter is required' },
      { status: 400 },
    )
  }

  const repos = await getRepositories(sessionGuardContext(tokenPayload))

  const result = await repos.find({
    collection: 'autobidders',
    where: {
      and: [
        { user: { equals: tokenPayload.userId } },
        { auction: { equals: auctionId } },
        { status: { equals: 'active' } },
      ],
    },
    limit: 1,
  })

  const autobidder = toOwnAutobidder(
    (result.docs[0] as Record<string, unknown> | undefined) ?? {},
  )
  if (autobidder === null) {
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json(autobidder)
}

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

  // The caller owns autobidders rows, so the repository guard context is
  // derived from the verified session.
  const repos = await getRepositories(sessionGuardContext(tokenPayload))

  const existing = await repos.find({
    collection: 'autobidders',
    where: {
      and: [
        { user: { equals: tokenPayload.userId } },
        { auction: { equals: auctionId } },
      ],
    },
    limit: 1,
  })

  let autobidder: Record<string, unknown>

  if (existing.docs.length > 0) {
    const existingDoc = existing.docs[0] as Record<string, unknown>
    autobidder = (await repos.update({
      collection: 'autobidders',
      id: existingDoc.id as string,
      data: {
        maxAmountCents: eurosToCents(maxAmount),
        status: 'active',
      },
    }))
  } else {
    autobidder = (await repos.create({
      collection: 'autobidders',
      data: {
        user: tokenPayload.userId,
        auction: auctionId,
        maxAmountCents: eurosToCents(maxAmount),
        status: 'active',
      },
    }))
  }

  return NextResponse.json(toPublicAutobidder(autobidder), { status: 201 })
}

// Repository rows carry storage names (userId, auctionId,
// maxAmountCents); the API surface keeps the Payload field names
// (user, auction, maxAmount in EUR).
function toPublicAutobidder(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    user: row.userId,
    auction: row.auctionId,
    maxAmount: centsToEuros(row.maxAmountCents as number),
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
