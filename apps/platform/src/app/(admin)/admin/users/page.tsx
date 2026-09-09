import Link from 'next/link'

import { OpenUserDrawerButton, UserDrawerProvider } from './_components/UserDrawer'
import {
  chunkIds,
  classifyUserSearch,
  DEFAULT_USER_SORT,
  freetextMatchesUser,
  parseUserListFilters,
  sortUserRows,
} from './_components/user-search'
import { DataTable } from '../../_components/DataTable'
import type { DataTableColumnSort } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import {
  auctionObjectTypeLabels,
  formatDateTime,
  maskIsikukood,
  userRoleLabels,
  userStatusLabels,
  UserStatusPill,
} from '../../_lib/labels'
import { can } from '../../_lib/permissions'

import type { ProfileDoc, UserDoc, WhereClause } from '@/lib/data/repositories'
import { auctionObjectTypes, userRoles, userStatuses } from '@/lib/data/schema'
import { db } from '@/lib/db'

const SEARCH_LIMIT = 50
// The repository layer has no LIKE operator yet; freetext filtering over
// email/name happens in JS on a single bounded fetch (auctions list uses
// the same pattern).
const FREETEXT_FETCH_LIMIT = 2000
const BID_COUNT_LIMIT = 2000

const SEARCH_HINT = 'Otsi: isikukood / e-post / registrikood / nimi'

const profileTypeLabels: Record<ProfileDoc['type'], string> = {
  private: 'Eraisik',
  company: 'Ettevõte',
}

const profileApprovalLabels: Record<ProfileDoc['approvalStatus'], string> = {
  pending: 'Ootel',
  approved: 'Kinnitatud',
  rejected: 'Tagasi lükatud',
}

const profileChipClass: Record<ProfileDoc['approvalStatus'], string> = {
  approved: 'bg-primary-light text-primaryDark',
  pending: 'bg-[var(--st-ended-bg)] text-[color:var(--st-ended-text)]',
  rejected: 'bg-danger-light text-danger',
}

type RawParams = Record<string, string | string[] | undefined>

function firstParam(params: RawParams, key: string): string {
  const value = params[key]
  const first = Array.isArray(value) ? value[0] : value
  return first ?? ''
}

function SuccessNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-md rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
    >
      {message}
    </div>
  )
}

interface ProfileChip {
  id: string
  type: ProfileDoc['type']
  approvalStatus: ProfileDoc['approvalStatus']
  companyName: string | null
}

interface UserRow {
  id: string
  name: string | null
  email: string
  isikukoodMasked: string
  role: UserDoc['role']
  status: UserDoc['status']
  createdAt: string
  lastLogin: string | null
  profiles: ProfileChip[]
  rights: string[]
  bidCount: number
}

