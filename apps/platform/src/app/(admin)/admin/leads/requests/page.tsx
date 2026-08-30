import { reviewCompanyAccessRequestAction } from '../../../_actions/ops'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  CompanyAccessRequestStatusPill,
  formatDateTime,
} from '../../../_lib/labels'

import type { UserDoc } from '@/lib/data/repositories'
import type { CompanyAccessRequestStatus } from '@/lib/data/schema'

export const metadata = { title: 'Ettevõtte taotlused' }

interface RequestRow {
  id: string
  regCode: string
  companyName: string | null
  requesterName: string | null
  requesterEmail: string | null
  requesterPhone: string | null
  reason: string | null
  status: string
  createdAt: string
  reviewedAt: string | null
  reviewedByName: string
}

export default async function CompanyAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string }>
}) {
  const { viga } = await searchParams
  const { repositories } = await requireAdminRepositories()

  const { docs: requests } = await repositories.find({
    collection: 'company-access-request',
    sort: '-createdAt',
    limit: 50,
  })

  const reviewerIds = [
    ...new Set(requests.map((request) => request.reviewedBy).filter((id): id is string => !!id)),
  ]
  const reviewers: UserDoc[] =
    reviewerIds.length > 0
      ? (
          await repositories.find({
            collection: 'users',
            where: { id: { in: reviewerIds } },
            pagination: false,
          })
        ).docs
      : []
  const reviewerNames = new Map(
    reviewers.map((reviewer) => [reviewer.id, reviewer.name ?? reviewer.email]),
  )

  const rows: RequestRow[] = requests.map((request) => ({
    id: request.id,
    regCode: request.regCode,
    companyName: request.companyName,
    requesterName: request.requesterName,
    requesterEmail: request.requesterEmail,
    requesterPhone: request.requesterPhone,
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    reviewedAt: request.reviewedAt,
    reviewedByName: request.reviewedBy
      ? (reviewerNames.get(request.reviewedBy) ?? request.reviewedBy)
      : '',
  }))

  const approveButtonClass =
    'inline-flex h-8 items-center rounded-button bg-primary px-3 text-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-primaryHover'
  const rejectButtonClass =
    'inline-flex h-8 items-center rounded-button border border-danger bg-bgPage px-3 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light'

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      <PageHeader
        title="Ettevõtte juurdepääsu taotlused"
        description="Nõustumine muudab taotleja ettevõtte profiili kinnitatuks."
        backHref="/admin/leads"
      />
      <DataTable
        columns={[
          { key: 'companyName', label: 'Ettevõte', render: (row) => row.companyName ?? '—' },
          { key: 'regCode', label: 'Registrikood' },
          { key: 'requesterName', label: 'Taotleja', render: (row) => row.requesterName ?? '—' },
          { key: 'requesterEmail', label: 'E-post', render: (row) => row.requesterEmail ?? '—' },
          { key: 'requesterPhone', label: 'Telefon', render: (row) => row.requesterPhone ?? '—' },
          { key: 'reason', label: 'Põhjus', render: (row) => row.reason ?? '—' },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => (
              <CompanyAccessRequestStatusPill
                status={row.status as CompanyAccessRequestStatus}
              />
            ),
          },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'review',
            label: 'Läbivaatus',
            render: (row) =>
              row.reviewedAt
                ? `${formatDateTime(row.reviewedAt)} (${row.reviewedByName})`
                : '—',
          },
          {
            key: 'actions',
            label: 'Tegevused',
            render: (row) =>
              row.status === 'pending' ? (
                <div className="flex items-center gap-xs">
                  <form action={reviewCompanyAccessRequestAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="decision" value="approve" />
                    <button type="submit" className={approveButtonClass}>
                      Nõustu
                    </button>
                  </form>
                  <form action={reviewCompanyAccessRequestAction}>
                    <input type="hidden" name="id" value={row.id} />
                    <input type="hidden" name="decision" value="reject" />
                    <button type="submit" className={rejectButtonClass}>
                      Keeldu
                    </button>
                  </form>
                </div>
              ) : (
                '—'
              ),
          },
        ]}
        rows={rows}
        emptyLabel="Taotlusi ei ole."
      />
    </div>
  )
}
