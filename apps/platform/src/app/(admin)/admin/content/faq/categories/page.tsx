import Link from 'next/link'

import { deleteFaqCategoryAction } from '../../../../_actions/content'
import { DataTable } from '../../../../_components/DataTable'
import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../../_components/FormField'
import { PageHeader } from '../../../../_components/PageHeader'
import { PlusIcon } from '../../../../_components/icons'
import { requireAdminRepositories } from '../../../../_lib/admin'

interface FaqCategoryRow {
  id: string
  title: string
  slug: string
  order: number
  itemCount: number
}

export const metadata = { title: 'KKK kategooriad' }

export default async function AdminFaqCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const [categories, items] = await Promise.all([
    repositories.find({ collection: 'faq-categories', sort: 'order', pagination: false }),
    repositories.find({ collection: 'faq-items', pagination: false }),
  ])
  const itemCounts = new Map<string, number>()
  for (const item of items.docs) {
    itemCounts.set(item.categoryId, (itemCounts.get(item.categoryId) ?? 0) + 1)
  }
  const rows: FaqCategoryRow[] = categories.docs.map((category) => ({
    id: category.id,
    title: category.title,
    slug: category.slug,
    order: category.order,
    itemCount: itemCounts.get(category.id) ?? 0,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="KKK kategooriad"
        description="Korduma kippuvate küsimuste rühmad ja nende järjekord."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/faq/categories/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus kategooria
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
                href={`/admin/content/faq/categories/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.title}
              </Link>
            ),
          },
          { key: 'slug', label: 'URL' },
          { key: 'order', label: 'Järjekord' },
          { key: 'itemCount', label: 'Küsimusi' },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteFaqCategoryAction}>
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
        emptyLabel="Kategooriaid ei ole. Loo esimene kategooria."
      />
    </div>
  )
}
