import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { SpecialistForm } from '../../_components/SpecialistForm'

export const metadata = { title: 'Uus spetsialist' }

export default async function NewSpecialistPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus spetsialist"
        description="Lisa spetsialist koos kontaktide ja piirkonnaga."
        backHref="/admin/content/specialists"
      />
      <SpecialistForm />
    </div>
  )
}
