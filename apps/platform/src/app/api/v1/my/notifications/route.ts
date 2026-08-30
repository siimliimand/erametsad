import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { NotificationDoc } from '@/lib/data/repositories/registry'
import { getRepositories } from '@/lib/data/runtime'
import type { WhereClause } from '@/lib/data/repositories/where'

const PAGE_SIZE = 25

function authenticate(request: NextRequest): string | null {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null
  return verifyAccessToken(token)?.userId ?? null
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

export async function GET(request: NextRequest) {
  const userId = authenticate(request)
  if (!userId) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const searchParams = request.nextUrl.searchParams
  const category = searchParams.get('category')
  const unreadOnly = searchParams.get('unread') === '1'
  const cursor = searchParams.get('cursor')

  const where: WhereClause = {
    userId: { equals: userId },
    ...(category ? { event: { equals: category } } : {}),
    ...(unreadOnly ? { readAt: { exists: false } } : {}),
    ...(cursor ? { createdAt: { less_than_equal: cursor } } : {}),
  }

  const repos = await getRepositories()
  const [page, unread] = await Promise.all([
    repos.find({
      collection: 'notifications',
      where,
      sort: '-createdAt',
      limit: PAGE_SIZE + 1,
    }),
    repos.find({
      collection: 'notifications',
      where: { userId: { equals: userId }, readAt: { exists: false } },
      pagination: false,
    }),
  ])

  const hasNextPage = page.docs.length > PAGE_SIZE
  const items = page.docs.slice(0, PAGE_SIZE)
  const nextCursor = hasNextPage ? (items[items.length - 1]?.createdAt ?? null) : null

  return NextResponse.json({
    items: items.map(toNotificationDto),
    nextCursor,
    unreadCount: unread.docs.length,
  })
}
