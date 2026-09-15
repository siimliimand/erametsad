import type { Metadata } from 'next'

import { UserPageHead } from '../_components/UserPageHead'
import { ObjectsClient } from './_components/objects-client'
import {
  filterRowsByStatus,
  loadSellerOverview,
  parseStatusTab,
} from './_components/seller-data'
import {
  ServiceRequestsSection,
  type ServiceRequestRow,
} from './_components/service-requests-section'
import { requirePortalSession } from '../../_lib/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Minu objektid',
}

interface ObjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstRaw(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : null
}

export default async function UserObjectsPage({ searchParams }: ObjectsPageProps) {
  const { session, repositories } = await requirePortalSession('../../user/objects')
  const params = await searchParams
  const status = parseStatusTab(firstRaw(params.status))

  const allRows = await loadSellerOverview(repositories, session.userId)
  const rows = filterRowsByStatus(allRows, status)
  const pendingGroups = allRows
    .filter((row) => row.pendingApprovalCount > 0)
    .map((row) => ({
      auctionId: row.id,
      title: row.title,
      count: row.pendingApprovalCount,
    }))

  // Guard adds the same own-record filter; the query keeps it explicit so the
  // listing reads as one bounded find. Rows expose only display fields, so
  // routing details never reach the client.
  const serviceRequestRows: ServiceRequestRow[] = (
    await repositories.find({
      collection: 'service-requests',
      where: { user: { equals: session.userId } },
      sort: '-createdAt',
      pagination: false,
    })
  ).docs.map((doc) => ({
    id: doc.id,
    type: doc.type,
    status: doc.status,
    createdAt: doc.createdAt,
  }))

  return (
    <>
      <UserPageHead
        title="Minu objektid"
        summary="Ülevaade sinu objektidest oksjonitel — olek, huvi ja tulemused. Pakkujad jäävad anonüümseteks kuni lepingu allkirjastamiseni."
      />
      <ObjectsClient status={status} rows={rows} pendingGroups={pendingGroups} />
      <ServiceRequestsSection rows={serviceRequestRows} />
    </>
  )
}
