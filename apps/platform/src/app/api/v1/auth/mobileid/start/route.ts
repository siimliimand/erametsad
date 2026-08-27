import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { getEidProvider } from '@/lib/auth/eid-provider'

export const runtime = 'edge'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const isikukood = body.isikukood as string | undefined

  if (!isikukood) {
    return NextResponse.json({ error: 'isikukood is required' }, { status: 400 })
  }

  try {
    const provider = getEidProvider('mobileid')
    const result = await provider.start(isikukood)
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 401 },
    )
  }
}