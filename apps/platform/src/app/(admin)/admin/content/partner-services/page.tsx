import Link from 'next/link'

import { deletePartnerServiceAction } from '../../../_actions/content'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'

interface PartnerServiceRow {
  id: string
  name: string
  slug: string
  order: number
  active: boolean
}

export const metadata = { title: 'Partnerite teenused' }

export default async function AdminPartnerServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'partner-services',
    sort: 'order',
    pagination: false,
  })
  const rows: PartnerServiceRow[] = docs.map((service) => ({
    id: service.id,
    name: service.name,
    slug: service.slug,
    order: service.order,
    active: service.active,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Partnerite teenused"
        description="Partnerite teenuste nimekiri koos järjekorraga."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/partner-services/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus teenus
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
                href={`/admin/content/partner-services/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.name}
              </Link>
            ),
          },
          { key: 'slug', label: 'URL' },
          { key: 'order', label: 'Järjekord' },
          {
            key: 'active',
            label: 'Aktiivne',
            render: (row) => (row.active ? 'Jah' : 'Ei'),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deletePartnerServiceAction}>
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
        emptyLabel="Teenusi ei ole. Loo esimene teenus."
      />
    </div>
  )
}
