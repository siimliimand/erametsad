import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { signContract } from '@/lib/contracts/service'

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

  const contractId = body.contractId as string | undefined
  if (!contractId || typeof contractId !== 'string') {
    return NextResponse.json({ error: 'contractId is required' }, { status: 400 })
  }

  try {
    const contract = await signContract(contractId)
    return NextResponse.json(contract)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to sign contract'
    const status = message.includes('expired') ? 410 : message.includes('signed') || message.includes('cannot') ? 400 : 400
    return NextResponse.json({ error: message }, { status })
  }
}