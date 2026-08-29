import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../../_lib/admin'
import { FaqItemForm } from '../../../_components/FaqItemForm'

export const metadata = { title: 'Muuda küsimust' }

export default async function EditFaqItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const [item, categories] = await Promise.all([
    repositories.findByID({ collection: 'faq-items', id }),
    repositories.find({ collection: 'faq-categories', sort: 'order', pagination: false }),
  ])
  if (!item) notFound()

  const categoryOptions = categories.docs.map((category) => ({
    value: category.id,
    label: category.title,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={item.question}
        description="Muuda küsimust, vastust ja kategooriat."
        backHref="/admin/content/faq/items"
      />
      <FaqItemForm item={item} categories={categoryOptions} />
    </div>
  )
}
