import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getEidProvider } from '@/lib/auth/eid-provider'

export async function GET(request: NextRequest) {
  const sessionRef = request.nextUrl.searchParams.get('sessionRef')

  if (!sessionRef) {
    return NextResponse.json(
      { error: 'sessionRef query parameter is required' },
      { status: 400 },
    )
  }

  const provider = getEidProvider('idcard')
  const result = await provider.status(sessionRef)

  return NextResponse.json(result)
}