import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { RedirectForm } from '../../_components/RedirectForm'

export const metadata = { title: 'Uus suunamine' }

export default async function NewRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus suunamine"
        description="Suuna vana URL uuele aadressile."
        backHref="/admin/content/redirects"
      />
      <RedirectForm />
    </div>
  )
}
