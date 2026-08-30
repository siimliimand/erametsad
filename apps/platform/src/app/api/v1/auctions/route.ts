import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  AuctionQueryError,
  listAuctionMapPoints,
  listAuctions,
} from '@/lib/auction/queries'
import { getRepositories } from '@/lib/data/runtime'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  try {
    const repos = await getRepositories()
    if (searchParams.get('map') === '1') {
      const auctions = await listAuctionMapPoints(repos, searchParams)
      return NextResponse.json({ auctions })
    }
    return NextResponse.json(await listAuctions(repos, searchParams))
  } catch (error) {
    if (error instanceof AuctionQueryError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[auctions/list] query failed', error)
    return NextResponse.json({ error: 'Serveri viga' }, { status: 500 })
  }
}
