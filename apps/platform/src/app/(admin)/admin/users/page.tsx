import Link from 'next/link'

import { classifyUserSearch, freetextMatchesUser } from './_components/user-search'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { FormField, primaryButtonClass, secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, maskIsikukood, UserStatusPill, userRoleLabels } from '../../_lib/labels'
import { can } from '../../_lib/permissions'

import type { UserDoc, WhereClause } from '@/lib/data/repositories'

const SEARCH_LIMIT = 50
// The repository layer has no LIKE operator yet; freetext filtering over
// email/name happens in JS on a single bounded fetch (auctions list uses
// the same pattern).
const FREETEXT_FETCH_LIMIT = 2000

const SEARCH_HINT = 'Otsi: isikukood / e-post / registrikood / nimi'

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

interface UserRow {
  id: string
  name: string | null
  email: string
  isikukoodMasked: string
  role: UserDoc['role']
  status: UserDoc['status']
  createdAt: string
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

  let docs: UserDoc[]
  if (query === null) {
    docs = (
      await repositories.find({
        collection: 'users',
        sort: '-createdAt',
        limit: SEARCH_LIMIT,
      })
    ).docs
  } else if (query.kind === 'isikukood') {
    docs = (
      await repositories.find({
        collection: 'users',
        where: { isikukoodHash: { equals: query.hash } } satisfies WhereClause,
        sort: '-createdAt',
        limit: SEARCH_LIMIT,
      })
    ).docs
  } else {
    const [all, regCodeMatches] = await Promise.all([
      repositories.find({
        collection: 'users',
        sort: '-createdAt',
        pagination: false,
        limit: FREETEXT_FETCH_LIMIT,
      }),
      repositories.find({
        collection: 'profile',
        where: { companyRegCode: { equals: query.registrikood } } satisfies WhereClause,
        limit: 100,
      }),
    ])
    const regCodeUserIds = new Set(regCodeMatches.docs.map((profile) => profile.userId))
    docs = all.docs.filter(
      (user) => freetextMatchesUser(user, query) || regCodeUserIds.has(user.id),
    )
  }

  const rows: UserRow[] = docs.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    isikukoodMasked: maskIsikukood(user.isikukood),
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? <SuccessNotice message={teade} /> : null}
      <PageHeader title="Kasutajad" description="Kasutajate otsing, õigused ja haldus." />

      <form
        method="get"
        className="mb-md flex max-w-container-sm flex-wrap items-end gap-sm rounded-card border border-border bg-bgPage p-md"
      >
        <div className="w-80">
          <FormField
            label="Otsing"
            name="q"
            type="search"
            defaultValue={q}
            hint={SEARCH_HINT}
          />
        </div>
        <button type="submit" className={primaryButtonClass}>
          Otsi
        </button>
        {q ? (
          <Link href="/admin/users" className={secondaryButtonClass}>
            Tühista otsing
          </Link>
        ) : null}
      </form>

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
            key: 'role',
            label: 'Roll',
            render: (row) => userRoleLabels[row.role],
          },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <UserStatusPill status={row.status} />,
          },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <Link
                href={`/admin/users/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                Ava
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyLabel={q ? 'Kasutajat ei leitud — kontrolli isikukoodi või otsingusõna.' : 'Kasutajaid ei ole.'}
      />
    </div>
  )
}
