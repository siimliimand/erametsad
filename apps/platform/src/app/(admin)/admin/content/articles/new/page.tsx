import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { ArticleForm } from '../../_components/ArticleForm'

export const metadata = { title: 'Uus artikkel' }

export default async function NewArticlePage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus artikkel"
        description="Loo artikkel mustandina ja avalda see hiljem."
        backHref="/admin/content/articles"
      />
      <ArticleForm />
    </div>
  )
}
