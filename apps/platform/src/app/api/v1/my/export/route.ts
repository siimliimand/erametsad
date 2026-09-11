import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { buildExportZip, buildUserExportEntries, exportRateLimiter, exportZipFilename } from './export-data'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'

async function authenticate(
  request: NextRequest,
): Promise<{ userId: string; sessionId: string | null } | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return { userId: payload.userId, sessionId: ref.state === 'active' ? ref.sessionId : null }
}

export async function GET(request: NextRequest): Promise<Response> {
  const auth = await authenticate(request)
  if (!auth) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const limit = exportRateLimiter.check(`export:${auth.userId}`)
  if (!limit.allowed) {
    return NextResponse.json({ error: 'Liiga palju päringuid' }, { status: 429 })
  }

  const repos = await getRepositories()
  const entries = await buildUserExportEntries(repos, auth.userId, auth.sessionId)
  if (!entries) {
    return NextResponse.json({ error: 'Kasutajat ei leitud' }, { status: 404 })
  }

  return new Response(buildExportZip(entries), {
    headers: {
      'content-type': 'application/zip',
      'content-disposition': `attachment; filename="${exportZipFilename()}"`,
      'cache-control': 'no-store',
    },
  })
}
