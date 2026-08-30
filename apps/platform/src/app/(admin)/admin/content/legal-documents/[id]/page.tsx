import { notFound } from 'next/navigation'

import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { LegalDocumentForm } from '../../_components/LegalDocumentForm'

export const metadata = { title: 'Muuda dokumenti' }

export default async function EditLegalDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const document = await repositories.findByID({ collection: 'legal-documents', id })
  if (!document) notFound()

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={document.title}
        description="Muuda dokumendi sisu, versiooni ja avaliku olekut."
        backHref="/admin/content/legal-documents"
      />
      <LegalDocumentForm document={document} />
    </div>
  )
}
