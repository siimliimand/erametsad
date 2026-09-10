import { deleteTestimonialAction } from '../../../_actions/content'
import { AdminLink } from '../../../_components/AdminLink'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import { contentStatusLabels, formatDateTime } from '../../../_lib/labels'

import type { ContentStatus } from '@/lib/data/schema'

interface TestimonialRow {
  id: string
  name: string
  role: string | null
  featured: boolean
  status: ContentStatus
  rating: number | null
  createdAt: string
}

export const metadata = { title: 'Tagasiside' }

export default async function AdminTestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'testimonials',
    sort: '-createdAt',
    limit: 50,
  })
  const rows: TestimonialRow[] = docs.map((testimonial) => ({
    id: testimonial.id,
    name: testimonial.name,
    role: testimonial.role,
    featured: testimonial.featured,
    status: testimonial.status,
    rating: testimonial.rating,
    createdAt: testimonial.createdAt,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Tagasiside"
        description="Klientide tagasiside ja esile tõstetud tsitaadid."
        backHref="/admin/content"
        actions={
          <AdminLink href="/content/testimonials/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus tagasiside
          </AdminLink>
        }
      />
      <DataTable
        columns={[
          {
            key: 'name',
            label: 'Nimi',
            render: (row) => (
              <AdminLink
                href={`/content/testimonials/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.name}
              </AdminLink>
            ),
          },
          { key: 'role', label: 'Amet', render: (row) => row.role ?? '—' },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => contentStatusLabels[row.status],
          },
          {
            key: 'rating',
            label: 'Hinne',
            render: (row) => row.rating ?? '—',
          },
          {
            key: 'featured',
            label: 'Esile tõstetud',
            render: (row) => (row.featured ? 'Jah' : 'Ei'),
          },
          {
            key: 'createdAt',
            label: 'Loodud',
            render: (row) => formatDateTime(row.createdAt),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteTestimonialAction}>
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
        emptyLabel="Tagasisidet ei ole. Lisa esimene tsitaat."
      />
    </div>
  )
}
