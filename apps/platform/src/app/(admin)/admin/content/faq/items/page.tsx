import Link from 'next/link'

import { deleteFaqItemAction } from '../../../../_actions/content'
import { DataTable } from '../../../../_components/DataTable'
import { ErrorNotice } from '../../../../_components/ErrorNotice'
import {
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../../_components/FormField'
import { PageHeader } from '../../../../_components/PageHeader'
import { PlusIcon } from '../../../../_components/icons'
import { requireAdminRepositories } from '../../../../_lib/admin'

interface FaqItemRow {
  id: string
  question: string
  categoryTitle: string
  order: number
}

export const metadata = { title: 'KKK küsimused' }

export default async function AdminFaqItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; kategooria?: string }>
}) {
  const { viga, kategooria } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const [categories, items] = await Promise.all([
    repositories.find({ collection: 'faq-categories', sort: 'order', pagination: false }),
    repositories.find({
      collection: 'faq-items',
      ...(kategooria ? { where: { categoryId: { equals: kategooria } } } : {}),
      sort: 'order',
      pagination: false,
    }),
  ])
  const categoryTitles = new Map(categories.docs.map((category) => [category.id, category.title]))
  const rows: FaqItemRow[] = items.docs.map((item) => ({
    id: item.id,
    question: item.question,
    categoryTitle: categoryTitles.get(item.categoryId) ?? '—',
    order: item.order,
  }))

  const filterOptions = [
    { value: '', label: 'Kõik kategooriad' },
    ...categories.docs.map((category) => ({ value: category.id, label: category.title })),
  ]

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="KKK küsimused"
        description="Korduma kippuvad küsimused koos kategooriaga."
        backHref="/admin/content"
        actions={
          <Link href="/admin/content/faq/items/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus küsimus
          </Link>
        }
      />
      <form className="mb-md flex flex-wrap items-end gap-sm">
        <div className="w-64">
          <FormSelectField
            label="Kategooria"
            name="kategooria"
            options={filterOptions}
            defaultValue={kategooria ?? ''}
          />
        </div>
        <button type="submit" className={secondaryButtonClass}>
          Filtreeri
        </button>
      </form>
      <DataTable
        columns={[
          {
            key: 'question',
            label: 'Küsimus',
            render: (row) => (
              <Link
                href={`/admin/content/faq/items/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.question}
              </Link>
            ),
          },
          { key: 'categoryTitle', label: 'Kategooria' },
          { key: 'order', label: 'Järjekord' },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <form action={deleteFaqItemAction}>
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
        emptyLabel="Küsimusi ei ole. Loo esimene küsimus."
      />
    </div>
  )
}
