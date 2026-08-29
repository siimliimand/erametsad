import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { PartnerServiceForm } from '../../_components/PartnerServiceForm'

export const metadata = { title: 'Uus teenus' }

export default async function NewPartnerServicePage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus teenus"
        description="Lisa partneri teenus koos kirjelduse ja lingiga."
        backHref="/admin/content/partner-services"
      />
      <PartnerServiceForm />
    </div>
  )
}
