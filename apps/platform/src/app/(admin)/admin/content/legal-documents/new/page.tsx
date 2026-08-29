import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { LegalDocumentForm } from '../../_components/LegalDocumentForm'

export const metadata = { title: 'Uus dokument' }

export default async function NewLegalDocumentPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus dokument"
        description="Loo õigusdokument koos versiooni ja jõustumiskuupäevaga."
        backHref="/admin/content/legal-documents"
      />
      <LegalDocumentForm />
    </div>
  )
}
