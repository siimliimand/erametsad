import { deleteFaqItemAction } from '../../../../_actions/content'
import { AdminLink } from '../../../../_components/AdminLink'
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
  active: boolean
  shortAnswer: string | null
  answer: string
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
    active: item.active,
    shortAnswer: item.shortAnswer,
    answer: item.answer,
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
          <AdminLink href="/content/faq/items/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus küsimus
          </AdminLink>
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
              <AdminLink
                href={`/content/faq/items/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.question}
              </AdminLink>
            ),
          },
          {
            key: 'answer',
            label: 'Vastus',
            render: (row) => (
              <div className="max-w-md space-y-xs">
                <p className="text-bodySm text-ink">{row.shortAnswer ?? '—'}</p>
                <details>
                  <summary className="cursor-pointer text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover">
                    Loe edasi…
                  </summary>
                  <p className="mt-xs text-bodySm whitespace-pre-wrap text-inkMuted">
                    {row.answer}
                  </p>
                </details>
              </div>
            ),
          },
          { key: 'categoryTitle', label: 'Kategooria' },
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
