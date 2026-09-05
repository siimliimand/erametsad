import { cookies } from 'next/headers'

import {
  auctionInScope,
  auctionScope,
  can,
  isStaffRole,
  type StaffRole,
} from '@/app/(admin)/_lib/permissions'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { getRepositories } from '@/lib/data/runtime'
import { createAuctionFeedStream, createAuctionStream } from '@/lib/realtime/auction-stream'

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

async function activeAuctionIds(): Promise<string[]> {
  const repos = await getRepositories()
  const result = await repos.find({
    collection: 'auctions',
    where: { status: { equals: 'active' } },
    sort: 'endsAt',
    limit: 50,
  })
  return (result.docs as Record<string, unknown>[])
    .map((doc) => (typeof doc.id === 'string' ? doc.id : ''))
    .filter((id) => id.length > 0)
}

/**
 * Admin-scope opt-in (`scope=admin`): verifies the access_token cookie the
 * same way the admin guard does, then requires a staff role plus a read
 * permission for the monitored surface. Scoped roles (specialist, seller)
 * may only stream a specific auction that is inside their lot scope; the
 * cross-auction feed stays an admin/superadmin surface. The portal branch
 * below is untouched.
 */
async function authorizeAdminScope(
  auctionId: string | null,
): Promise<{ ok: true; userId: string; role: StaffRole } | { ok: false; status: 401 | 403 | 404 }> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload || !isStaffRole(payload.role)) {
    return { ok: false, status: 401 }
  }
  const role: StaffRole = payload.role
  if (!can(role, 'bids:read')) {
    return { ok: false, status: 403 }
  }
  const scope = auctionScope(role, payload.userId)
  if (auctionId === null) {
    if (scope.kind !== 'all') {
      return { ok: false, status: 403 }
    }
    return { ok: true, userId: payload.userId, role }
  }
  const repos = await getRepositories()
  const auction = await repos.findByID({ collection: 'auctions', id: auctionId }).catch(() => null)
  if (!auction) {
    return { ok: false, status: 404 }
  }
  if (
    !auctionInScope(scope, { specialistId: auction.specialistId, sellerId: auction.sellerId })
  ) {
    return { ok: false, status: 403 }
  }
  return { ok: true, userId: payload.userId, role }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const origin = url.origin
  const auctionId = url.searchParams.get('auction')

  if (url.searchParams.get('scope') === 'admin') {
    const auth = await authorizeAdminScope(
      auctionId !== null && auctionId.length > 0 ? auctionId : null,
    )
    if (!auth.ok) {
      return new Response('Auction stream not available for this scope', { status: auth.status })
    }
  }

  try {
    const stream =
      auctionId !== null && auctionId.length > 0
        ? await createAuctionStream(auctionId, { origin })
        : await createAuctionFeedStream(await activeAuctionIds(), { origin })

    return new Response(stream, { headers: SSE_HEADERS })
  } catch {
    return new Response('Auction stream unavailable', { status: 502 })
  }
}
