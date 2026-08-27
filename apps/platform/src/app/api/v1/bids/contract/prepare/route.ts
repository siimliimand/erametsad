import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { prepareContract } from '@/lib/contracts/service'

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
    const contract = await prepareContract(auctionId, 'auction')
    return NextResponse.json(contract, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to prepare contract'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}