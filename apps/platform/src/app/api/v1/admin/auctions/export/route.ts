import { cookies } from 'next/headers'

import {
  auctionInScope,
  auctionScope,
  can,
  isStaffRole,
  PermissionDeniedError,
  type StaffRole,
} from '@/app/(admin)/_lib/permissions'
import { verifyAccessToken } from '@/lib/auth/jwt'
import type { WhereClause } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import {
  auctionObjectTypes,
  type AuctionObjectType,
  type AuctionStatus,
} from '@/lib/data/schema'

/**
 * Auctions list CSV export (design D2: file downloads keep routes, not
 * server actions). Mirrors the list page's shareable filters and the
 * requesting role's scope; `auctions:export` is required, so specialists
 * and sellers are denied at the same gate that hides the UI affordance.
 * The export writes an `auction.export` audit entry before responding.
 */

const MAX_ROWS = 5000

const CSV_COLUMNS: readonly string[] = [
  'ID',
  'Nimi',
  'Objekti tüüp',
  'Mehaanika',
  'Olek',
  'Maakond',
  'Alghind (EUR)',
  'Pakkumisi',
  'Lõppaeg',
  'Spetsialist',
  'Katastrid',
  'Registri numbrid',
  'Lõpphind (EUR)',
  'Tasu (%)',
]

const auctionStatusList: readonly AuctionStatus[] = [
  'draft',
  'scheduled',
  'active',
  'ended',
  'appraised',
  'unsold',
  'contract',
  'completed',
  'archived',
]

const objectTypeLabels: Record<AuctionObjectType, string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Metskinnistu',
  pakett: 'Pakett',
  kiire: 'Kiiroksjon',
}

function csvCell(value: string): string {
  return /[",\n\r;]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
}

function csvLine(cells: readonly string[]): string {
  return cells.map(csvCell).join(';')
}

function joinList(value: unknown): string {
  return Array.isArray(value) ? value.map((entry) => String(entry)).join(', ') : ''
}

function eur(cents: number | null | undefined): string {
  return typeof cents === 'number' ? (cents / 100).toFixed(2) : ''
}

/** Date-only bounds expand to full Europe/Tallinn days (same as the list page). */
function tallinnDayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T00:00:00+02:00`).toISOString()
}

function tallinnDayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T23:59:59+03:00`).toISOString()
}

function parseListParam(
  raw: string | null,
  allowed: readonly string[],
): string[] | null {
  if (raw === null) return null
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => allowed.includes(entry))
}

function freetextMatches(
  entry: { id: string; title: string; aliasEmail: string | null; cadastres: unknown; registryNumbers: unknown },
  q: string,
): boolean {
  const needle = q.toLowerCase()
  if (entry.id.toLowerCase() === needle) return true
  if (entry.title.toLowerCase().includes(needle)) return true
  if (entry.aliasEmail?.toLowerCase().includes(needle)) return true
  if (Array.isArray(entry.cadastres)) {
    if ((entry.cadastres as unknown[]).some((value) => String(value).toLowerCase().includes(needle))) {
      return true
    }
  }
  if (Array.isArray(entry.registryNumbers)) {
    if ((entry.registryNumbers as unknown[]).some((value) => String(value).toLowerCase().includes(needle))) {
      return true
    }
  }
  return false
}

