import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { prepareContract } from '@/lib/contracts/service'
import { getRepositories } from '@/lib/data/runtime'

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
  if (!auctionId || typeof auctionId !== 'string') {
    return NextResponse.json({ error: 'auctionId is required' }, { status: 400 })
  }

  try {
    // Server-side winner gate: only the holder of the auction's `won` bid may
    // prepare the auction contract.
    const repos = await getRepositories()
    const wonBid = await repos.find({
      collection: 'bids',
      where: {
        and: [
          { auction: { equals: auctionId } },
          { user: { equals: tokenPayload.userId } },
          { status: { equals: 'won' } },
        ],
      },
      limit: 1,
    })
    if (wonBid.docs.length === 0) {
      return NextResponse.json(
        { error: 'Lepingu koostamise õigus on ainult oksjoni võitjal.' },
        { status: 403 },
      )
    }

    const contract = await prepareContract(auctionId, 'auction', tokenPayload.userId)
    return NextResponse.json(contract, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare contract'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}