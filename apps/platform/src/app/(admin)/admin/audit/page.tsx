import Link from 'next/link'

import { auditActionGroups, groupForAction, groupLabel, UNGROUPED_GROUP_ID } from './_components/action-registry'
import { AuditDiff } from '../../_components/AuditDiff'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, userRoleLabels } from '../../_lib/labels'
import { can, staffRoles, type StaffRole } from '../../_lib/permissions'

import type { AuditEntryDoc, UserDoc, WhereClause } from '@/lib/data/repositories'

const PAGE_SIZE = 25
// The repository layer has no range operators beyond less_than_equal; the
// date-range filter runs in JS on a single bounded fetch (same pattern as
// the auctions and users lists).
const FETCH_LIMIT = 2000

const EMPTY_LABEL = 'Filtritele vastavaid kirjeid ei leitud'

const BANNER = 'Kirjed on muutumatud — muuta ega kustutada ei saa.'
const SELF_VIEW_NOTE = 'Näidatakse ainult sinu enda tehtud kirjeid.'
const SECRET_NOTE = 'Salajased väljad (näiteks tagatishind, võtmed, isikukood) on maskeeritud.'

/**
 * Date-only bounds expand to full local days in Europe/Tallinn. The from
 * bound uses the winter offset (earliest possible start of day) and the to
 * bound the summer offset (latest possible end of day), so a filtered day
 * is always fully covered regardless of DST. (Shared logic with the
 * auctions list; page-local because route files do not export helpers.)
 */
function tallinnDayStartIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T00:00:00+02:00`).toISOString()
}

function tallinnDayEndIso(day: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  return new Date(`${day}T23:59:59+03:00`).toISOString()
}

type RawParams = Record<string, string | string[] | undefined>

function firstParam(params: RawParams, key: string): string {
  const value = params[key]
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

const entityTypeLabels: Record<string, string> = {
  user: 'Kasutaja',
  auction: 'Oksjon',
  bid: 'Pakkumine',
  contract: 'Leping',
  lead: 'Juhtlõim',
  partner: 'Partner',
  settings: 'Seaded',
  article: 'Artikkel',
  page: 'Leht',
  redirect: 'Ümbersuunamine',
  'company-access-request': 'Ettevõtte päring',
  'service-request': 'Teenuse päring',
  'contract-template': 'Lepingu mall',
}

function entityTypeLabel(entityType: string | null): string {
  if (!entityType) return '—'
  return entityTypeLabels[entityType] ?? entityType
}

interface AuditRow {
  id: string
  createdAt: string
  actorName: string
  actorRole: string | null
  action: string
  actionGroup: string
  entityType: string | null
  entityId: string | null
  hasDiff: boolean
}

export const metadata = { title: 'Auditlogi' }

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = await searchParams
  const actorParam = firstParam(params, 'actor')
  const groupParam = firstParam(params, 'group')
  const entityTypeParam = firstParam(params, 'entityType')
  const entityIdParam = firstParam(params, 'entityId').trim()
  const fromParam = firstParam(params, 'from')
  const toParam = firstParam(params, 'to')
  const entryParam = firstParam(params, 'entry')
  const page = Math.max(1, Number.parseInt(firstParam(params, 'page') || '1', 10) || 1)

  const { session, repositories } = await requireAdminRepositories()
  const role: StaffRole = session.role
  if (!can(role, 'audit:read')) {
    return (
      <div>
        <PageHeader title="Auditlogi" />
        <ErrorNotice message="Ainult superadmin ja administraator." />
      </div>
    )
  }

  // Self-view: an admin sees only its own entries; superadmin sees all.
  // Specialist and seller never reach this point (no audit:read).
  const isSuper = role === 'superadmin'
  const selfView = role === 'admin'
  const actorFilter = selfView ? session.userId : actorParam || undefined

  const fromIso = tallinnDayStartIso(fromParam)
  const toIso = tallinnDayEndIso(toParam)

  const { docs } = await repositories.find({
    collection: 'audit-entry',
    sort: '-createdAt',
    pagination: false,
    limit: FETCH_LIMIT,
  })

  const filtered = docs.filter((doc) => {
    if (actorFilter && doc.actorId !== actorFilter) return false
    if (groupParam) {
      const docGroup = groupForAction(doc.action)
      if (groupParam === UNGROUPED_GROUP_ID) {
        if (docGroup !== null) return false
      } else if (docGroup !== groupParam) {
        return false
      }
    }
    if (entityTypeParam && doc.entityType !== entityTypeParam) return false
    if (entityIdParam && doc.entityId !== entityIdParam) return false
    if (fromIso && doc.createdAt < fromIso) return false
    if (toIso && doc.createdAt > toIso) return false
    return true
  })

  const totalCount = filtered.length
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const safePage = Math.min(page, pageCount)
  const pageEntries = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Staff list powers both the actor filter (superadmin) and the batch
  // name/role resolution for the current page.
  const staffUsers: UserDoc[] = await repositories
    .find({
      collection: 'users',
      where: { role: { in: staffRoles } } satisfies WhereClause,
      sort: 'name',
      pagination: false,
      limit: 500,
    })
    .then((result) => result.docs)
  const actorByid = new Map(staffUsers.map((user) => [user.id, user]))

  const rows: AuditRow[] = pageEntries.map((doc) => {
    const actor = doc.actorId ? actorByid.get(doc.actorId) : undefined
    return {
      id: doc.id,
      createdAt: doc.createdAt,
      actorName: actor ? (actor.name ?? actor.email) : (doc.actorId ?? '—'),
      actorRole: actor ? userRoleLabels[actor.role] : null,
      action: doc.action,
      actionGroup: groupForAction(doc.action) ?? UNGROUPED_GROUP_ID,
      entityType: doc.entityType,
      entityId: doc.entityId,
      hasDiff: doc.before !== null && doc.before !== undefined,
    }
  })

  const entityTypes = Array.from(
    new Set(docs.map((doc) => doc.entityType).filter((value): value is string => typeof value === 'string')),
  ).sort()

  const currentValues = {
    actor: actorFilter,
    group: groupParam || undefined,
    entityType: entityTypeParam || undefined,
    entityId: entityIdParam || undefined,
    from: fromParam || undefined,
    to: toParam || undefined,
    entry: entryParam || undefined,
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
    return qs === '' ? '/admin/audit' : `/admin/audit?${qs}`
  }

  // Detail entry: prefer the already filtered page data; fall back to a
  // single read, still enforcing the self-view scope for admins.
  let detail: AuditEntryDoc | null = null
  if (entryParam) {
    const inList = pageEntries.find((doc) => doc.id === entryParam)
    if (inList) {
      detail = inList
    } else {
      const fetched = await repositories.findByID({ collection: 'audit-entry', id: entryParam })
      if (fetched && (!selfView || fetched.actorId === session.userId)) {
        detail = fetched
      }
    }
  }

  const filterSelectClass =
    'h-9 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink'
  const activeFilterCount = [
    isSuper ? currentValues.actor : undefined,
    currentValues.group,
    currentValues.entityType,
    currentValues.entityId,
    currentValues.from,
    currentValues.to,
  ].filter(Boolean).length

  return (
    <div>
      <PageHeader title="Auditlogi" description="Personalitegevuste muutumatu jälg." />
      <p className="mb-md rounded-card border border-border bg-bgMist px-md py-sm text-bodySm text-ink-muted">
        {BANNER} {selfView ? SELF_VIEW_NOTE : null}
      </p>

      <form
        method="get"
        action="/admin/audit"
        className="mb-md flex flex-wrap items-center gap-sm rounded-card border border-border bg-bgPage p-md"
      >
        {isSuper ? (
          <label className="flex items-center gap-xs text-label text-ink-muted">
            Tegija
            <select name="actor" className={filterSelectClass} defaultValue={currentValues.actor ?? ''}>
              <option value="">Kõik</option>
              {staffUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name ?? user.email}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <input type="hidden" name="actor" value={session.userId} />
        )}
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Tegevus
          <select name="group" className={filterSelectClass} defaultValue={currentValues.group ?? ''}>
            <option value="">Kõik rühmad</option>
            {auditActionGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
            <option value={UNGROUPED_GROUP_ID}>{groupLabel(UNGROUPED_GROUP_ID)}</option>
          </select>
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Olem
          <select name="entityType" className={filterSelectClass} defaultValue={currentValues.entityType ?? ''}>
            <option value="">Kõik olemid</option>
            {entityTypes.map((entityType) => (
              <option key={entityType} value={entityType}>
                {entityTypeLabel(entityType)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Alates
          <input type="date" name="from" defaultValue={currentValues.from ?? ''} className={filterSelectClass} />
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          kuni
          <input type="date" name="to" defaultValue={currentValues.to ?? ''} className={filterSelectClass} />
        </label>
        <label className="flex items-center gap-xs text-label text-ink-muted">
          Olemi ID
          <input
            type="search"
            name="entityId"
            placeholder="Täpne ID"
            defaultValue={currentValues.entityId ?? ''}
            className="h-9 w-56 rounded-input border border-border bg-bgPage px-2 text-bodySm text-ink"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-button border border-border px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
        >
          Filtreeri
        </button>
        <Link
          href="/admin/audit"
          className="text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:text-primary"
        >
          Tühjenda{activeFilterCount > 0 ? ` (${String(activeFilterCount)})` : ''}
        </Link>
      </form>

      {detail ? (
        <section className="mb-md rounded-card border border-border bg-bgPage p-md" aria-label="Kirje detail">
          <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
            <h2 className="font-mono text-bodySm font-semibold text-ink">{detail.action}</h2>
            <Link
              href={buildUrl({ entry: undefined })}
              className="text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:text-primary"
            >
              Sulge ×
            </Link>
          </div>
          <dl className="mb-sm grid grid-cols-[10rem_1fr] gap-x-sm gap-y-2xs text-bodySm text-ink">
            <dt className="text-ink-muted">Aeg</dt>
            <dd>{formatDateTime(detail.createdAt)}</dd>
            <dt className="text-ink-muted">Tegija</dt>
            <dd>
              {(() => {
                const actor = detail.actorId ? actorByid.get(detail.actorId) : undefined
                const name = actor ? (actor.name ?? actor.email) : (detail.actorId ?? '—')
                return actor ? `${name} (${userRoleLabels[actor.role]})` : name
              })()}
            </dd>
            <dt className="text-ink-muted">Olem</dt>
            <dd>
              {entityTypeLabel(detail.entityType)}
              {detail.entityId ? (
                <span className="ml-1 font-mono text-ink-muted" title={detail.entityId}>
                  #{detail.entityId.slice(0, 8)}
                </span>
              ) : null}
            </dd>
          </dl>
          <AuditDiff before={detail.before} after={detail.after} />
          <p className="mt-xs text-label text-ink-muted">{SECRET_NOTE}</p>
        </section>
      ) : null}

      <DataTable
        columns={[
          { key: 'createdAt', label: 'Aeg', render: (row) => <time dateTime={row.createdAt}>{formatDateTime(row.createdAt)}</time> },
          {
            key: 'actorName',
            label: 'Tegija',
            render: (row) => (
              <span className="flex items-center gap-1">
                {row.actorName}
                {row.actorRole ? (
                  <span className="inline-flex items-center rounded-pill bg-bgMist px-2 py-0.5 text-[11px] font-semibold text-ink-muted">
                    {row.actorRole}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'action',
            label: 'Tegevus',
            render: (row) => (
              <span className="font-mono" title={groupLabel(row.actionGroup)}>
                {row.action}
              </span>
            ),
          },
          {
            key: 'entity',
            label: 'Olem',
            render: (row) => (
              <span>
                {entityTypeLabel(row.entityType)}
                {row.entityId ? (
                  <span className="ml-1 font-mono text-ink-muted" title={row.entityId}>
                    #{row.entityId.slice(0, 8)}
                  </span>
                ) : null}
              </span>
            ),
          },
          {
            key: 'hasDiff',
            label: 'Enne / Järel',
            render: (row) =>
              row.hasDiff ? (
                <span title="Kirjel on enne/järel andmed">▦</span>
              ) : (
                <span className="text-ink-muted">—</span>
              ),
          },
          {
            key: 'detail',
            label: 'Detail',
            render: (row) => (
              <Link
                href={buildUrl({ entry: row.id, page: undefined })}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                Ava
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyLabel={EMPTY_LABEL}
      />

      <div className="mt-sm flex items-center justify-between text-label text-ink-muted">
        <span>
          {totalCount === 0
            ? '0 kirjet'
            : `${String((safePage - 1) * PAGE_SIZE + 1)}–${String(Math.min(safePage * PAGE_SIZE, totalCount))} / ${String(totalCount)}`}
        </span>
        <span className="flex items-center gap-sm">
          {safePage > 1 ? (
            <Link href={buildUrl({ page: String(safePage - 1) })} className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover">
              ‹ Eelmine
            </Link>
          ) : null}
          <span>
            Leht {String(safePage)} / {String(pageCount)}
          </span>
          {safePage < pageCount ? (
            <Link href={buildUrl({ page: String(safePage + 1) })} className="font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover">
              Järgmine ›
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  )
}
