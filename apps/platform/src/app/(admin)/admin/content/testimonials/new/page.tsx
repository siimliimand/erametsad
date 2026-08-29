import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { TestimonialForm } from '../../_components/TestimonialForm'

export const metadata = { title: 'Uus tagasiside' }

export default async function NewTestimonialPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus tagasiside"
        description="Lisa kliendi tsitaat koos ameti ja fotoga."
        backHref="/admin/content/testimonials"
      />
      <TestimonialForm />
    </div>
  )
}
