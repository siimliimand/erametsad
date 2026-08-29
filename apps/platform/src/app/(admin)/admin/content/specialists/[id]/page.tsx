import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { SpecialistForm } from '../../_components/SpecialistForm'

export const metadata = { title: 'Muuda spetsialisti' }

export default async function EditSpecialistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const specialist = await repositories.findByID({ collection: 'specialists', id })
  if (!specialist) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={specialist.name}
        description="Muuda spetsialisti kontaktandmeid ja profiili."
        backHref="/admin/content/specialists"
      />
      <SpecialistForm specialist={specialist} />
    </div>
  )
}
