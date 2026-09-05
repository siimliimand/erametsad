import Link from 'next/link'
import type { ReactNode } from 'react'

import { IdentityRevealChip } from './_components/identity-chip'
import { approveUnderbidAction, rejectUnderbidAction } from '../../_actions/auctions'
import { DataTable, type DataTableColumn } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import {
  auctionStatusLabels,
  auctionTypeLabels,
  formatDateTime,
  formatRelativeTime,
  StatusPill,
} from '../../_lib/labels'
import { auctionInScope, auctionScope, can } from '../../_lib/permissions'
import { readAuctionDefaults } from '../content/_components/settings-audit'

import { getRepositories } from '@/lib/data/runtime'
import type { AuctionStatus } from '@/lib/data/schema'

/**
 * Global alapakkumine queue (docs/design/admin/04): cross-auction decisions
 * with SLA badges from the Settings seller-decision deadline. Rows carry
 * amounts, % of the minimum bid, relative submission times, and anonymized
 * labels only — identity travels exclusively through the audited reveal
 * chip. Sealed lots show no amounts anywhere. The oksjoniti view groups the
 * same rows into per-auction decision blocks.
 */

export const metadata = { title: 'Pakkumised' }

type RawParams = Record<string, string | string[] | undefined>

function firstParam(params: RawParams, key: string): string | undefined {
  const value = params[key]
  const first = Array.isArray(value) ? value[0] : value
  return first && first !== '' ? first : undefined
}

interface QueueRow {
  bidId: string
  auctionId: string
  auctionTitle: string
  auctionType: 'open' | 'sealed'
  auctionStatus: AuctionStatus
  countyName: string | null
  sellerName: string | null
  label: string
  amountEur: number
  percentOfMin: number | null
  submittedAt: string
  pendingHours: number
}

function pendingDuration(hours: number): string {
  if (hours < 48) return `${String(Math.floor(hours))} t`
  return `${String(Math.floor(hours / 24))} p`
}

/** Amber beyond the Settings deadline, red beyond twice the deadline. */
function slaBadge(
  pendingHours: number,
  deadlineDays: number,
): { label: string; tone: 'amber' | 'red' } | null {
  const deadlineHours = deadlineDays * 24
  if (pendingHours <= deadlineHours) return null
  if (pendingHours > deadlineHours * 2) {
    return { label: `${pendingDuration(pendingHours)} — tähtaeg 2× ületatud`, tone: 'red' }
  }
  return { label: `${pendingDuration(pendingHours)} — tähtaeg ületatud`, tone: 'amber' }
}

const slaToneClass: Record<'amber' | 'red', string> = {
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-danger-light text-danger',
}

