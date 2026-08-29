import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { PageForm } from '../../_components/PageForm'

export const metadata = { title: 'Muuda lehte' }

export default async function EditContentPagePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const page = await repositories.findByID({ collection: 'pages', id })
  if (!page) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={page.title}
        description="Muuda lehe SEO andmeid, paigutust ja avaliku olekut."
        backHref="/admin/content/pages"
      />
      <PageForm page={page} />
    </div>
  )
}
