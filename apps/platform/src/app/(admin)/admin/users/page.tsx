import Link from 'next/link'

import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, UserStatusPill, userRoleLabels } from '../../_lib/labels'

import type { UserDoc } from '@/lib/data/repositories'
import type { UserRole } from '@/lib/data/schema'

interface UserRow {
  id: string
  name: string | null
  email: string
  role: UserRole
  status: UserDoc['status']
  createdAt: string
}

export const metadata = { title: 'Kasutajad' }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'users',
    sort: '-createdAt',
    limit: 50,
  })
  const rows: UserRow[] = docs.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader title="Kasutajad" description="Kasutajate nimekiri koos rolli ja olekuga." />
      <DataTable
        columns={[
          { key: 'name', label: 'Nimi', render: (row) => row.name ?? '—' },
          { key: 'email', label: 'E-post' },
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
                Muuda
              </Link>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Kasutajaid ei ole."
      />
    </div>
  )
}
