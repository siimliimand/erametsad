import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { isAdminRole, verifyAccessToken } from '@/lib/auth/jwt'
import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import type { AuditEntryDoc } from '@/lib/data/repositories/registry'
import { getRepositories } from '@/lib/data/runtime'
import { pushNotification } from '@/lib/realtime/my-stream'

const MAX_MESSAGE_LENGTH = 1000

async function authenticate(request: NextRequest): Promise<AccessTokenPayload | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload
}

function readMessage(body: Record<string, unknown>): string | null | undefined {
  if (body.message === undefined) return undefined
  if (typeof body.message !== 'string') return null
  const message = body.message.trim()
  if (message.length === 0) return undefined
  if (message.length > MAX_MESSAGE_LENGTH) return null
  return message
}

function isPendingRequest(entry: AuditEntryDoc): boolean {
  const after = entry.after
  return (
    typeof after === 'object' &&
    after !== null &&
    (after as { status?: unknown }).status === 'pending'
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const { id: auctionId } = await params

  let body: Record<string, unknown> = {}
  try {
    const parsed: unknown = await request.json()
    if (parsed !== null && typeof parsed === 'object') {
      body = parsed as Record<string, unknown>
    }
  } catch {
    body = {}
  }
  const message = readMessage(body)
  if (message === null) {
    return NextResponse.json({ error: 'Vigased andmed' }, { status: 400 })
  }

  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'auctions',
    where: { id: { equals: auctionId } },
    limit: 1,
  })
  const auction = result.docs[0]
  if (!auction) {
    return NextResponse.json({ error: 'Oksjonit ei leitud' }, { status: 404 })
  }
  if (auction.sellerId !== payload.userId && !isAdminRole(payload.role)) {
    return NextResponse.json(
      { error: 'Puudub õigus selle oksjoni haldamiseks' },
      { status: 403 },
    )
  }

  // "Saada spetsialistile" applies to a draft only; the specialist review
  // flow moves a draft towards scheduling.
  if (auction.status !== 'draft') {
    return NextResponse.json(
      { error: 'Spetsialistile saab saata ainult mustandis oksjoni' },
      { status: 409 },
    )
  }

  const existing = await repos.find({
    collection: 'audit-entry',
    where: {
      and: [
        { action: { equals: 'review_request' } },
        { entityType: { equals: 'auction' } },
        { entityId: { equals: auctionId } },
      ],
    },
    pagination: false,
  })
  if (existing.docs.some(isPendingRequest)) {
    return NextResponse.json({ error: 'Taotlus on juba menetluses' }, { status: 409 })
  }

  const entry = await repos.create({
    collection: 'audit-entry',
    data: {
      actorId: payload.userId,
      action: 'review_request',
      entityType: 'auction',
      entityId: auctionId,
      before: { status: auction.status },
      after: {
        status: 'pending',
        auctionTitle: auction.title,
        specialistId: auction.specialistId,
        ...(message !== undefined ? { message } : {}),
      },
    },
  })

  const now = new Date().toISOString()
  const notification = await repos.create({
    collection: 'notifications',
    data: {
      userId: payload.userId,
      event: 'auction.review_requested',
      channel: 'in_app',
      title: 'Mustand on saadetud spetsialistile',
      body: `Oksjoni "${auction.title}" mustand on saadetud spetsialistile ülevaatamiseks.`,
      payload: { auctionId, requestId: entry.id },
      sentAt: now,
    },
  })
  pushNotification(payload.userId, {
    notificationId: notification.id,
    event: 'auction.review_requested',
    title: 'Mustand on saadetud spetsialistile',
    body: `Oksjoni "${auction.title}" mustand on saadetud spetsialistile ülevaatamiseks.`,
    sentAt: now,
  })

  return NextResponse.json(
    { success: true, requestId: entry.id, status: 'pending' },
    { status: 201 },
  )
}
