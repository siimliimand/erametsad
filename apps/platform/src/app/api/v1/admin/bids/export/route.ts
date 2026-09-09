import { cookies } from 'next/headers'

import {
  buildBidExportRows,
  buildBidsCsv,
  buildBidsExportFilename,
  type BidExportContext,
} from './_lib/bids-export'

import {
  auctionInScope,
  auctionScope,
  can,
  isStaffRole,
  type StaffRole,
} from '@/app/(admin)/_lib/permissions'
import { verifyAccessToken } from '@/lib/auth/jwt'
import { getRepositories } from '@/lib/data/runtime'

export const dynamic = 'force-dynamic'

/**
 * Per-auction bids CSV export ("Ekspordi pakkumiste logi", task 6.1; D2
 * keeps file downloads on routes, not server actions). Gated on
 * `bids:write` — sellers are denied because the log carries ip_hash
 * anti-fraud evidence — and scoped like the monitor: specialists only
 * export their own lots. Bidder identity columns stay blank unless the
 * exporter is an admin; the export writes a `bid.export` audit entry
 * carrying the row count before the response.
 */

const MAX_ROWS = 5000

export async function GET(request: Request): Promise<Response> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload || !isStaffRole(payload.role)) {
    return new Response('Sisselogimine on nõutav.', { status: 401 })
  }
  const role: StaffRole = payload.role
  if (!can(role, 'bids:write')) {
    return new Response('Teil puudub õigus eksportida pakkumiste logi.', { status: 403 })
  }

  const auctionId = new URL(request.url).searchParams.get('auction')?.trim() ?? ''
  if (auctionId === '') {
    return new Response('Oksjoni identifikaator puudub.', { status: 400 })
  }

  // Post-scope trusted reads: the operator is authenticated and scoped to
  // the auction below, so the whole lot's bid log may load (the guard
  // matrix would otherwise bind bid reads to the reader's own bids).
  const trusted = await getRepositories()
  const auction = await trusted
    .findByID({ collection: 'auctions', id: auctionId })
    .catch(() => null)
  if (!auction) {
    return new Response('Oksjonit ei leitud.', { status: 404 })
  }
  const scope = auctionScope(role, payload.userId)
  if (!auctionInScope(scope, { specialistId: auction.specialistId, sellerId: auction.sellerId })) {
    return new Response('Oksjon ei ole teie tööulatuses.', { status: 403 })
  }

  const bidsResult = await trusted.find({
    collection: 'bids',
    where: { auction: { equals: auctionId } },
    sort: 'createdAt',
    pagination: false,
    limit: MAX_ROWS,
  })

  // Feed-local alias numbering, oldest bid first — same derivation as the
  // monitor feed, so exported labels match what the operator saw.
  const aliasByUserId = new Map<string, number>()
  for (const bid of bidsResult.docs) {
    if (aliasByUserId.has(bid.userId)) continue
    aliasByUserId.set(bid.userId, aliasByUserId.size + 1)
  }

  const includeIdentity = role === 'admin' || role === 'superadmin'
  const nameByUserId = new Map<string, string>()
  if (includeIdentity && aliasByUserId.size > 0) {
    const usersResult = await trusted.find({
      collection: 'users',
      where: { id: { in: [...aliasByUserId.keys()] } },
      pagination: false,
      limit: aliasByUserId.size,
    })
    for (const user of usersResult.docs) {
      nameByUserId.set(user.id, user.name ?? user.email)
    }
  }

  const context: BidExportContext = { aliasByUserId, nameByUserId, includeIdentity }
  const rows = buildBidExportRows(bidsResult.docs, context)

  // The export event is itself logged (registry docs 14); the audit entry
  // precedes the response.
  await trusted.create({
    collection: 'audit-entry',
    data: {
      actorId: payload.userId,
      action: 'bid.export',
      entityType: 'bid',
      entityId: auctionId,
      after: {
        auctionId,
        rowCount: rows.length,
        includeIdentity,
      },
    },
  })

  const csv = buildBidsCsv(rows)
  const filename = buildBidsExportFilename(auctionId, new Date())
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
}
