import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { TestimonialForm } from '../../_components/TestimonialForm'

export const metadata = { title: 'Muuda tagasisidet' }

export default async function EditTestimonialPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const testimonial = await repositories.findByID({ collection: 'testimonials', id })
  if (!testimonial) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={testimonial.name}
        description="Muuda tsitaati, ametit ja esiletõstmist."
        backHref="/admin/content/testimonials"
      />
      <TestimonialForm testimonial={testimonial} />
    </div>
  )
}
