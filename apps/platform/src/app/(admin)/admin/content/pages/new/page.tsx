import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { PageForm } from '../../_components/PageForm'

export const metadata = { title: 'Uus leht' }

export default async function NewContentPagePage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus leht"
        description="Loo leht mustandina. Paigutus sisestatakse JSON-ina."
        backHref="/admin/content/pages"
      />
      <PageForm />
    </div>
  )
}
