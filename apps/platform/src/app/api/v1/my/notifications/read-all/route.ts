import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'

async function authenticate(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload.userId
}

export async function PATCH(request: NextRequest) {
  const userId = await authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const repos = await getRepositories()
  const unread = await repos.find({
    collection: 'notifications',
    where: { userId: { equals: userId }, readAt: { exists: false } },
    pagination: false,
  })

  const readAt = new Date().toISOString()
  for (const doc of unread.docs) {
    await repos.update({ collection: 'notifications', id: doc.id, data: { readAt } })
  }

  return NextResponse.json({ unreadCount: 0 })
}
