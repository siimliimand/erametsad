import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import type { NotificationDoc } from '@/lib/data/repositories/registry'
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

function toNotificationDto(doc: NotificationDoc) {
  return {
    id: doc.id,
    category: doc.event,
    channel: doc.channel,
    title: doc.title,
    body: doc.body,
    payload: doc.payload ?? null,
    readAt: doc.readAt,
    sentAt: doc.sentAt,
    createdAt: doc.createdAt,
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const userId = await authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const { id } = await params

  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'notifications',
    where: { and: [{ id: { equals: id } }, { userId: { equals: userId } }] },
    limit: 1,
  })
  const doc = result.docs[0]
  if (!doc) {
    return NextResponse.json({ error: 'Teavitust ei leitud' }, { status: 404 })
  }

  // Idempotent: an already-read notification keeps its original readAt.
  if (doc.readAt) {
    return NextResponse.json(toNotificationDto(doc))
  }

  const updated = await repos.update({
    collection: 'notifications',
    id,
    data: { readAt: new Date().toISOString() },
  })

  return NextResponse.json(toNotificationDto(updated))
}
