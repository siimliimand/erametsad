import { ErrorNotice } from '../../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../../_lib/admin'
import { FaqItemForm } from '../../../_components/FaqItemForm'

export const metadata = { title: 'Uus küsimus' }

export default async function NewFaqItemPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs } = await repositories.find({
    collection: 'faq-categories',
    sort: 'order',
    pagination: false,
  })
  const categories = docs.map((category) => ({ value: category.id, label: category.title }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus küsimus"
        description="Lisa KKK küsimus koos vastusega."
        backHref="/admin/content/faq/items"
      />
      <FaqItemForm categories={categories} />
    </div>
  )
}
