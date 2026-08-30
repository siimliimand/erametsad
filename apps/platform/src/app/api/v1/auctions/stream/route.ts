import { getRepositories } from '@/lib/data/runtime'
import { createAuctionFeedStream, createAuctionStream } from '@/lib/realtime/auction-stream'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

async function activeAuctionIds(): Promise<string[]> {
  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'auctions',
    where: { status: { equals: 'active' } },
    sort: 'endsAt',
    limit: 50,
  })
  return (result.docs as Record<string, unknown>[])
    .map((doc) => (typeof doc.id === 'string' ? doc.id : ''))
    .filter((id) => id.length > 0)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const auctionId = url.searchParams.get('auction')

  try {
    const stream =
      auctionId !== null && auctionId.length > 0
        ? await createAuctionStream(auctionId, { origin })
        : await createAuctionFeedStream(await activeAuctionIds(), { origin })

    return new Response(stream, { headers: SSE_HEADERS })
  } catch {
    return new Response('Auction stream unavailable', { status: 502 })
  }
}
