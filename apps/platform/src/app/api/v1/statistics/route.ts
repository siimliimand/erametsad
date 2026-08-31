import { unstable_cache } from 'next/cache'
import { NextResponse } from 'next/server'

import { computeStats, type StatisticsResult } from '@/lib/stats/aggregation'

// Mirrors (marketing)/_components/TrustStats.tsx: the aggregate read is
// cached for 24h so the route does not recompute per visitor, and a D1
// failure degrades to a retryable response instead of a 500.
const getCachedStats = unstable_cache(
  async (): Promise<StatisticsResult[]> => computeStats(),
  ['api-v1-statistics'],
  { revalidate: 86_400 },
)

export async function GET(): Promise<NextResponse> {
  try {
    const stats = await getCachedStats()
    return NextResponse.json(stats, {
      headers: {
        'cache-control': 'public, s-maxage=86400, stale-while-revalidate=86400',
      },
    })
  } catch {
    return NextResponse.json(
      { error: 'Statistika pole praegu saadaval.' },
      { status: 503 },
    )
  }
}
