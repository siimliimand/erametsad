import { Download as DownloadIcon } from 'lucide-react'
import Link from 'next/link'

import {
  AuctionsTable,
  type AuctionTableRow,
} from './_components/AuctionsTable'
import {
  countdownText,
  defaultSortFor,
  initials,
  sortAuctionRows,
  type SortKey,
} from './_lib/list-view'
import {
  archiveAuctionAction,
  bulkScheduleAuctionsAction,
  duplicateAuctionAction,
  endAuctionManuallyAction,
  relistAuctionAction,
} from '../../_actions/auctions'
import type { DataTableColumnSort } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import {
  primaryButtonClass,
  secondaryButtonClass,
} from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import {
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  XIcon,
} from '../../_components/icons'
import { requireAdminRepositories } from '../../_lib/admin'
import {
  auctionObjectTypeLabels,
  auctionStatusLabels,
  formatDateTime,
  formatEur,
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
const LIST_TABS: readonly {
  id: string
  label: string
  objectTypes: readonly AuctionObjectType[] | null
}[] = [
  { id: 'koik', label: 'Kõik', objectTypes: null },
  { id: 'raieoigused', label: 'Raieõigused', objectTypes: ['raieoigus'] },
  { id: 'metskinnistud', label: 'Metskinnistud', objectTypes: ['kinnistu'] },
  { id: 'polumaad', label: 'Põllumaad', objectTypes: [] },
  { id: 'paketid', label: 'Paketid', objectTypes: ['pakett'] },
  { id: 'kiiroksjonid', label: 'Kiiroksjonid', objectTypes: ['kiire'] },
]

const PAGE_SIZE = 25
const FREETEXT_HINT =
  'Otsi: id / nimi / kataster / registri number / alias e-post'

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

function freetextMatches(
  entry: {
    doc: { id: string; title: string }
    cadastres: unknown
    registryNumbers: unknown
    aliasEmail: string | null
  },
  q: string,
): boolean {
  const needle = q.toLowerCase()
  if (entry.doc.id.toLowerCase() === needle) return true
  if (entry.doc.title.toLowerCase().includes(needle)) return true
  if (entry.aliasEmail?.toLowerCase().includes(needle)) return true
  if (Array.isArray(entry.cadastres)) {
    if (
      (entry.cadastres as unknown[]).some((value) =>
        String(value).toLowerCase().includes(needle),
      )
    )
      return true
  }
  if (Array.isArray(entry.registryNumbers)) {
    if (
      (entry.registryNumbers as unknown[]).some((value) =>
        String(value).toLowerCase().includes(needle),
      )
    )
      return true
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
  const sort = firstParam(params, 'sort') ?? defaultSortFor(statusFilter)
  const sortField = sort.startsWith('-') ? sort.slice(1) : sort
  const page = Math.max(
    1,
    Number.parseInt(firstParam(params, 'page') ?? '1', 10) || 1,
  )

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
  if (
    typeFilter &&
    (auctionObjectTypes as readonly string[]).includes(typeFilter)
  ) {
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
    ...(whereParts.length > 0
      ? { where: { and: whereParts } satisfies WhereClause }
      : {}),
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
      tabTypes === null
        ? preTab.length
        : preTab.filter((doc) => tabTypes.includes(doc.objectType)).length
  }

  const tabFiltered =
    tabObjectTypes === null
      ? preTab
      : preTab.filter((doc) => tabObjectTypes.includes(doc.objectType))

  const searchable = tabFiltered.map((doc) => ({
    doc,
    cadastres: doc.cadastres,
    registryNumbers: doc.registryNumbers,
    aliasEmail: doc.aliasEmail,
  }))
  const qFiltered = q
    ? searchable.filter((entry) => freetextMatches(entry, q))
    : searchable

  // Sorting by bidCount needs counts for every filtered row, not just the
  // visible page slice, so the bids fetch widens only for that sort key.
  const bidCounts = new Map<string, number>()
  const pendingCounts = new Map<string, number>()
  const countBids = (
    docs: readonly { auctionId: string; status: string }[],
  ) => {
    for (const bid of docs) {
      bidCounts.set(bid.auctionId, (bidCounts.get(bid.auctionId) ?? 0) + 1)
      if (bid.status === 'pending_approval') {
        pendingCounts.set(
          bid.auctionId,
          (pendingCounts.get(bid.auctionId) ?? 0) + 1,
        )
      }
    }
  }
  if (sortField === 'bidCount' && qFiltered.length > 0) {
    const bids = await repositories.find({
      collection: 'bids',
      where: {
        and: [{ auction: { in: qFiltered.map((entry) => entry.doc.id) } }],
      },
      pagination: false,
      limit: 2000,
    })
    countBids(bids.docs)
  }

  const sortedEntries = sortAuctionRows(
    qFiltered.map((entry) => ({
      ...entry,
      ...entry.doc,
      bidCount: bidCounts.get(entry.doc.id) ?? 0,
    })),
    sort,
    defaultSortFor(statusFilter),
  )

  const totalCount = sortedEntries.length
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageEntries = sortedEntries.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )
  const pageIds = pageEntries.map((entry) => entry.doc.id)

  const countyDocs = await repositories.find({
    collection: 'counties',
    sort: 'name',
    pagination: false,
    limit: 100,
  })
  const countyNames = new Map(countyDocs.docs.map((doc) => [doc.id, doc.name]))

  const specialistUsers =
    can(role, 'auctions:reassign-specialist') ||
    role === 'admin' ||
    role === 'superadmin'
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
  const specialistNames = new Map(
    specialistUsers.map((doc) => [doc.id, doc.name ?? doc.email]),
  )

  if (sortField !== 'bidCount' && pageIds.length > 0) {
    const bids = await repositories.find({
      collection: 'bids',
      where: {
        and: [{ auction: { in: pageIds } }],
      },
      pagination: false,
      limit: 2000,
    })
    countBids(bids.docs)
  }

  const roleCanEndManual = can(role, 'auctions:end-manual')
  const roleCanArchive = can(role, 'auctions:archive')
  const roleCanWrite = can(role, 'auctions:write')
  const roleCanExport = can(role, 'auctions:export')

  // Rows are serialized for the client wrapper: every string a cell renders
  // is precomputed here so the client bundle stays lean and hydration
  // output matches the server render.
  const rows: AuctionTableRow[] = pageEntries.map(({ doc }) => ({
    id: doc.id,
    title: doc.title,
    objectType: doc.objectType,
    type: doc.type,
    isQuickAuction: doc.isQuickAuction,
    status: doc.status,
    countyName: doc.countyId ? (countyNames.get(doc.countyId) ?? null) : null,
    minBidCents: doc.minBidCents,
    minBidLabel: formatEur(doc.minBidCents),
    endsAt: doc.endsAt,
    endsLabel:
      doc.endsAt === null
        ? null
        : doc.status === 'active'
          ? countdownText(doc.endsAt, now)
          : formatDateTime(doc.endsAt),
    bidCount: bidCounts.get(doc.id) ?? 0,
    pendingCount: pendingCounts.get(doc.id) ?? 0,
    specialistName: doc.specialistId
      ? (specialistNames.get(doc.specialistId) ?? null)
      : null,
    specialistInitials: initials(
      doc.specialistId ? (specialistNames.get(doc.specialistId) ?? null) : null,
    ),
    portalHref: `/oksjon/${doc.id}`,
    editHref: `/admin/auctions/${doc.id}/edit`,
    canEnd: roleCanEndManual && doc.status === 'active',
    canArchive:
      roleCanArchive && (doc.status === 'unsold' || doc.status === 'completed'),
    canRelist:
      roleCanWrite && (doc.status === 'ended' || doc.status === 'unsold'),
  }))

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
    for (const [key, value] of Object.entries({
      ...currentValues,
      page: safePage > 1 ? String(safePage) : undefined,
      ...overrides,
    })) {
      if (value) search.set(key, value)
    }
    const qs = search.toString()
    return qs === '' ? '/admin/auctions' : `/admin/auctions?${qs}`
  }

  // asc → desc → asc toggle; an inactive column starts at ascending.
  function columnSort(key: SortKey): DataTableColumnSort {
    if (sortField !== key) return { href: buildUrl({ sort: key }) }
    return sort.startsWith('-')
      ? { dir: 'desc', href: buildUrl({ sort: key }) }
      : { dir: 'asc', href: buildUrl({ sort: `-${key}` }) }
  }

  const sorts: Partial<Record<SortKey, DataTableColumnSort>> = {
    id: columnSort('id'),
    title: columnSort('title'),
    minBidCents: columnSort('minBidCents'),
    bidCount: columnSort('bidCount'),
    endsAt: columnSort('endsAt'),
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

  const filterChipClass =
    'inline-flex h-[34px] items-center gap-1.5 rounded-pill border border-border bg-bgPage px-2.5 text-label text-inkMuted transition-colors duration-hover ease-hover focus-within:border-primary'
  const filterChipSelectClass =
    'max-w-[140px] cursor-pointer appearance-none border-0 bg-transparent p-0 text-[12px] font-medium text-ink outline-none'
  const filterChipIconClass =
    'pointer-events-none h-3 w-3 shrink-0 text-inkMuted'

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
        breadcrumb={
          <>
            <Link
              href="/admin"
              className="transition-colors duration-hover ease-hover hover:text-primary"
            >
              Töölaud
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Oksjonid</span>
          </>
        }
        title="Oksjonid"
        description="Kõik oksjonid koos oleku, ajade ja pakkumuste arvuga."
        actions={
          <>
            {roleCanWrite ? (
              <Link href="/admin/auctions/new" className={primaryButtonClass}>
                <PlusIcon />
                Uus oksjon
                <kbd
                  aria-hidden="true"
                  className="ml-0.5 rounded border border-white/35 px-[5px] font-mono text-[10px] font-medium leading-4 text-white/85"
                >
                  ⌘N
                </kbd>
              </Link>
            ) : null}
            {roleCanExport ? (
              <a href={csvHref} className={secondaryButtonClass}>
                <DownloadIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                Ekspordi filtreeritud CSV
              </a>
            ) : null}
          </>
        }
      />

      <nav
        aria-label="Oksjonite tüübid"
        className="mb-md flex flex-wrap items-center gap-2"
      >
        {LIST_TABS.map((entry) => {
          const active = entry.id === tab.id
          return (
            <Link
              key={entry.id}
              href={buildUrl({ tab: entry.id, page: undefined })}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex items-center gap-2 rounded-pill border px-3.5 py-1.5 text-label whitespace-nowrap transition-colors duration-hover ease-hover ${
                active
                  ? 'border-primary bg-primary font-semibold text-inkInverse'
                  : 'border-border bg-bgPage text-ink hover:border-primary hover:text-primary'
              }`}
            >
              {entry.label}
              <span
                className={`rounded-pill px-2 py-px font-mono text-[11px] font-medium leading-4 ${
                  active
                    ? 'bg-white/[0.18] text-inkInverse'
                    : 'bg-bgMist text-inkMuted'
                }`}
              >
                {String(tabCounts[entry.id] ?? 0)}
              </span>
            </Link>
          )
        })}
      </nav>

      <form
        method="get"
        action="/admin/auctions"
        aria-label="Filtrid"
        className="mb-md flex flex-wrap items-center gap-2 rounded-card border border-border bg-bgPage p-3 shadow-card"
      >
        <input type="hidden" name="tab" value={tab.id} />
        <label className="inline-flex items-start gap-1.5 rounded-card border border-border bg-bgPage px-2.5 py-1.5 text-label text-inkMuted transition-colors duration-hover ease-hover focus-within:border-primary">
          <span className="pt-0.5 text-[12px] text-inkMuted">Olek</span>
          <select
            name="status"
            multiple
            defaultValue={statusFilter}
            className="h-auto cursor-pointer appearance-none border-0 bg-transparent p-0 text-[12px] leading-4 text-ink outline-none"
          >
            {auctionStatusList.map((status) => (
              <option key={status} value={status}>
                {auctionStatusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label className={filterChipClass}>
          <span className="text-[12px] text-inkMuted">Tüüp</span>
          <select
            name="type"
            defaultValue={typeFilter ?? ''}
            className={filterChipSelectClass}
          >
            <option value="">Kõik objektid</option>
            {auctionObjectTypes.map((objectType) => (
              <option key={objectType} value={objectType}>
                {auctionObjectTypeLabels[objectType]}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden="true" className={filterChipIconClass} />
        </label>
        <label className={filterChipClass}>
          <span className="text-[12px] text-inkMuted">Mehaanika</span>
          <select
            name="auctionType"
            defaultValue={auctionTypeFilter ?? ''}
            className={filterChipSelectClass}
          >
            <option value="">Kõik</option>
            <option value="open">Avatud</option>
            <option value="sealed">Suletud</option>
          </select>
          <ChevronDownIcon aria-hidden="true" className={filterChipIconClass} />
        </label>
        {specialistUsers.length > 0 && scope.kind === 'all' ? (
          <label className={filterChipClass}>
            <span className="text-[12px] text-inkMuted">Spetsialist</span>
            <select
              name="specialist"
              defaultValue={specialistFilter ?? ''}
              className={filterChipSelectClass}
            >
              <option value="">Kõik</option>
              {specialistUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.email}
                </option>
              ))}
            </select>
            <ChevronDownIcon
              aria-hidden="true"
              className={filterChipIconClass}
            />
          </label>
        ) : null}
        <label className={filterChipClass}>
          <span className="text-[12px] text-inkMuted">Maakond</span>
          <select
            name="county"
            defaultValue={countyFilter ?? ''}
            className={filterChipSelectClass}
          >
            <option value="">Kõik</option>
            {countyDocs.docs.map((county) => (
              <option key={county.id} value={county.id}>
                {county.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon aria-hidden="true" className={filterChipIconClass} />
        </label>
        <span className={filterChipClass}>
          <span className="text-[12px] text-inkMuted">Lõpp</span>
          <input
            type="date"
            name="endFrom"
            aria-label="Lõpp alates"
            defaultValue={currentValues.endFrom ?? ''}
            className="w-[112px] border-0 bg-transparent p-0 font-mono text-[12px] text-ink outline-none"
          />
          <span aria-hidden="true" className="text-inkMuted">
            —
          </span>
          <input
            type="date"
            name="endTo"
            aria-label="Lõpp kuni"
            defaultValue={currentValues.endTo ?? ''}
            className="w-[112px] border-0 bg-transparent p-0 font-mono text-[12px] text-ink outline-none"
          />
        </span>
        <label className="flex h-[34px] min-w-[210px] flex-1 items-center gap-2 rounded-pill border border-border bg-bgPage px-3 text-label text-inkMuted transition-colors duration-hover ease-hover focus-within:border-primary">
          <span className="sr-only">{FREETEXT_HINT}</span>
          <SearchIcon
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0 text-inkMuted"
          />
          <input
            type="search"
            name="q"
            placeholder={FREETEXT_HINT}
            defaultValue={q}
            className="min-w-0 flex-1 border-0 bg-transparent p-0 text-[13px] text-ink outline-none"
          />
        </label>
        <button
          type="submit"
          className="inline-flex h-[34px] items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
        >
          Filtreeri
        </button>
        <Link
          href={buildUrl({
            status: undefined,
            type: undefined,
            auctionType: undefined,
            specialist: undefined,
            county: undefined,
            endFrom: undefined,
            endTo: undefined,
            q: undefined,
            page: undefined,
          })}
          className="inline-flex h-[34px] items-center gap-1 rounded-button px-2 text-label font-medium text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight"
        >
          <XIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
          Tühjenda
          {activeFilterCount > 0 ? ` (${String(activeFilterCount)})` : ''}
        </Link>
      </form>

      <AuctionsTable
        rows={rows}
        sorts={sorts}
        csvHref={csvHref}
        roleCanWrite={roleCanWrite}
        roleCanExport={roleCanExport}
        bulkScheduleAction={bulkScheduleAuctionsAction}
        duplicateAction={duplicateAuctionAction}
        endManuallyAction={endAuctionManuallyAction}
        archiveAction={archiveAuctionAction}
        relistAction={relistAuctionAction}
      />

      <div className="mt-sm flex items-center justify-between text-label text-inkMuted">
        <span>
          {totalCount === 0
            ? '0 oksjonit'
            : `${String((safePage - 1) * PAGE_SIZE + 1)}–${String(Math.min(safePage * PAGE_SIZE, totalCount))} / ${String(totalCount)}`}
        </span>
        <span className="flex items-center gap-sm">
          {safePage > 1 ? (
            <Link
              href={buildUrl({ page: String(safePage - 1) })}
              className="font-semibold text-primary hover:text-primary/80"
            >
              ‹ Eelmine
            </Link>
          ) : null}
          <span>
            Leht {String(safePage)} / {String(pageCount)}
          </span>
          {safePage < pageCount ? (
            <Link
              href={buildUrl({ page: String(safePage + 1) })}
              className="font-semibold text-primary hover:text-primary/80"
            >
              Järgmine ›
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  )
}
