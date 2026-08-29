import { ErrorNotice } from '../../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../../_components/PageHeader'
import { FaqCategoryForm } from '../../../_components/FaqCategoryForm'

export const metadata = { title: 'Uus kategooria' }

export default async function NewFaqCategoryPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus kategooria"
        description="Loo KKK kategooria küsimuste rühmitamiseks."
        backHref="/admin/content/faq/categories"
      />
      <FaqCategoryForm />
    </div>
  )
}
