import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../../_lib/admin'
import { FaqCategoryForm } from '../../../_components/FaqCategoryForm'

export const metadata = { title: 'Muuda kategooriat' }

export default async function EditFaqCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const category = await repositories.findByID({ collection: 'faq-categories', id })
  if (!category) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={category.title}
        description="Muuda kategooria pealkirja ja järjekorda."
        backHref="/admin/content/faq/categories"
      />
      <FaqCategoryForm category={category} />
    </div>
  )
}
