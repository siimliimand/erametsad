import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { completeEidLogin } from '@/lib/auth/eid-provider'

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const sessionRef = body.sessionRef as string | undefined

  if (!sessionRef) {
    return NextResponse.json({ error: 'sessionRef is required' }, { status: 400 })
  }

  return completeEidLogin('idcard', sessionRef)
}
