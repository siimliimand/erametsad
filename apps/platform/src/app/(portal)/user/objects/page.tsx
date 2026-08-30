import type { Metadata } from 'next'

import { ObjectsClient } from './_components/objects-client'
import {
  countRowsByStatus,
  filterRowsByStatus,
  loadSellerOverview,
  parseStatusTab,
} from './_components/seller-data'
import { requirePortalSession } from '../../_lib/session'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Minu müügid',
}

interface ObjectsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function firstRaw(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' ? raw : null
}

export default async function UserObjectsPage({ searchParams }: ObjectsPageProps) {
  const { session, repositories, profile } = await requirePortalSession('../../user/objects')
  const params = await searchParams
  const status = parseStatusTab(firstRaw(params.status))

  const allRows = await loadSellerOverview(repositories, session.userId)
  const rows = filterRowsByStatus(allRows, status)
  const counts = countRowsByStatus(allRows)
  const pendingGroups = allRows
    .filter((row) => row.pendingApprovalCount > 0)
    .map((row) => ({
      auctionId: row.id,
      title: row.title,
      count: row.pendingApprovalCount,
    }))

  let profileName: string | null = null
  if (profile !== null) {
    profileName =
      profile.type === 'company'
        ? profile.companyName ?? profile.displayName ?? null
        : profile.displayName ?? profile.companyName ?? null
  }

  return (
    <ObjectsClient
      status={status}
      rows={rows}
      counts={counts}
      pendingGroups={pendingGroups}
      profileName={profileName}
    />
  )
}
