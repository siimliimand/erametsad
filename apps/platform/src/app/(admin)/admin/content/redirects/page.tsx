import Link from 'next/link'

import { deleteRedirectAction } from '../../../_actions/content'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import { redirectTypeLabels } from '../../../_lib/labels'

import type { RedirectType } from '@/lib/data/schema'

interface RedirectRow {
  id: string
  from: string
  to: string
  type: RedirectType
  active: boolean
}

export const metadata = { title: 'Suunamised' }

export default async function AdminRedirectsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'redirects',
    sort: 'from',
    pagination: false,
  })
  const rows: RedirectRow[] = docs.map((redirect) => ({
    id: redirect.id,
    from: redirect.from,
    to: redirect.to,
    type: redirect.type,
    active: redirect.active,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Suunamised"
        description="Vanad URL-id suunatakse uutele aadressitele."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/redirects/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus suunamine
          </Link>
        }
      />
      <DataTable
        columns={[
          {
            key: 'from',
            label: 'Kust',
            render: (row) => (
              <Link
                href={`/admin/content/redirects/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.from}
              </Link>
            ),
          },
          { key: 'to', label: 'Kuhu' },
          {
            key: 'type',
            label: 'Tüüp',
            render: (row) => redirectTypeLabels[row.type],
          },
          {
            key: 'active',
            label: 'Aktiivne',
            render: (row) => (row.active ? 'Jah' : 'Ei'),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteRedirectAction}>
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
        emptyLabel="Suunamisi ei ole."
      />
    </div>
  )
}
