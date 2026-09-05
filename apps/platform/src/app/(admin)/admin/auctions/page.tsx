import Link from 'next/link'

import {
  archiveAuctionAction,
  bulkScheduleAuctionsAction,
  duplicateAuctionAction,
  endAuctionManuallyAction,
  relistAuctionAction,
} from '../../_actions/auctions'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { primaryButtonClass, secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { PlusIcon } from '../../_components/icons'
import { requireAdminRepositories } from '../../_lib/admin'
import {
  auctionObjectTypeLabels,
  auctionStatusLabels,
  auctionTypeLabels,
  formatDateTime,
  formatEur,
  StatusPill,
} from '../../_lib/labels'
import { auctionScope, can, type StaffRole } from '../../_lib/permissions'

import type { WhereClause } from '@/lib/data/repositories'
import type { AuctionObjectType, AuctionStatus } from '@/lib/data/schema'
import { auctionObjectTypes } from '@/lib/data/schema'

/**
 * Admin list tabs mirror the portal tabs (portal ListingTabs): Kiiroksjonid
 * map to objectType 'kiire'; Põllumaad stay an empty bucket until the
 * schema gains the object type.
 */
const LIST_TABS: readonly { id: string; label: string; objectTypes: readonly AuctionObjectType[] | null }[] = [
  { id: 'koik', label: 'Kõik', objectTypes: null },
  { id: 'raieoigused', label: 'Raieõigused', objectTypes: ['raieoigus'] },
  { id: 'metskinnistud', label: 'Metskinnistud', objectTypes: ['kinnistu'] },
  { id: 'polumaad', label: 'Põllumaad', objectTypes: [] },
  { id: 'paketid', label: 'Paketid', objectTypes: ['pakett'] },
  { id: 'kiiroksjonid', label: 'Kiiroksjonid', objectTypes: ['kiire'] },
]

const PAGE_SIZE = 25
const FREETEXT_HINT = 'Otsi: id / nimi / kataster / registri number / alias e-post'

type RawParams = Record<string, string | string[] | undefined>

function firstParam(params: RawParams, key: string): string | undefined {
  const value = params[key]
  const first = Array.isArray(value) ? value[0] : value
  return first && first !== '' ? first : undefined
}

function joinedParam(params: RawParams, key: string): string | undefined {
  const value = params[key]
  const joined = Array.isArray(value) ? value.join(',') : value
  return joined && joined !== '' ? joined : undefined
}

function parseStatuses(raw: string | undefined): AuctionStatus[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is AuctionStatus =>
      (auctionStatusList as readonly string[]).includes(value),
    )
}

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

/**
 * Date-only bounds expand to full local days in Europe/Tallinn. The from
 * bound uses the winter offset (earliest possible start of day) and the to
 * bound the summer offset (latest possible end of day), so a filtered day
 * is always fully covered regardless of DST.
 */
function tallinnDayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T00:00:00+02:00`).toISOString()
}

function tallinnDayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T23:59:59+03:00`).toISOString()
}

