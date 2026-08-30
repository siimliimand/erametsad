import { NextResponse } from 'next/server'

import { ingestAuctionEvent } from '@/lib/realtime/auction-stream'

/**
 * Fan-out bridge: the AuctionDO POSTs each auction event to every
 * registered subscriber URL, and this route is where those POSTs land.
 *
 * A miss answers 202, never 4xx: the DO prunes subscriber URLs on
 * status >= 400, and a POST that lands on an isolate that does not hold
 * this subscription id must not evict a live stream. Stream
 * cancellation sends the authoritative unsubscribe.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ subscriptionId: string }> },
) {
  const { subscriptionId } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ delivered: false }, { status: 202 })
  }

  const delivered = ingestAuctionEvent(subscriptionId, body)
  return NextResponse.json({ delivered }, { status: delivered ? 200 : 202 })
}
