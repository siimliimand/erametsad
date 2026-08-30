import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { RedirectForm } from '../../_components/RedirectForm'

export const metadata = { title: 'Muuda suunamist' }

export default async function EditRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const redirect = await repositories.findByID({ collection: 'redirects', id })
  if (!redirect) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={redirect.from}
        description="Muuda suunamise sihtkohta ja tüüpi."
        backHref="/admin/content/redirects"
      />
      <RedirectForm redirect={redirect} />
    </div>
  )
}