function countdownText(endsAt: string, now: number): string {
  const ms = Date.parse(endsAt) - now
  if (ms <= 0) return 'lõppenud'
  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60
  if (days > 0) return `${String(days)} p ${String(hours)} h`
  if (hours > 0) return `${String(hours)} h ${String(minutes)} min`
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${String(minutes)}:${String(seconds).padStart(2, '0')}`
}

function initials(name: string | null | undefined): string {
  if (!name) return '—'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

interface AuctionRow {
  id: string
  title: string
  objectType: AuctionObjectType
  type: 'open' | 'sealed'
  isQuickAuction: boolean
  status: AuctionStatus
  countyName: string | null
  minBidCents: number
  endsAt: string | null
  bidCount: number
  pendingCount: number
  specialistName: string | null
}

function freetextMatches(
  entry: { doc: { id: string; title: string }; cadastres: unknown; registryNumbers: unknown; aliasEmail: string | null },
  q: string,
): boolean {
  const needle = q.toLowerCase()
  if (entry.doc.id.toLowerCase() === needle) return true
  if (entry.doc.title.toLowerCase().includes(needle)) return true
  if (entry.aliasEmail?.toLowerCase().includes(needle)) return true
  if (Array.isArray(entry.cadastres)) {
    if ((entry.cadastres as unknown[]).some((value) => String(value).toLowerCase().includes(needle))) return true
  }
  if (Array.isArray(entry.registryNumbers)) {
    if ((entry.registryNumbers as unknown[]).some((value) => String(value).toLowerCase().includes(needle))) return true
  }
  return false
}

export const metadata = { title: 'Oksjonid' }

export default async function AdminAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = await searchParams
  const viga = firstParam(params, 'viga')
  const { session, repositories } = await requireAdminRepositories()
  const role: StaffRole = session.role

  const tabId = firstParam(params, 'tab') ?? 'koik'
  const tab = LIST_TABS.find((entry) => entry.id === tabId) ?? LIST_TABS[0]
  if (!tab) throw new Error('Tab registry is empty')
  const tabObjectTypes = tab.objectTypes

  const statusFilter = parseStatuses(joinedParam(params, 'status'))
  const typeFilter = firstParam(params, 'type')
  const auctionTypeFilter = firstParam(params, 'auctionType')
  const specialistFilter = firstParam(params, 'specialist')
  const countyFilter = firstParam(params, 'county')
  const endFromIso = tallinnDayStartIso(firstParam(params, 'endFrom') ?? '')
  const endToIso = tallinnDayEndIso(firstParam(params, 'endTo') ?? '')
  const q = (firstParam(params, 'q') ?? '').trim()
  const sort = firstParam(params, 'sort') ?? (statusFilter.length === 1 && statusFilter[0] === 'active' ? 'endsAt' : '-createdAt')
  const page = Math.max(1, Number.parseInt(firstParam(params, 'page') ?? '1', 10) || 1)

  // Scope + shareable filters translate into the repository where clause;
  // the repository layer has no >= operator yet, so the end-date range and
  // freetext filter in JS below (single bounded fetch, sliced to 25 here).
  const scope = auctionScope(role, session.userId)
  const whereParts: WhereClause[] = []
  if (scope.kind === 'assigned-specialist') {
    whereParts.push({ specialist: { equals: scope.specialistId } })
  } else if (scope.kind === 'own-seller') {
    whereParts.push({ seller: { equals: scope.sellerId } })
  } else if (specialistFilter) {
    whereParts.push({ specialist: { equals: specialistFilter } })
  }
  if (statusFilter.length > 0) {
    whereParts.push({ status: { in: statusFilter } })
  }
  if (typeFilter && (auctionObjectTypes as readonly string[]).includes(typeFilter)) {
    whereParts.push({ objectType: { equals: typeFilter } })
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
    limit: 5000,
  })

  const now = Date.now()
  const preTab = docs.filter((doc) => {
    if (endFromIso && (!doc.endsAt || doc.endsAt < endFromIso)) return false
    if (endToIso && (!doc.endsAt || doc.endsAt > endToIso)) return false
    return true
  })

  const tabCounts: Record<string, number> = {}
  for (const entry of LIST_TABS) {
    const tabTypes = entry.objectTypes
    tabCounts[entry.id] =
      tabTypes === null ? preTab.length : preTab.filter((doc) => tabTypes.includes(doc.objectType)).length
  }

  const tabFiltered =
    tabObjectTypes === null ? preTab : preTab.filter((doc) => tabObjectTypes.includes(doc.objectType))

  const searchable = tabFiltered.map((doc) => ({
    doc,
    cadastres: doc.cadastres,
    registryNumbers: doc.registryNumbers,
    aliasEmail: doc.aliasEmail,
  }))
  const qFiltered = q ? searchable.filter((entry) => freetextMatches(entry, q)) : searchable

  qFiltered.sort((a, b) => {
    const dir = sort.startsWith('-') ? -1 : 1
    const field = sort.startsWith('-') ? sort.slice(1) : sort
    if (field === 'endsAt') {
      const av = a.doc.endsAt ?? ''
      const bv = b.doc.endsAt ?? ''
      return av < bv ? -dir : av > bv ? dir : 0
    }
    return a.doc.createdAt < b.doc.createdAt ? -dir : a.doc.createdAt > b.doc.createdAt ? dir : 0
  })

  const totalCount = qFiltered.length
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageEntries = qFiltered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const pageIds = pageEntries.map((entry) => entry.doc.id)

  const countyDocs = await repositories.find({
    collection: 'counties',
    sort: 'name',
    pagination: false,
    limit: 100,
  })
  const countyNames = new Map(countyDocs.docs.map((doc) => [doc.id, doc.name]))

  const specialistUsers =
    can(role, 'auctions:reassign-specialist') || role === 'admin' || role === 'superadmin'
      ? (
          await repositories.find({
            collection: 'users',
            where: { role: { equals: 'specialist' } },
            sort: 'name',
            pagination: false,
            limit: 200,
          })
        ).docs
      : []
  const specialistNames = new Map(specialistUsers.map((doc) => [doc.id, doc.name ?? doc.email]))

  const bidCounts = new Map<string, number>()
  const pendingCounts = new Map<string, number>()
  if (pageIds.length > 0) {
    const bids = await repositories.find({
      collection: 'bids',
      where: {
        and: [{ auction: { in: pageIds } }],
      },
      pagination: false,
      limit: 2000,
    })
    for (const bid of bids.docs) {
      bidCounts.set(bid.auctionId, (bidCounts.get(bid.auctionId) ?? 0) + 1)
      if (bid.status === 'pending_approval') {
        pendingCounts.set(bid.auctionId, (pendingCounts.get(bid.auctionId) ?? 0) + 1)
      }
    }
  }

  const rows: AuctionRow[] = pageEntries.map(({ doc }) => ({
    id: doc.id,
    title: doc.title,
    objectType: doc.objectType,
    type: doc.type,
    isQuickAuction: doc.isQuickAuction,
    status: doc.status,
    countyName: doc.countyId ? (countyNames.get(doc.countyId) ?? null) : null,
    minBidCents: doc.minBidCents,
    endsAt: doc.endsAt,
    bidCount: bidCounts.get(doc.id) ?? 0,
    pendingCount: pendingCounts.get(doc.id) ?? 0,
    specialistName: doc.specialistId ? (specialistNames.get(doc.specialistId) ?? null) : null,
  }))

  const roleCanEndManual = can(role, 'auctions:end-manual')
  const roleCanArchive = can(role, 'auctions:archive')
  const roleCanWrite = can(role, 'auctions:write')
  const roleCanExport = can(role, 'auctions:export')

  const currentValues = {
    tab: tab.id,
    status: joinedParam(params, 'status'),
    type: typeFilter,
    auctionType: auctionTypeFilter,
    specialist: specialistFilter,
    county: countyFilter,
    endFrom: firstParam(params, 'endFrom'),
    endTo: firstParam(params, 'endTo'),
    q: q || undefined,
    sort: firstParam(params, 'sort'),
  }

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...currentValues, page: safePage > 1 ? String(safePage) : undefined, ...overrides })) {
      if (value) search.set(key, value)
    }
    const qs = search.toString()
    return qs === '' ? '/admin/auctions' : `/admin/auctions?${qs}`
  }

  const activeFilterCount = [
    currentValues.status,
    currentValues.type,
    currentValues.auctionType,
    currentValues.specialist,
    currentValues.county,
    currentValues.endFrom,
    currentValues.endTo,
    currentValues.q,
  ].filter(Boolean).length

  const filterSelectClass =
    'h-9 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink'

  // The export link reuses the list's shareable filter parameters; the tab
  // narrows the object types and intersects with a picked single type.
  const csvParams = new URLSearchParams()
  for (const [key, value] of Object.entries(currentValues)) {
    if (value) csvParams.set(key, value)
  }
  csvParams.delete('sort')
  csvParams.delete('tab')
  if (tabObjectTypes !== null) {
    const scopedTypes = typeFilter
      ? tabObjectTypes.filter((objectType) => objectType === typeFilter)
      : tabObjectTypes
    csvParams.set('type', scopedTypes.join(','))
  }
  const csvHref = `/api/v1/admin/auctions/export?${csvParams.toString()}`

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Oksjonid"
        description="Kõik oksjonid koos oleku, ajade ja pakkumuste arvuga."
        actions={
          roleCanWrite ? (
            <Link href="/admin/auctions/new" className={primaryButtonClass}>
              <PlusIcon />
              Uus oksjon
            </Link>
          ) : null
        }
      />

      <nav aria-label="Oksjonite tüübid" className="mb-md overflow-x-auto border-b border-border">
        <ul className="flex min-w-max">
          {LIST_TABS.map((entry) => (
            <li key={entry.id}>
              <Link
                href={buildUrl({ tab: entry.id, page: undefined })}
                aria-current={entry.id === tab.id ? 'page' : undefined}
                className={`flex items-center gap-2 border-b-2 px-4 py-2 text-label font-semibold whitespace-nowrap transition-colors duration-hover ease-hover ${
                  entry.id === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-inkMuted hover:border-primary hover:text-primary'
                }`}
              >
                {entry.label}
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-pill bg-primaryLight px-1.5 text-[11px] font-semibold text-primaryDark">
                  {String(tabCounts[entry.id] ?? 0)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <form method="get" action="/admin/auctions" className="mb-md flex flex-wrap items-center gap-sm rounded-card border border-border bg-bgPage p-md">
        <input type="hidden" name="tab" value={tab.id} />
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Olek
          <select name="status" multiple className={`${filterSelectClass} h-auto`} defaultValue={statusFilter}>
            {auctionStatusList.map((status) => (
              <option key={status} value={status}>
                {auctionStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Tüüp
          <select name="type" className={filterSelectClass} defaultValue={typeFilter ?? ''}>
            <option value="">Kõik objektid</option>
            {auctionObjectTypes.map((objectType) => (
              <option key={objectType} value={objectType}>
                {auctionObjectTypeLabels[objectType]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Mehaanika
          <select name="auctionType" className={filterSelectClass} defaultValue={auctionTypeFilter ?? ''}>
            <option value="">Kõik</option>
            <option value="open">Avatud</option>
            <option value="sealed">Suletud</option>
          </select>
        </label>
        {specialistUsers.length > 0 && scope.kind === 'all' ? (
          <label className="flex items-center gap-xs text-label text-ink-muted">
            Spetsialist
            <select name="specialist" className={filterSelectClass} defaultValue={specialistFilter ?? ''}>
              <option value="">Kõik</option>
              {specialistUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
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
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Lõpp alates
          <input type="date" name="endFrom" defaultValue={currentValues.endFrom ?? ''} className={filterSelectClass} />
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          kuni
          <input type="date" name="endTo" defaultValue={currentValues.endTo ?? ''} className={filterSelectClass} />
        </label>
        <label className="flex min-w-[16rem] flex-1 items-center gap-xs text-label text-ink-muted">
          <span className="sr-only">{FREETEXT_HINT}</span>
          <input
            type="search"
            name="q"
            placeholder={FREETEXT_HINT}
            defaultValue={q}
            className="h-9 w-full rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink"
          />
        </label>
        <button type="submit" className="h-9 rounded-button border border-border px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary">
          Filtreeri
        </button>
        <Link href={buildUrl({ status: undefined, type: undefined, auctionType: undefined, specialist: undefined, county: undefined, endFrom: undefined, endTo: undefined, q: undefined, page: undefined })} className="text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:text-primary">
          Tühjenda{activeFilterCount > 0 ? ` (${String(activeFilterCount)})` : ''}
        </Link>
      </form>

      <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
        {roleCanWrite ? (
          <form
            id="bulk-schedule-form"
            action={bulkScheduleAuctionsAction}
            className="flex flex-wrap items-center gap-sm rounded-card border border-border bg-bgPage px-md py-sm"
          >
            <span className="text-label font-semibold text-ink">Bulks ajastamine</span>
            <label className="flex items-center gap-xs text-label text-ink-muted">
              Algus
              <input
                type="datetime-local"
                name="startsAt"
                required
                className={filterSelectClass}
              />
            </label>
            <label className="flex items-center gap-xs text-label text-ink-muted">
              Lõpp
              <input type="datetime-local" name="endsAt" className={filterSelectClass} />
            </label>
            <span className="text-bodySm text-ink-muted">
              Vali tabelist mustandid; mitte-mustandid blokeeritakse. Kellaaeg Europe/Tallinn.
            </span>
            <button type="submit" className={primaryButtonClass}>
              Ajasta valitud
            </button>
          </form>
        ) : null}
        {roleCanExport ? (
          <a href={csvHref} className={secondaryButtonClass}>
            Ekspordi CSV
          </a>
        ) : null}
      </div>

      <DataTable
        columns={[
          ...(roleCanWrite
            ? [
                {
                  key: 'select',
                  label: 'Vali',
                  render: (row: AuctionRow) => (
                    <input
                      type="checkbox"
                      name="ids"
                      value={row.id}
                      form="bulk-schedule-form"
                      aria-label={`Vali oksjon ${row.title}`}
                      className="h-4 w-4 accent-primary"
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'id',
            label: 'ID',
            render: (row) => (
              <Link
                href={`/admin/auctions/${row.id}`}
                className="font-mono text-bodySm text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
                title={row.id}
              >
                #{row.id.slice(0, 8)}
              </Link>
            ),
          },
          {
            key: 'title',
            label: 'Nimi',
            render: (row) => (
              <Link
                href={`/admin/auctions/${row.id}`}
                className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
              >
                {row.objectType === 'kiire' || row.isQuickAuction ? '⚡ ' : ''}
                {row.title}
              </Link>
            ),
          },
          {
            key: 'objectType',
            label: 'Tüüp',
            render: (row) => (
              <span title={`${auctionObjectTypeLabels[row.objectType]} — ${auctionTypeLabels[row.type]}`}>
                {auctionObjectTypeLabels[row.objectType]} {row.type === 'open' ? '(A)' : '(S)'}
              </span>
            ),
          },
          { key: 'status', label: 'Olek', render: (row) => <StatusPill status={row.status} /> },
          { key: 'countyName', label: 'Maakond', render: (row) => row.countyName ?? '—' },
          {
            key: 'minBidCents',
            label: 'Alghind',
            render: (row) => <span className="text-right tabular-nums">{formatEur(row.minBidCents)}</span>,
          },
          {
            key: 'bidCount',
            label: 'Pakkumisi',
            render: (row) => (
              <span>
                {String(row.bidCount)}
                {row.pendingCount > 0 ? (
                  <span
                    className="ml-1 font-semibold text-amber-600"
                    title="Alapakkumisi ootel"
                  >
                    ({String(row.pendingCount)}p)
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'endsAt',
            label: 'Lõpp',
            render: (row) => {
              if (!row.endsAt) return '—'
              if (row.status === 'active') {
                const ending = Date.parse(row.endsAt) - now < 5 * 60 * 1000
                return (
                  <time
                    dateTime={row.endsAt}
                    aria-label={`Lõpeb ${formatDateTime(row.endsAt)}`}
                    className={ending ? 'font-semibold text-amber-600' : undefined}
                    title={formatDateTime(row.endsAt)}
                  >
                    {countdownText(row.endsAt, now)}
                  </time>
                )
              }
              return formatDateTime(row.endsAt)
            },
          },
          { key: 'specialistName', label: 'Spetsialist', render: (row) => initials(row.specialistName) },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <div className="flex flex-wrap items-center gap-sm">
                {roleCanWrite ? (
                  <form action={duplicateAuctionAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:text-ink"
                      title="Dupl."
                    >
                      Dupl.
                    </button>
                  </form>
                ) : null}
                {roleCanEndManual && row.status === 'active' ? (
                  <details className="relative">
                    <summary className="cursor-pointer text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80">
                      Lõpeta
                    </summary>
                    <form
                      action={endAuctionManuallyAction}
                      className="mt-xs flex w-72 flex-col gap-xs rounded-card border border-border bg-bgPage p-sm shadow-md"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <p className="text-label font-semibold text-danger">
                        Kinnitan lõpetamise — see on pöördumatu
                      </p>
                      <label className="flex flex-col gap-xs text-label text-ink-muted">
                        Lõpetamise põhjus (kohustuslik)
                        <textarea
                          name="reason"
                          required
                          minLength={5}
                          rows={2}
                          className="rounded-input border border-border bg-bgPage px-2 py-1 text-bodySm text-ink"
                          placeholder="Kirjuta põhjus (min 5 tähemärki)"
                        />
                      </label>
                      <fieldset className="flex flex-col gap-xs text-bodySm text-ink">
                        <legend className="text-label text-ink-muted">Tulemus</legend>
                        <label className="flex items-center gap-xs">
                          <input type="radio" name="outcome" value="winner" defaultChecked />
                          Kuuluta võitjaks praegune kõrgeim pakkumine
                        </label>
                        <label className="flex items-center gap-xs">
                          <input type="radio" name="outcome" value="unsold" />
                          Märgi müümata
                        </label>
                      </fieldset>
                      <button
                        type="submit"
                        className="rounded-button border border-danger px-3 py-1 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light"
                      >
                        Lõpeta käsitsi
                      </button>
                    </form>
                  </details>
                ) : null}
                {roleCanArchive && (row.status === 'unsold' || row.status === 'completed') ? (
                  <details className="relative">
                    <summary className="cursor-pointer text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:text-ink">
                      Arhiivi
                    </summary>
                    <form
                      action={archiveAuctionAction}
                      className="mt-xs flex w-72 flex-col gap-xs rounded-card border border-border bg-bgPage p-sm shadow-md"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <label className="flex flex-col gap-xs text-label text-ink-muted">
                        Arhiiveerimise põhjus (kohustuslik)
                        <textarea
                          name="reason"
                          required
                          minLength={5}
                          rows={2}
                          className="rounded-input border border-border bg-bgPage px-2 py-1 text-bodySm text-ink"
                          placeholder="Kirjuta põhjus (min 5 tähemärki)"
                        />
                      </label>
                      <button
                        type="submit"
                        className="rounded-button border border-border px-3 py-1 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
                      >
                        Arhiivi
                      </button>
                    </form>
                  </details>
                ) : null}
                {roleCanWrite && (row.status === 'ended' || row.status === 'unsold') ? (
                  <form action={relistAuctionAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
                    >
                      Avalda uuesti
                    </button>
                  </form>
                ) : null}
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Filtritele vastavaid oksjoneid ei leitud"
      />

      <div className="mt-sm flex items-center justify-between text-label text-ink-muted">
        <span>
          {totalCount === 0
            ? '0 oksjonit'
            : `${String((safePage - 1) * PAGE_SIZE + 1)}–${String(Math.min(safePage * PAGE_SIZE, totalCount))} / ${String(totalCount)}`}
        </span>
        <span className="flex items-center gap-sm">
          {safePage > 1 ? (
            <Link href={buildUrl({ page: String(safePage - 1) })} className="font-semibold text-primary hover:text-primary/80">
              ‹ Eelmine
            </Link>
          ) : null}
          <span>
            Leht {String(safePage)} / {String(pageCount)}
          </span>
          {safePage < pageCount ? (
            <Link href={buildUrl({ page: String(safePage + 1) })} className="font-semibold text-primary hover:text-primary/80">
              Järgmine ›
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  )
}
