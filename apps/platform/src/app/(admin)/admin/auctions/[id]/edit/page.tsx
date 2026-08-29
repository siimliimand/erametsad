import { notFound } from 'next/navigation'

import { updateAuctionAction } from '../../../../_actions/auctions'
import { ErrorNotice } from '../../../../_components/ErrorNotice'
import { PageHeader } from '../../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../../_lib/admin'
import { StatusPill } from '../../../../_lib/labels'
import { AuctionForm, loadAuctionFormOptions } from '../../auction-form'

export const metadata = { title: 'Muuda oksjonit' }

export default async function EditAuctionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string }>
}) {
  const { id } = await params
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const auction = await repositories.findByID({ collection: 'auctions', id })
  if (!auction) notFound()
  const options = await loadAuctionFormOptions(repositories)
  const detailPath = `/admin/auctions/${id}`

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title={auction.title}
        description="Muuda oksjoni andmeid. Olekut ei muudeta siin."
        backHref={detailPath}
        actions={<StatusPill status={auction.status} />}
      />
      <AuctionForm
        action={updateAuctionAction}
        auction={auction}
        options={options}
        submitLabel="Salvesta muudatused"
        cancelHref={detailPath}
      />
    </div>
  )
}
