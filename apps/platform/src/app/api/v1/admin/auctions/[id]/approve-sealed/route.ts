import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isAdminRole, verifyAccessToken } from '@/lib/auth/jwt'
import { approveOpeningSession } from '@/lib/bidding/sealed-opening'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const accessToken = request.cookies.get('access_token')?.value
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const tokenPayload = verifyAccessToken(accessToken)
  if (!tokenPayload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 })
  }
  if (!isAdminRole(tokenPayload.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // The session itself carries the auction binding, so the path id is not
  // needed to route the approval.
  void params

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const sessionId = body.sessionId as string | undefined
  const approvalToken = body.approvalToken as string | undefined
  if (!sessionId || typeof sessionId !== 'string' || !approvalToken || typeof approvalToken !== 'string') {
    return NextResponse.json({ error: 'sessionId and approvalToken are required' }, { status: 400 })
  }

  try {
    const result = await approveOpeningSession(sessionId, approvalToken, accessToken)
    return NextResponse.json(result, { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