export default async function AdminBidsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = await searchParams
  const { session, repositories } = await requireAdminRepositories()
  const role = session.role

  if (!can(role, 'bids:read')) {
    return <ErrorNotice message="Teil puudub õigus pakkumiste vaatamiseks." />
  }

  const typeFilter = firstParam(params, 'tüüp') ?? firstParam(params, 'type')
  const countyFilter = firstParam(params, 'county')
  const grouped = firstParam(params, 'vaade') === 'oksjonid'
  const viga = firstParam(params, 'viga')
  const teade = firstParam(params, 'teade')

  // SLA deadline comes from Settings (auctionDefaults, task 6.2).
  const settingsDocs = await repositories.find({ collection: 'settings', limit: 1 })
  const deadlineDays = readAuctionDefaults(settingsDocs.docs[0]).alapakkumineDecisionDeadlineDays

  const trusted = await getRepositories()

  const pendingResult = await trusted.find({
    collection: 'bids',
    where: { status: { equals: 'pending_approval' } },
    sort: 'createdAt',
    pagination: false,
    limit: 1000,
  })

  const auctionIds = [
    ...new Set(
      pendingResult.docs
        .map((bid) => bid.auctionId)
        .filter((auctionId) => auctionId !== ''),
    ),
  ]

  const auctionDocs =
    auctionIds.length > 0
      ? (
          await trusted.find({
            collection: 'auctions',
            where: { id: { in: auctionIds } },
            pagination: false,
            limit: auctionIds.length,
          })
        ).docs
      : []
  const auctionsById = new Map(auctionDocs.map((doc) => [doc.id, doc]))

  // Anonymized portal-consistent labels: per auction, bidders are numbered
  // by the order of their first bid.
  const allBids =
    auctionIds.length > 0
      ? (
          await trusted.find({
            collection: 'bids',
            where: { auction: { in: auctionIds } },
            sort: 'createdAt',
            pagination: false,
            limit: 5000,
          })
        ).docs
      : []
  const bidderNumber = new Map<string, number>()
  const seenBidders = new Map<string, string[]>()
  for (const bid of allBids) {
    const userId = bid.userId
    if (userId === '') continue
    const key = `${bid.auctionId}:${userId}`
    if (!bidderNumber.has(key)) {
      const seen = seenBidders.get(bid.auctionId) ?? []
      seen.push(userId)
      seenBidders.set(bid.auctionId, seen)
      bidderNumber.set(key, seen.length)
    }
  }

  const sellerIds = [
    ...new Set(
      auctionDocs
        .map((doc) => (typeof doc.sellerId === 'string' ? doc.sellerId : ''))
        .filter((sellerId) => sellerId !== ''),
    ),
  ]
  const sellerDocs =
    sellerIds.length > 0
      ? (
          await trusted.find({
            collection: 'users',
            where: { id: { in: sellerIds } },
            sort: 'name',
            pagination: false,
            limit: sellerIds.length,
          })
        ).docs
      : []
  const sellerNames = new Map(sellerDocs.map((doc) => [doc.id, doc.name ?? doc.email]))

  const countyDocs = await repositories.find({
    collection: 'counties',
    sort: 'name',
    pagination: false,
    limit: 100,
  })
  const countyNames = new Map(countyDocs.docs.map((doc) => [doc.id, doc.name]))

  const scope = auctionScope(role, session.userId)
  const now = Date.now()
  const rows: QueueRow[] = []
  for (const bid of pendingResult.docs) {
    const auction = auctionsById.get(bid.auctionId)
    if (!auction) continue
    if (
      !auctionInScope(scope, { specialistId: auction.specialistId, sellerId: auction.sellerId })
    ) {
      continue
    }
    if (typeFilter === 'open' || typeFilter === 'sealed') {
      if (auction.type !== typeFilter) continue
    }
    if (countyFilter && auction.countyId !== countyFilter) continue

    const bidderKey = `${auction.id}:${bid.userId}`
    const number = bidderNumber.get(bidderKey)
    const pendingHours = Math.max(0, (now - Date.parse(bid.createdAt)) / 3_600_000)
    rows.push({
      bidId: bid.id,
      auctionId: auction.id,
      auctionTitle: auction.title,
      auctionType: auction.type,
      auctionStatus: auction.status,
      countyName: auction.countyId ? (countyNames.get(auction.countyId) ?? null) : null,
      sellerName: typeof auction.sellerId === 'string' ? (sellerNames.get(auction.sellerId) ?? null) : null,
      label: number !== undefined ? `Pakkuja #${String(number)}` : 'Pakkuja #?',
      amountEur: bid.amountCents / 100,
      percentOfMin:
        auction.minBidCents > 0 ? Math.round((bid.amountCents / auction.minBidCents) * 100) : null,
      submittedAt: bid.createdAt,
      pendingHours,
    })
  }
  // Oldest first across the whole queue.
  rows.sort((a, b) => (a.submittedAt < b.submittedAt ? -1 : a.submittedAt > b.submittedAt ? 1 : 0))

  const redirectTo = (() => {
    const search = new URLSearchParams()
    if (typeFilter === 'open' || typeFilter === 'sealed') search.set('type', typeFilter)
    if (countyFilter) search.set('county', countyFilter)
    if (grouped) search.set('vaade', 'oksjonid')
    const qs = search.toString()
    return qs === '' ? '/admin/bids' : `/admin/bids?${qs}`
  })()

  const viewHref = (view: 'jarjekord' | 'oksjonid'): string => {
    const search = new URLSearchParams()
    if (typeFilter === 'open' || typeFilter === 'sealed') search.set('type', typeFilter)
    if (countyFilter) search.set('county', countyFilter)
    if (view === 'oksjonid') search.set('vaade', 'oksjonid')
    const qs = search.toString()
    return qs === '' ? '/admin/bids' : `/admin/bids?${qs}`
  }

  const filterSelectClass =
    'h-9 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink'

  const decisionCell = (row: QueueRow): ReactNode => {
    if (row.auctionStatus !== 'active') {
      return <span className="text-label text-ink-muted">Otsustamine ainult aktiivsel oksjonil</span>
    }
    return (
      <span className="flex flex-wrap items-center gap-sm">
        <form action={approveUnderbidAction}>
          <input type="hidden" name="auctionId" value={row.auctionId} />
          <input type="hidden" name="bidId" value={row.bidId} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button
            type="submit"
            className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
          >
            Nõustu
          </button>
        </form>
        <details className="relative">
          <summary className="cursor-pointer text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80">
            Keeldu põhjusega
          </summary>
          <form
            action={rejectUnderbidAction}
            className="mt-xs flex w-72 flex-col gap-xs rounded-card border border-border bg-bgPage p-sm shadow-md"
          >
            <input type="hidden" name="auctionId" value={row.auctionId} />
            <input type="hidden" name="bidId" value={row.bidId} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <label className="flex flex-col gap-xs text-label text-ink-muted">
              Keeldumise põhjus (kohustuslik, min 5 tähemärki)
              <textarea
                name="reason"
                required
                minLength={5}
                rows={2}
                className="rounded-input border border-border bg-bgPage px-2 py-1 text-bodySm text-ink"
                placeholder="Sisesta põhjus, mis edastatakse pakkujale"
              />
            </label>
            <button
              type="submit"
              className="rounded-button border border-danger px-3 py-1 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light"
            >
              Lükka tagasi
            </button>
          </form>
        </details>
      </span>
    )
  }

  const amountCell = (row: QueueRow): ReactNode =>
    row.auctionType === 'sealed' ? (
      <span title="Suletud oksjon — summad peitud kuni avamiseni">—</span>
    ) : (
      <span className="tabular-nums">{`${row.amountEur.toFixed(2)} €`}</span>
    )

  const percentCell = (row: QueueRow): ReactNode => {
    if (row.auctionType === 'sealed' || row.percentOfMin === null) return '—'
    return (
      <span
        className={`tabular-nums ${row.percentOfMin < 50 ? 'font-semibold text-danger' : ''}`}
      >
        {`${String(row.percentOfMin)} %`}
      </span>
    )
  }

  const slaCell = (row: QueueRow): ReactNode => {
    const badge = slaBadge(row.pendingHours, deadlineDays)
    return (
      <span className="flex items-center gap-xs">
        <time dateTime={row.submittedAt} title={formatDateTime(row.submittedAt)}>
          {formatRelativeTime(row.submittedAt, now)}
        </time>
        {badge !== null ? (
          <span
            className={`inline-flex items-center rounded-pill px-2 py-0.5 text-label font-semibold ${slaToneClass[badge.tone]}`}
          >
            {badge.label}
          </span>
        ) : null}
      </span>
    )
  }

  const queueColumns: readonly DataTableColumn<QueueRow>[] = [
    {
      key: 'auction',
      label: 'Oksjon',
      render: (row) => (
        <Link
          href={`/admin/auctions/${row.auctionId}/monitor`}
          className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
        >
          {row.auctionTitle}
          <span className="ml-1 text-ink-muted">
            ({auctionTypeLabels[row.auctionType]} · {auctionStatusLabels[row.auctionStatus]})
          </span>
        </Link>
      ),
    },
    {
      key: 'bidder',
      label: 'Pakkuja',
      render: (row) => (
        <span className="flex items-center gap-sm">
          <span className="font-semibold">{row.label}</span>
          <IdentityRevealChip bidId={row.bidId} />
        </span>
      ),
    },
    { key: 'amount', label: 'Summa', render: amountCell },
    { key: 'percent', label: '% alghinnast', render: percentCell },
    { key: 'sla', label: 'Esitatud · ootel', render: slaCell },
    { key: 'seller', label: 'Müüja', render: (row) => row.sellerName ?? '—' },
    { key: 'actions', label: 'Tegevused', render: decisionCell },
  ]

  const perAuctionColumns: readonly DataTableColumn<QueueRow>[] = queueColumns.filter(
    (column) => column.key !== 'auction',
  )

  const groupedRows = (() => {
    const byAuction = new Map<string, QueueRow[]>()
    for (const row of rows) {
      const list = byAuction.get(row.auctionId) ?? []
      list.push(row)
      byAuction.set(row.auctionId, list)
    }
    return [...byAuction.entries()]
  })()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div
          role="status"
          className="mb-md rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
        >
          {teade}
        </div>
      ) : null}
      <PageHeader
        title="Alapakkumised"
        description={`Müüja otsuse tähtaeg: ${String(deadlineDays)} päeva (Seaded). Kollane märgib tähtaja ületamist, punane kahekordset ületamist.`}
        actions={
          <nav aria-label="Vaade" className="flex items-center gap-xs">
            <Link
              href={viewHref('jarjekord')}
              aria-current={!grouped ? 'page' : undefined}
              className={`rounded-pill border px-3 py-1 text-label font-semibold ${
                !grouped ? 'border-primary bg-primary-light text-primaryDark' : 'border-border text-ink-muted'
              }`}
            >
              Järjekord
            </Link>
            <Link
              href={viewHref('oksjonid')}
              aria-current={grouped ? 'page' : undefined}
              className={`rounded-pill border px-3 py-1 text-label font-semibold ${
                grouped ? 'border-primary bg-primary-light text-primaryDark' : 'border-border text-ink-muted'
              }`}
            >
              Oksjoniti
            </Link>
          </nav>
        }
      />

      <form method="get" action="/admin/bids" className="mb-md flex flex-wrap items-center gap-sm rounded-card border border-border bg-bgPage p-md">
        {grouped ? <input type="hidden" name="vaade" value="oksjonid" /> : null}
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Mehaanika
          <select name="type" className={filterSelectClass} defaultValue={typeFilter ?? ''}>
            <option value="">Kõik</option>
            <option value="open">Avatud</option>
            <option value="sealed">Suletud</option>
          </select>
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Maakond
          <select name="county" className={filterSelectClass} defaultValue={countyFilter ?? ''}>
            <option value="">Kõik</option>
            {countyDocs.docs.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-button border border-border px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
        >
          Filtreeri
        </button>
        <span className="text-bodySm text-ink-muted">
          Suletud oksjonitel summasid ei näidata. Pakkuja identiteet avatakse ainult läbi auditeeritud
          kuviku (logitakse <code>user.identity_view</code>).
        </span>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-ink-muted">
          Ootel alapakkumisi ei ole.
        </div>
      ) : grouped ? (
        <div className="space-y-md">
          {groupedRows.map(([auctionId, auctionRows]) => {
            const first = auctionRows[0]
            if (first === undefined) return null
            return (
              <section key={auctionId} className="rounded-card border border-border bg-bgPage p-md">
                <header className="mb-sm flex flex-wrap items-center gap-sm">
                  <Link
                    href={`/admin/auctions/${auctionId}/monitor`}
                    className="font-heading text-h4 font-bold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
                  >
                    {first.auctionTitle}
                  </Link>
                  <StatusPill status={first.auctionStatus} />
                  <span className="text-label text-ink-muted">
                    {auctionTypeLabels[first.auctionType]}
                    {first.countyName !== null ? ` · ${first.countyName}` : ''}
                  </span>
                  <span className="rounded-pill bg-info-light px-2 py-0.5 text-label font-semibold text-info">
                    {String(auctionRows.length)} ootel
                  </span>
                </header>
                <DataTable columns={perAuctionColumns} rows={auctionRows} />
              </section>
            )
          })}
        </div>
      ) : (
        <DataTable columns={queueColumns} rows={rows} emptyLabel="Ootel alapakkumisi ei ole." />
      )}
    </div>
  )
}
