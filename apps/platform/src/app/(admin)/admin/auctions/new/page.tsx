import { createAuctionAction } from '../../../_actions/auctions'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import { AuctionForm, loadAuctionFormOptions } from '../auction-form'

export const metadata = { title: 'Uus oksjon' }

export default async function NewAuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()
  const options = await loadAuctionFormOptions(repositories)

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Uus oksjon"
        description="Loo mustandoksjon; avalikustada saab detailvaatest."
        backHref="/admin/auctions"
      />
      <AuctionForm
        action={createAuctionAction}
        options={options}
        submitLabel="Salvesta mustand"
        cancelHref="/admin/auctions"
      />
    </div>
  )
}
