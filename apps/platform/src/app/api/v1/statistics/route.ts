import { NextResponse } from 'next/server'

import { computeStats } from '@/lib/stats/aggregation'

export async function GET(): Promise<NextResponse> {
  const stats = await computeStats()
  return NextResponse.json(stats)
}