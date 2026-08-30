import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import { verifyAccessToken } from '@/lib/auth/jwt'
import type { AccessTokenPayload } from '@/lib/auth/jwt'
import { resolveAccessTokenSession } from '@/lib/auth/session'
import { getRepositories, sessionGuardContext } from '@/lib/data/runtime'
import { auctionObjectTypes } from '@/lib/data/schema'
import type { AuctionRight } from '@/lib/data/schema'

async function authenticate(request: NextRequest): Promise<AccessTokenPayload | null> {
  const token = request.cookies.get('access_token')?.value
  if (!token) return null

  const payload = verifyAccessToken(token)
  if (!payload) return null

  const ref = await resolveAccessTokenSession(token)
  if (ref.state === 'revoked') return null

  return payload
}

export async function GET(request: NextRequest) {
  const payload = await authenticate(request)
  if (!payload) {
    return NextResponse.json({ error: 'Autentimine ebaõnnestus' }, { status: 401 })
  }

  const repos = await getRepositories(sessionGuardContext(payload))
  const { docs } = await repos.find({
    collection: 'auction-rights',
    where: { user: { equals: payload.userId } },
    sort: '-grantedAt',
  })

  // Newest row per object type decides; a revoked row means no active right.
  const latest = new Map<string, AuctionRight>()
  for (const right of docs) {
    if (!latest.has(right.objectType)) {
      latest.set(right.objectType, right)
    }
  }

  const rights = auctionObjectTypes.map((objectType) => {
    const row = latest.get(objectType)
    return {
      objectType,
      granted: row?.revokedAt === null,
      grantedAt: row?.grantedAt ?? null,
      revokedAt: row?.revokedAt ?? null,
    }
  })

  return NextResponse.json({ rights })
}
