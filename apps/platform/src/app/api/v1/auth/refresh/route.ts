import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  clearSessionCookies,
  refreshSession,
  setSessionCookies,
} from '@/lib/auth/session'

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value
  if (!refreshToken) {
    return NextResponse.json(
      { error: 'Autentimine ebaõnnestus' },
      { status: 401 },
    )
  }

  const rotated = await refreshSession(refreshToken)
  if (!rotated) {
    // Covers both unknown tokens and reuse detection; either way the
    // family is dead and the client must drop its cookies.
    const response = NextResponse.json(
      { error: 'Autentimine ebaõnnestus' },
      { status: 401 },
    )
    clearSessionCookies(response)
    return response
  }

  const response = NextResponse.json({ accessToken: rotated.accessToken })
  setSessionCookies(response, rotated.accessToken, rotated.refreshToken)
  return response
}
