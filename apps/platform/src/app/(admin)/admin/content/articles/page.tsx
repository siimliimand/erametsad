
import { articleCategoryLabels } from './_lib/article-seo'
import { deleteArticleAction, setArticleStatusAction } from '../../../_actions/content'
import { AdminLink } from '../../../_components/AdminLink'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { primaryButtonClass } from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { PlusIcon } from '../../../_components/icons'
import { requireAdminRepositories } from '../../../_lib/admin'
import { ContentStatusPill, formatDateTime } from '../../../_lib/labels'

import type { ArticleDoc } from '@/lib/data/repositories'

interface ArticleRow {
  id: string
  title: string
  category: ArticleDoc['category']
  authorName: string
  status: ArticleDoc['status']
  publishedAt: string | null
}

export const metadata = { title: 'Artiklid' }

export default async function AdminArticlesPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const [{ docs }, { docs: specialists }] = await Promise.all([
    repositories.find({
      collection: 'articles',
      sort: '-createdAt',
      limit: 50,
    }),
    repositories.find({ collection: 'specialists', pagination: false }),
  ])
  const specialistNames = new Map(specialists.map((specialist) => [specialist.id, specialist.name]))

  const rows: ArticleRow[] = docs.map((article) => ({
    id: article.id,
    title: article.title,
    category: article.category,
    authorName:
      (article.authorSpecialistId ? specialistNames.get(article.authorSpecialistId) : null) ??
      article.author ??
      '—',
    status: article.status,
    publishedAt: article.publishedAt,
  }))

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Artiklid"
        description="Uudised ja ajaveebi postitused koos avaliku olekuga."
        actions={
          <AdminLink href="/content/articles/new" className={primaryButtonClass}>
            <PlusIcon />
            Uus artikkel
          </AdminLink>
        }
      />
      <DataTable
        columns={[
          {
            key: 'title',
            label: 'Pealkiri',
            render: (row) => (
              <AdminLink
                href={`/content/articles/${row.id}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.title}
              </AdminLink>
            ),
          },
          {
            key: 'category',
            label: 'Kategooria',
            render: (row) => articleCategoryLabels[row.category],
          },
          {
            key: 'authorName',
            label: 'Autor',
            render: (row) => row.authorName,
          },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <ContentStatusPill status={row.status} />,
          },
          {
            key: 'publishedAt',
            label: 'Avaldatud',
            render: (row) => formatDateTime(row.publishedAt),
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) => (
              <div className="flex items-center gap-sm">
                <form action={setArticleStatusAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <input
                    type="hidden"
                    name="status"
                    value={row.status === 'draft' ? 'published' : 'draft'}
                  />
                  <button
                    type="submit"
                    className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
                  >
                    {row.status === 'draft' ? 'Avalda' : 'Peida'}
                  </button>
                </form>
                <form action={deleteArticleAction}>
                  <input type="hidden" name="id" value={row.id} />
                  <button
                    type="submit"
                    className="text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:text-danger/80"
                  >
                    Kustuta
                  </button>
                </form>
              </div>
            ),
          },
        ]}
        rows={rows}
        emptyLabel="Artikleid ei ole. Loo esimene artikkel."
      />
    </div>
  )
}
