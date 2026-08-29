import Link from 'next/link'

import { deleteSpecialistAction } from '../../../_actions/content'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'

interface SpecialistRow {
  id: string
  name: string
  role: string | null
  phone: string | null
  region: string | null
  active: boolean
}

export const metadata = { title: 'Spetsialistid' }

export default async function AdminSpecialistsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'specialists',
    sort: 'order',
    pagination: false,
  })
  const rows: SpecialistRow[] = docs.map((specialist) => ({
    id: specialist.id,
    name: specialist.name,
    role: specialist.role,
    phone: specialist.phone,
    region: specialist.region,
    active: specialist.active,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Spetsialistid"
        description="Meeskonna spetsialistid koos kontaktidega."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/specialists/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus spetsialist
          </Link>
        }
      />
      <DataTable
        columns={[
          {
            key: 'name',
            label: 'Nimi',
            render: (row) => (
              <Link
                href={`/admin/content/specialists/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.name}
              </Link>
            ),
          },
          { key: 'role', label: 'Amet', render: (row) => row.role ?? '—' },
          { key: 'phone', label: 'Telefon', render: (row) => row.phone ?? '—' },
          { key: 'region', label: 'Piirkond', render: (row) => row.region ?? '—' },
          {
            key: 'active',
            label: 'Aktiivne',
            render: (row) => (row.active ? 'Jah' : 'Ei'),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteSpecialistAction}>
                <input type="hidden" name="id" value={row.id} />
                <button
                  type="submit"
                  className="text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80"
                >
                  Kustuta
                </button>
              </form>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Spetsialiste ei ole. Lisa esimene spetsialist."
      />
    </div>
  )
}
