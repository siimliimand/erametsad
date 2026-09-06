import { Download as DownloadIcon } from 'lucide-react'
import Link from 'next/link'
import type { ComponentType } from 'react'

import { Countdown } from './_components/Countdown'
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
import {
  DataTable,
  type DataTableColumnSort,
} from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import {
  primaryButtonClass,
  secondaryButtonClass,
} from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { StatusChip } from '../../_components/StatusChip'
import {
  ChevronDownIcon,
  CopyIcon,
  EllipsisIcon,
  ExternalLinkIcon,
  MapPinHouseIcon,
  PackageIcon,
  PencilIcon,
  PlusIcon,
  SearchIcon,
  TreePineIcon,
  XIcon,
  ZapIcon,
} from '../../_components/icons'
import { requireAdminRepositories } from '../../_lib/admin'
import {
  auctionObjectTypeLabels,
  auctionStatusLabels,
  auctionTypeLabels,
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

const typeChipClass: Record<AuctionObjectType, string> = {
  raieoigus: 'bg-[var(--st-active-bg)] text-[color:var(--st-active-text)]',
  kinnistu: 'bg-[var(--st-scheduled-bg)] text-[color:var(--st-scheduled-text)]',
  pakett: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
  kiire: 'bg-[var(--st-draft-bg)] text-[color:var(--st-draft-text)]',
}

const typeChipIcons: Record<
  AuctionObjectType,
  ComponentType<{ className?: string }>
> = {
  raieoigus: TreePineIcon,
  kinnistu: MapPinHouseIcon,
  pakett: PackageIcon,
  kiire: ZapIcon,
}

const raBtnClass =
  'inline-flex items-center gap-1 rounded-md border border-border bg-bgPage px-2 py-1 text-[11px] font-medium text-inkMuted transition-colors duration-hover ease-hover'
const raBtnActionClass = `${raBtnClass} hover:border-primary hover:bg-bgMist hover:text-primary`
const raBtnDangerClass = `${raBtnClass} hover:border-danger hover:bg-dangerLight hover:text-danger`

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
    specialistName: doc.specialistId
      ? (specialistNames.get(doc.specialistId) ?? null)
      : null,
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
                Ekspordi CSV
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
                className={`rounded-pill px-2 text-[11px] font-medium ${
                  active
                    ? 'bg-white/20 text-inkInverse'
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

      {roleCanWrite ? (
        <form
          id="bulk-schedule-form"
          action={bulkScheduleAuctionsAction}
          className="mb-md flex flex-wrap items-center gap-sm rounded-card border border-border bg-bgPage px-md py-sm"
        >
          <span className="text-label font-semibold text-ink">
            Bulks ajastamine
          </span>
          <label className="flex items-center gap-xs text-label text-inkMuted">
            Algus
            <input
              type="datetime-local"
              name="startsAt"
              required
              className={filterSelectClass}
            />
          </label>
          <label className="flex items-center gap-xs text-label text-inkMuted">
            Lõpp
            <input
              type="datetime-local"
              name="endsAt"
              className={filterSelectClass}
            />
          </label>
          <span className="text-bodySm text-inkMuted">
            Vali tabelist mustandid; mitte-mustandid blokeeritakse. Kellaaeg
            Europe/Tallinn.
          </span>
          <button type="submit" className={primaryButtonClass}>
            Ajasta valitud
          </button>
        </form>
      ) : null}

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
            sort: columnSort('id'),
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
            sort: columnSort('title'),
            render: (row) => (
              <span className="flex items-center gap-1.5">
                {row.isQuickAuction || row.objectType === 'kiire' ? (
                  <>
                    <ZapIcon
                      aria-hidden="true"
                      className="h-3.5 w-3.5 shrink-0 text-cta"
                    />
                    <span className="sr-only">Kiiroksjon</span>
                  </>
                ) : null}
                <Link
                  href={`/admin/auctions/${row.id}`}
                  className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primary/80"
                >
                  {row.title}
                </Link>
              </span>
            ),
          },
          {
            key: 'objectType',
            label: 'Tüüp',
            render: (row) => {
              const TypeIcon = typeChipIcons[row.objectType]
              return (
                <span
                  title={`${auctionObjectTypeLabels[row.objectType]} — ${auctionTypeLabels[row.type]}`}
                  className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-label ${typeChipClass[row.objectType]}`}
                >
                  <TypeIcon aria-hidden="true" className="h-3 w-3" />
                  <span className="sr-only">
                    {auctionObjectTypeLabels[row.objectType]}
                  </span>
                  <span
                    title={auctionTypeLabels[row.type]}
                    className="rounded border border-border bg-bgPage px-1 font-mono text-[10px] text-inkMuted"
                  >
                    {row.type === 'open' ? 'A' : 'S'}
                  </span>
                </span>
              )
            },
          },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <StatusChip status={row.status} />,
          },
          {
            key: 'countyName',
            label: 'Maakond',
            render: (row) => row.countyName ?? '—',
          },
          {
            key: 'minBidCents',
            label: 'Alghind',
            sort: columnSort('minBidCents'),
            render: (row) => (
              <span className="text-right tabular-nums">
                {formatEur(row.minBidCents)}
              </span>
            ),
          },
          {
            key: 'bidCount',
            label: 'Pakkumisi',
            sort: columnSort('bidCount'),
            render: (row) => (
              <span className="tabular-nums">
                {String(row.bidCount)}
                {row.pendingCount > 0 ? (
                  <span
                    className="ml-1 font-medium text-amber-600"
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
            sort: columnSort('endsAt'),
            render: (row) => {
              if (!row.endsAt) return '—'
              if (row.status === 'active') {
                return (
                  <Countdown endsAt={row.endsAt}>
                    {countdownText(row.endsAt, now)}
                  </Countdown>
                )
              }
              return formatDateTime(row.endsAt)
            },
          },
          {
            key: 'specialistName',
            label: 'Spetsialist',
            render: (row) =>
              row.specialistName ? (
                <>
                  <span
                    aria-hidden="true"
                    title={row.specialistName}
                    className="flex h-[26px] w-[26px] items-center justify-center rounded-pill bg-primaryLight font-heading text-[10px] font-semibold text-primary"
                  >
                    {initials(row.specialistName)}
                  </span>
                  <span className="sr-only">{row.specialistName}</span>
                </>
              ) : (
                '—'
              ),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <span className="row-actions">
                <a
                  href={`/oksjon/${row.id}`}
                  target="_blank"
                  rel="noopener"
                  title="Vaata portaalis"
                  className={raBtnActionClass}
                >
                  <ExternalLinkIcon aria-hidden="true" className="h-3 w-3" />
                  Vaata
                </a>
                {roleCanWrite ? (
                  <Link
                    href={`/admin/auctions/${row.id}/edit`}
                    title="Muuda oksjonit"
                    className={raBtnActionClass}
                  >
                    <PencilIcon aria-hidden="true" className="h-3 w-3" />
                    Muuda
                  </Link>
                ) : null}
                {roleCanWrite ? (
                  <form action={duplicateAuctionAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      title="Duplikaat uueks mustandiks"
                      className={raBtnActionClass}
                    >
                      <CopyIcon aria-hidden="true" className="h-3 w-3" />
                      Dupl.
                    </button>
                  </form>
                ) : null}
                {roleCanEndManual && row.status === 'active' ? (
                  <details className="relative">
                    <summary
                      title="Lõpeta käsitsi"
                      className={`${raBtnDangerClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                    >
                      <EllipsisIcon aria-hidden="true" className="h-3 w-3" />
                      Lõpeta
                    </summary>
                    <form
                      action={endAuctionManuallyAction}
                      className="mt-xs flex w-72 flex-col gap-xs rounded-card border border-border bg-bgPage p-3 shadow-modal"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <p className="text-label font-semibold text-danger">
                        Kinnitan lõpetamise — see on pöördumatu
                      </p>
                      <label className="flex flex-col gap-xs text-label text-inkMuted">
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
                        <legend className="text-label text-inkMuted">
                          Tulemus
                        </legend>
                        <label className="flex items-center gap-xs">
                          <input
                            type="radio"
                            name="outcome"
                            value="winner"
                            defaultChecked
                          />
                          Kuuluta võitjaks praegune kõrgeim pakkumine
                        </label>
                        <label className="flex items-center gap-xs">
                          <input type="radio" name="outcome" value="unsold" />
                          Märgi müümata
                        </label>
                      </fieldset>
                      <button
                        type="submit"
                        className="rounded-button border border-danger px-3 py-1 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-dangerLight"
                      >
                        Lõpeta käsitsi
                      </button>
                    </form>
                  </details>
                ) : null}
                {roleCanArchive &&
                (row.status === 'unsold' || row.status === 'completed') ? (
                  <details className="relative">
                    <summary
                      title="Arhiivi"
                      className={`${raBtnActionClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
                    >
                      <EllipsisIcon aria-hidden="true" className="h-3 w-3" />
                      Arhiivi
                    </summary>
                    <form
                      action={archiveAuctionAction}
                      className="mt-xs flex w-72 flex-col gap-xs rounded-card border border-border bg-bgPage p-3 shadow-modal"
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <label className="flex flex-col gap-xs text-label text-inkMuted">
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
                {roleCanWrite &&
                (row.status === 'ended' || row.status === 'unsold') ? (
                  <form action={relistAuctionAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <button
                      type="submit"
                      title="Avalda uuesti"
                      className={raBtnActionClass}
                    >
                      Avalda uuesti
                    </button>
                  </form>
                ) : null}
              </span>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Filtritele vastavaid oksjoneid ei leitud"
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