export async function GET(request: Request): Promise<Response> {
  const token = (await cookies()).get('access_token')?.value
  const payload = token ? verifyAccessToken(token) : null
  if (!payload || !isStaffRole(payload.role)) {
    return new Response('Sisselogimine on nõutav.', { status: 401 })
  }
  const role: StaffRole = payload.role
  try {
    if (!can(role, 'auctions:export')) {
      return new Response('Teil puudub õigus eksportida oksjonite loendit.', { status: 403 })
    }
  } catch (error) {
    if (error instanceof PermissionDeniedError) {
      return new Response(error.message, { status: 403 })
    }
    throw error
  }

  const params = new URL(request.url).searchParams
  const statusFilter = parseListParam(params.get('status'), auctionStatusList) as
    | AuctionStatus[]
    | null
  // A present-but-empty type list (empty tab bucket) exports zero rows.
  const typeRaw = params.get('type')
  const typeFilter: AuctionObjectType[] | null =
    typeRaw === null
      ? null
      : typeRaw
          .split(',')
          .map((entry) => entry.trim())
          .filter((entry): entry is AuctionObjectType =>
            (auctionObjectTypes as readonly string[]).includes(entry),
          )
  const auctionTypeFilter = params.get('auctionType')
  const specialistFilter = params.get('specialist')
  const countyFilter = params.get('county')
  const endFromIso = tallinnDayStartIso(params.get('endFrom') ?? '')
  const endToIso = tallinnDayEndIso(params.get('endTo') ?? '')
  const q = (params.get('q') ?? '').trim()
  const selectionRaw = params.get('ids')
  const selection =
    selectionRaw !== null && selectionRaw.trim() !== ''
      ? selectionRaw.split(',').map((entry) => entry.trim()).filter((entry) => entry !== '')
      : null

  // System-context reads: drafts and ended lots never pass the public read
  // guard, but the authenticated exporter may see them (scope enforced here).
  const repositories = await getRepositories()

  const scope = auctionScope(role, payload.userId)
  const whereParts: WhereClause[] = []
  if (scope.kind === 'assigned-specialist') {
    whereParts.push({ specialist: { equals: scope.specialistId } })
  } else if (scope.kind === 'own-seller') {
    whereParts.push({ seller: { equals: scope.sellerId } })
  } else if (specialistFilter) {
    whereParts.push({ specialist: { equals: specialistFilter } })
  }
  if (statusFilter !== null && statusFilter.length > 0) {
    whereParts.push({ status: { in: statusFilter } })
  }
  if (typeFilter !== null && typeFilter.length > 0) {
    whereParts.push({ objectType: { in: typeFilter } })
  }
  if (auctionTypeFilter === 'open' || auctionTypeFilter === 'sealed') {
    whereParts.push({ type: { equals: auctionTypeFilter } })
  }
  if (countyFilter) {
    whereParts.push({ county: { equals: countyFilter } })
  }

  const { docs } = await repositories.find({
    collection: 'auctions',
    ...(whereParts.length > 0 ? { where: { and: whereParts } satisfies WhereClause } : {}),
    sort: '-createdAt',
    pagination: false,
    limit: MAX_ROWS,
  })

  const filtered = docs.filter((doc) => {
    if (endFromIso && (!doc.endsAt || doc.endsAt < endFromIso)) return false
    if (endToIso && (!doc.endsAt || doc.endsAt > endToIso)) return false
    if (selection !== null && !selection.includes(doc.id)) return false
    if (q !== '') {
      if (
        !freetextMatches(
          {
            id: doc.id,
            title: doc.title,
            aliasEmail: doc.aliasEmail,
            cadastres: doc.cadastres,
            registryNumbers: doc.registryNumbers,
          },
          q,
        )
      ) {
        return false
      }
    }
    return auctionInScope(scope, { specialistId: doc.specialistId, sellerId: doc.sellerId })
  })

  const countyDocs = await repositories.find({
    collection: 'counties',
    sort: 'name',
    pagination: false,
    limit: 100,
  })
  const countyNames = new Map(countyDocs.docs.map((doc) => [doc.id, doc.name]))

  const specialistUsers = await repositories.find({
    collection: 'users',
    where: { role: { equals: 'specialist' } },
    sort: 'name',
    pagination: false,
    limit: 200,
  })
  const specialistNames = new Map(
    specialistUsers.docs.map((doc) => [doc.id, doc.name ?? doc.email]),
  )

  const settingsDocs = await repositories.find({ collection: 'settings', limit: 1 })
  const globalFeePercent = settingsDocs.docs[0]?.feePercent ?? null

  const bidCounts = new Map<string, number>()
  if (filtered.length > 0) {
    const bids = await repositories.find({
      collection: 'bids',
      where: { auction: { in: filtered.map((doc) => doc.id) } },
      pagination: false,
      limit: MAX_ROWS,
    })
    for (const bid of bids.docs) {
      bidCounts.set(bid.auctionId, (bidCounts.get(bid.auctionId) ?? 0) + 1)
    }
  }

  const lines: string[] = [csvLine(CSV_COLUMNS)]
  for (const doc of filtered) {
    const feePercent = doc.feeOverridePercent ?? globalFeePercent
    lines.push(
      csvLine([
        doc.id,
        doc.title,
        objectTypeLabels[doc.objectType],
        doc.type === 'sealed' ? 'Suletud' : 'Avatud',
        doc.status,
        doc.countyId ? (countyNames.get(doc.countyId) ?? '') : '',
        eur(doc.minBidCents),
        String(bidCounts.get(doc.id) ?? 0),
        doc.endsAt ?? '',
        doc.specialistId ? (specialistNames.get(doc.specialistId) ?? '') : '',
        joinList(doc.cadastres),
        joinList(doc.registryNumbers),
        eur(doc.finalPriceCents),
        typeof feePercent === 'number' ? String(feePercent) : '',
      ]),
    )
  }

  // The export event is itself logged (registry docs 14); the audit entry
  // precedes the response.
  await repositories.create({
    collection: 'audit-entry',
    data: {
      actorId: payload.userId,
      action: 'auction.export',
      entityType: 'auction',
      entityId: 'list',
      after: {
        rowCount: filtered.length,
        ...(selection !== null ? { selection } : {}),
        filters: {
          ...(statusFilter !== null && statusFilter.length > 0 ? { status: statusFilter } : {}),
          ...(typeFilter !== null ? { type: typeFilter } : {}),
          ...(auctionTypeFilter ? { auctionType: auctionTypeFilter } : {}),
          ...(specialistFilter ? { specialist: specialistFilter } : {}),
          ...(countyFilter ? { county: countyFilter } : {}),
          ...(endFromIso ? { endFrom: endFromIso } : {}),
          ...(endToIso ? { endTo: endToIso } : {}),
          ...(q !== '' ? { q } : {}),
        },
      },
    },
  })

  const csv = `\uFEFF${lines.join('\r\n')}\r\n`
  const today = new Date().toISOString().slice(0, 10)
  return new Response(csv, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="oksjonid-${today}.csv"`,
      'cache-control': 'no-store',
    },
  })
}
