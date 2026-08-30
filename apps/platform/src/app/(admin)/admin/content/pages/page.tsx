import Link from 'next/link'

import { deletePageAction } from '../../../_actions/content'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import { ContentStatusPill, formatDateTime } from '../../../_lib/labels'

import type { PageDoc } from '@/lib/data/repositories'

interface ContentPageRow {
  id: string
  title: string
  slug: string
  status: PageDoc['status']
  publishedAt: string | null
}

export const metadata = { title: 'Lehed' }

export default async function AdminContentPagesPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'pages',
    sort: '-createdAt',
    limit: 50,
  })
  const rows: ContentPageRow[] = docs.map((page) => ({
    id: page.id,
    title: page.title,
    slug: page.slug,
    status: page.status,
    publishedAt: page.publishedAt,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Lehed"
        description="Staatilised lehed koos SEO andmete ja paigutusega."
        actions={
          <Link href="/admin/content/pages/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus leht
          </Link>
        }
      />
      <DataTable
        columns={[
          {
            key: 'title',
            label: 'Pealkiri',
            render: (row) => (
              <Link
                href={`/admin/content/pages/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.title}
              </Link>
            ),
          },
          { key: 'slug', label: 'URL' },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <ContentStatusPill status={row.status} />,
          },
          {
            key: 'publishedAt',
            label: 'Avaldatud',
            render: (row) => formatDateTime(row.publishedAt),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deletePageAction}>
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
        emptyLabel="Lehti ei ole. Loo esimene leht."
      />
    </div>
  )
}
