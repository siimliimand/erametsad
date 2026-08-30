import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { PartnerServiceForm } from '../../_components/PartnerServiceForm'

export const metadata = { title: 'Muuda teenust' }

export default async function EditPartnerServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const service = await repositories.findByID({ collection: 'partner-services', id })
  if (!service) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={service.name}
        description="Muuda teenuse kirjeldust, järjekorda ja olekut."
        backHref="/admin/content/partner-services"
      />
      <PartnerServiceForm service={service} />
    </div>
  )
}
