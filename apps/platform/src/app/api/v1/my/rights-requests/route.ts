import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { getRepositories } from '@/lib/data/runtime'
import { auctionObjectTypes } from '@/lib/data/schema'
import type { AuctionObjectType, RightsRequest } from '@/lib/data/schema'

async function authenticate(request: NextRequest): Promise<AccessTokenPayload | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload
}

function isAuctionObjectType(value: unknown): value is AuctionObjectType {
  return typeof value === 'string' && (auctionObjectTypes as readonly string[]).includes(value)
}

function toPublicRequest(row: RightsRequest): Record<string, unknown> {
  return {
    id: row.id,
    user: row.userId,
    objectType: row.objectType,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function POST(request: NextRequest) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Vigased andmed' }, { status: 400 })
  }

  if (!isAuctionObjectType(body.objectType)) {
    return NextResponse.json({ error: 'Vale objektitüüp' }, { status: 400 })
  }
  const objectType = body.objectType

  // 'rights-request' has no guard rules yet (admin approval is phase 5);
  // the unguarded repository is acceptable because every read and write
  // below is scoped to the verified caller id.
  const repos = await getRepositories()

  const pending = await repos.find({
    collection: 'rights-request',
    where: {
      and: [
        { user: { equals: payload.userId } },
        { objectType: { equals: objectType } },
        { status: { equals: 'pending' } },
      ],
    },
    limit: 1,
  })
  if (pending.docs.length > 0) {
    return NextResponse.json(
      { error: 'Selle objektitüübi taotlus on juba menetluses' },
      { status: 409 },
    )
  }

  const created = await repos.create({
    collection: 'rights-request',
    data: { user: payload.userId, objectType, status: 'pending' },
  })

  return NextResponse.json(toPublicRequest(created), { status: 201 })
}