export const metadata = { title: 'Kasutajad' }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>
}) {
  const params = await searchParams
  const viga = firstParam(params, 'viga')
  const teade = firstParam(params, 'teade')
  const q = firstParam(params, 'q').trim()
  const filters = parseUserListFilters({
    profile: firstParam(params, 'profile'),
    status: firstParam(params, 'status'),
    right: firstParam(params, 'right'),
  })
  const sort = firstParam(params, 'sort') || DEFAULT_USER_SORT

  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    return (
      <div>
        <PageHeader title="Kasutajad" />
        <ErrorNotice message="Ainult administraatorile." />
      </div>
    )
  }

  const query = classifyUserSearch(q)

  // Role and status translate into the repository where clause; freetext and
  // the right filter run in JS over one bounded fetch (auctions list pattern).
  const whereParts: WhereClause[] = []
  if (filters.role) whereParts.push({ role: { equals: filters.role } })
  if (filters.status) whereParts.push({ status: { equals: filters.status } })
  const userWhere: WhereClause | undefined =
    whereParts.length === 0
      ? undefined
      : whereParts.length === 1
        ? whereParts[0]
        : ({ and: whereParts } satisfies WhereClause)

  let docs: UserDoc[]
  if (query?.kind === 'isikukood') {
    docs = (
      await repositories.find({
        collection: 'users',
        where: userWhere
          ? ({ and: [userWhere, { isikukoodHash: { equals: query.hash } }] } satisfies WhereClause)
          : ({ isikukoodHash: { equals: query.hash } } satisfies WhereClause),
        sort: '-createdAt',
        pagination: false,
        limit: FREETEXT_FETCH_LIMIT,
      })
    ).docs
  } else {
    const [all, regCodeMatches] = await Promise.all([
      repositories.find({
        collection: 'users',
        ...(userWhere ? { where: userWhere } : {}),
        sort: '-createdAt',
        pagination: false,
        limit: FREETEXT_FETCH_LIMIT,
      }),
      query?.kind === 'freetext'
        ? repositories.find({
            collection: 'profile',
            where: { companyRegCode: { equals: query.registrikood } } satisfies WhereClause,
            limit: 100,
          })
        : Promise.resolve({ docs: [] as ProfileDoc[] }),
    ])
    const regCodeUserIds = new Set(regCodeMatches.docs.map((profile) => profile.userId))
    docs = all.docs.filter(
      (user) => !query || freetextMatchesUser(user, query) || regCodeUserIds.has(user.id),
    )
  }

  // Right filter keeps only users holding an active (non-revoked) right of
  // the picked object type.
  if (filters.right) {
    const { docs: rightHolders } = await repositories.find({
      collection: 'auction-rights',
      where: {
        and: [
          { objectType: { equals: filters.right } },
          { revokedAt: { exists: false } },
        ],
      } satisfies WhereClause,
      pagination: false,
      limit: FREETEXT_FETCH_LIMIT,
    })
    const holderIds = new Set(rightHolders.map((right) => right.userId))
    docs = docs.filter((user) => holderIds.has(user.id))
  }

  // Last login comes from the sessions table (no repository collection for
  // it): one grouped query per id chunk, impersonated view sessions excluded.
  const lastLogins = new Map<string, string>()
  for (const chunk of chunkIds(docs.map((user) => user.id))) {
    const placeholders = chunk.map(() => '?').join(', ')
    const result = await db.query<{ user_id: string; last_login: string }>(
      `SELECT user_id, MAX(created_at) AS last_login FROM sessions
       WHERE impersonated_by IS NULL AND user_id IN (${placeholders})
       GROUP BY user_id`,
      chunk,
    )
    for (const row of result.results) {
      lastLogins.set(row.user_id, row.last_login)
    }
  }

  const docById = new Map(docs.map((user) => [user.id, user]))
  const pageDocs = sortUserRows(
    docs.map((user) => ({
      id: user.id,
      createdAt: user.createdAt,
      lastLogin: lastLogins.get(user.id) ?? null,
    })),
    sort,
  )
    .slice(0, SEARCH_LIMIT)
    .map((view) => docById.get(view.id))
    .filter((user): user is UserDoc => user !== undefined)

  // Enrichment runs on the displayed slice only.
  const pageIds = pageDocs.map((user) => user.id)
  const [profileDocs, rightDocs, bidDocs] = await Promise.all([
    pageIds.length > 0
      ? repositories.find({
          collection: 'profile',
          where: { user: { in: pageIds } },
          pagination: false,
        })
      : Promise.resolve({ docs: [] as ProfileDoc[] }),
    pageIds.length > 0
      ? repositories.find({
          collection: 'auction-rights',
          where: { user: { in: pageIds } },
          pagination: false,
        })
      : Promise.resolve({ docs: [] as { userId: string; objectType: (typeof auctionObjectTypes)[number]; revokedAt: string | null }[] }),
    pageIds.length > 0
      ? repositories.find({
          collection: 'bids',
          where: { user: { in: pageIds } },
          pagination: false,
          limit: BID_COUNT_LIMIT,
        })
      : Promise.resolve({ docs: [] as { userId: string }[] }),
  ])

  const profilesByUser = new Map<string, ProfileDoc[]>()
  for (const profile of profileDocs.docs) {
    const list = profilesByUser.get(profile.userId) ?? []
    list.push(profile)
    profilesByUser.set(profile.userId, list)
  }

  const activeRightsByUser = new Map<string, (typeof auctionObjectTypes)[number][]>()
  for (const right of rightDocs.docs) {
    if (right.revokedAt !== null) continue
    const list = activeRightsByUser.get(right.userId) ?? []
    list.push(right.objectType)
    activeRightsByUser.set(right.userId, list)
  }

  const bidCounts = new Map<string, number>()
  for (const bid of bidDocs.docs) {
    bidCounts.set(bid.userId, (bidCounts.get(bid.userId) ?? 0) + 1)
  }

  const rows: UserRow[] = pageDocs.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isikukoodMasked: maskIsikukood(user.isikukood),
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    lastLogin: lastLogins.get(user.id) ?? null,
    profiles: (profilesByUser.get(user.id) ?? []).map((profile) => ({
      id: profile.id,
      type: profile.type,
      approvalStatus: profile.approvalStatus,
      companyName: profile.companyName,
    })),
    rights: [...new Set(activeRightsByUser.get(user.id) ?? [])].map(
      (objectType) => auctionObjectTypeLabels[objectType],
    ),
    bidCount: bidCounts.get(user.id) ?? 0,
  }))

  const currentValues = {
    q: q || undefined,
    profile: filters.role ?? undefined,
    status: filters.status ?? undefined,
    right: filters.right ?? undefined,
    sort: firstParam(params, 'sort'),
  }

  function buildUrl(overrides: Record<string, string | undefined>): string {
    const search = new URLSearchParams()
    for (const [key, value] of Object.entries({ ...currentValues, ...overrides })) {
      if (value) search.set(key, value)
    }
    const queryString = search.toString()
    return queryString === '' ? '/admin/users' : `/admin/users?${queryString}`
  }

  // asc → desc → asc toggle; the list opens on last login descending.
  function lastLoginSort(): DataTableColumnSort {
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    if (sortField !== 'lastLogin') return { href: buildUrl({ sort: 'lastLogin' }) }
    return sort.startsWith('-')
      ? { dir: 'desc', href: buildUrl({ sort: 'lastLogin' }) }
      : { dir: 'asc', href: buildUrl({ sort: '-lastLogin' }) }
  }

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? <SuccessNotice message={teade} /> : null}
      <PageHeader title="Kasutajad" description="Kasutajate otsing, õigused ja haldus." />

      <form
        method="get"
        className="mb-md flex max-w-container-sm flex-wrap items-end gap-sm rounded-card border border-border bg-bgPage p-md"
      >
        <div className="w-full max-w-80">
          <FormField
            label="Otsing"
            name="q"
            type="search"
            defaultValue={q}
            hint={SEARCH_HINT}
          />
        </div>
        <div className="w-36">
          <FormSelectField
            label="Profiil"
            name="profile"
            defaultValue={filters.role ?? ''}
            options={[
              { value: '', label: 'Kõik' },
              ...userRoles.map((role) => ({ value: role, label: userRoleLabels[role] })),
            ]}
          />
        </div>
        <div className="w-32">
          <FormSelectField
            label="Olek"
            name="status"
            defaultValue={filters.status ?? ''}
            options={[
              { value: '', label: 'Kõik' },
              ...userStatuses.map((status) => ({ value: status, label: userStatusLabels[status] })),
            ]}
          />
        </div>
        <div className="w-40">
          <FormSelectField
            label="Õigus"
            name="right"
            defaultValue={filters.right ?? ''}
            options={[
              { value: '', label: 'Kõik' },
              ...auctionObjectTypes.map((objectType) => ({
                value: objectType,
                label: auctionObjectTypeLabels[objectType],
              })),
            ]}
          />
        </div>
        <button type="submit" className={primaryButtonClass}>
          Otsi
        </button>
        {q || filters.role || filters.status || filters.right ? (
          <Link href="/admin/users" className={secondaryButtonClass}>
            Tühjenda
          </Link>
        ) : null}
      </form>

      <UserDrawerProvider>
        <DataTable
          columns={[
            { key: 'name', label: 'Nimi', render: (row) => row.name ?? '—' },
            { key: 'email', label: 'E-post' },
            {
              key: 'isikukoodMasked',
              label: 'Isikukood',
              render: (row) => <span className="font-mono">{row.isikukoodMasked}</span>,
            },
            {
              key: 'status',
              label: 'Olek',
              render: (row) => <UserStatusPill status={row.status} />,
            },
            {
              key: 'profiles',
              label: 'Profiilid',
              render: (row) =>
                row.profiles.length > 0 ? (
                  <span className="flex flex-wrap gap-1">
                    {row.profiles.map((profile) => (
                      <span
                        key={profile.id}
                        className={`inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold ${profileChipClass[profile.approvalStatus]}`}
                      >
                        {profile.type === 'company'
                          ? (profile.companyName ?? profileTypeLabels.company)
                          : profileTypeLabels.private}
                        <span className="font-medium opacity-80">
                          · {profileApprovalLabels[profile.approvalStatus]}
                        </span>
                      </span>
                    ))}
                  </span>
                ) : (
                  '—'
                ),
            },
            {
              key: 'rights',
              label: 'Õigused',
              render: (row) => (row.rights.length > 0 ? row.rights.join(', ') : '—'),
            },
            { key: 'bidCount', label: 'Pakkumised' },
            {
              key: 'lastLogin',
              label: 'Viimane sisselogimine',
              sort: lastLoginSort(),
              render: (row) => (row.lastLogin ? formatDateTime(row.lastLogin) : '—'),
            },
            {
              key: 'actions',
              label: 'Tegevused',
              render: (row) => (
                <span className="inline-flex items-center gap-sm">
                  <OpenUserDrawerButton user={row} />
                  <Link
                    href={`/admin/users/${row.id}`}
                    className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                  >
                    Ava
                  </Link>
                </span>
              ),
            },
          ]}
          rows={rows}
          emptyLabel={
            q || filters.role || filters.status || filters.right
              ? 'Kasutajat ei leitud — kontrolli otsingusõna või filtreid.'
              : 'Kasutajaid ei ole.'
          }
        />
      </UserDrawerProvider>
    </div>
  )
}
