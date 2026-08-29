import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { ArticleForm } from '../../_components/ArticleForm'

export const metadata = { title: 'Muuda artiklit' }

export default async function EditArticlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const article = await repositories.findByID({ collection: 'articles', id })
  if (!article) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={article.title}
        description="Muuda artikli sisu, silte ja avaliku olekut."
        backHref="/admin/content/articles"
      />
      <ArticleForm article={article} />
    </div>
  )
}
