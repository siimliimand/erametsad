import { RequestCard } from './_components/RequestCard'
import type { ApplicantView, DuplicateView } from './_components/RequestCard'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { PageHeader } from '../../_components/PageHeader'
import { StatusChip, type StatusChipVariant } from '../../_components/StatusChip'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, maskIsikukood } from '../../_lib/labels'
import { can } from '../../_lib/permissions'
import {
  crossCheckBoardMembership,
  resolveRegistrySnapshot,
} from '../leads/_components/registry-snapshot'


import type { AuditEntryDoc, UserDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { CompanyAccessRequest, CompanyAccessRequestStatus, auctionObjectTypes  } from '@/lib/data/schema'

export const metadata = { title: 'Ettevõtte taotlused' }

const auctionObjectTypeLabels: Record<(typeof auctionObjectTypes)[number], string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

const statusChipVariant: Record<CompanyAccessRequestStatus, StatusChipVariant> = {
  pending: 'company:pending',
  held: 'company:held',
  approved: 'company:approved',
  rejected: 'company:rejected',
}

interface RequestCardView {
  request: CompanyAccessRequest
  snapshot: ReturnType<typeof resolveRegistrySnapshot>
  applicant: ApplicantView | null
  boardCheck: ReturnType<typeof crossCheckBoardMembership>
  duplicate: DuplicateView | null
  waitingDays: number
}

const dangerBlockClass =
  'rounded-input border border-danger bg-danger-light px-sm py-xs text-bodySm text-danger'

export default async function CompanyAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ viga?: string; teade?: string; vaade?: string }>
}) {
  const { viga, teade, vaade } = await searchParams
  const { session } = await requireAdminRepositories()
  if (!can(session.role, 'companies:read')) {
    return (
      <div>
        <PageHeader title="Ettevõtte taotlused" />
        <div className={dangerBlockClass}>Ainult administraatorile.</div>
      </div>
    )
  }
  const canWrite = can(session.role, 'companies:write')

  const repositories = await getRepositories()
  const historyView = vaade === 'ajalugu'

  const { docs: requests } = await repositories.find({
    collection: 'company-access-request',
    sort: '-createdAt',
    limit: 100,
  })

  const userIds = [
    ...new Set(
      requests
        .map((request) => request.reviewedBy)
        .filter((id): id is string => Boolean(id)),
    ),
  ]
  const { docs: reviewers } =
    userIds.length > 0
      ? await repositories.find({ collection: 'users', where: { id: { in: userIds } }, pagination: false })
      : { docs: [] as UserDoc[] }
  const reviewerNames = new Map(
    reviewers.map((reviewer) => [reviewer.id, reviewer.name ?? reviewer.email]),
  )

  const emails = [
    ...new Set(requests.map((request) => request.requesterEmail).filter((email): email is string => Boolean(email))),
  ]
  const { docs: applicantUsers } =
    emails.length > 0
      ? await repositories.find({
          collection: 'users',
          where: { email: { in: emails } },
          pagination: false,
        })
      : { docs: [] as UserDoc[] }
  const applicantsByEmail = new Map(applicantUsers.map((user) => [user.email, user]))

  const regCodes = [...new Set(requests.map((request) => request.regCode))]
  const { docs: approvedProfiles } =
    regCodes.length > 0
      ? await repositories.find({
          collection: 'profile',
          where: {
            and: [
              { companyRegCode: { in: regCodes } },
              { approvalStatus: { equals: 'approved' } },
            ],
          },
          pagination: false,
        })
      : { docs: [] }
  const duplicateByRegCode = new Map<string, DuplicateView>()
  for (const profile of approvedProfiles) {
    if (!profile.companyRegCode) continue
    const owner = applicantUsers.find((user) => user.id === profile.userId)
    duplicateByRegCode.set(profile.companyRegCode, {
      profileId: profile.id,
      ownerName: owner?.name ?? owner?.email ?? profile.userId,
    })
  }

  const { docs: requestAudits } = await repositories.find({
    collection: 'audit-entry',
    where: { entityType: { equals: 'company-access-request' } },
    sort: '-createdAt',
    pagination: false,
  })
  const auditsByRequestId = new Map<string, AuditEntryDoc[]>()
  for (const entry of requestAudits) {
    if (!entry.entityId) continue
    const list = auditsByRequestId.get(entry.entityId) ?? []
    list.push(entry)
    auditsByRequestId.set(entry.entityId, list)
  }

  const nowMs = Date.now()
  const openCards: RequestCardView[] = requests
    .filter((request) => request.status === 'pending' || request.status === 'held')
    .map((request) => {
      const applicantUser = request.requesterEmail
        ? applicantsByEmail.get(request.requesterEmail)
        : undefined
      const snapshot = resolveRegistrySnapshot(request.regCode, request.companyName, request.createdAt)
      return {
        request,
        snapshot,
        applicant: applicantUser
          ? {
              id: applicantUser.id,
              name: applicantUser.name,
              isikukoodMasked: maskIsikukood(applicantUser.isikukood),
              accountAge: formatDateTime(applicantUser.createdAt),
            }
          : null,
        boardCheck: crossCheckBoardMembership(
          applicantUser?.name ?? request.requesterName,
          applicantUser?.isikukood,
          snapshot.boardMembers,
        ),
        duplicate: duplicateByRegCode.get(request.regCode) ?? null,
        waitingDays: Math.max(
          0,
          Math.floor((nowMs - Date.parse(request.createdAt)) / 86400000),
        ),
      }
    })
  openCards.sort((a, b) => {
    if (a.request.status === 'held' && b.request.status !== 'held') return 1
    if (b.request.status === 'held' && a.request.status !== 'held') return -1
    return Date.parse(a.request.createdAt) - Date.parse(b.request.createdAt)
  })

  const decidedRows = requests
    .filter((request) => request.status === 'approved' || request.status === 'rejected')
    .map((request) => {
      const applicantUser = request.requesterEmail
        ? applicantsByEmail.get(request.requesterEmail)
        : undefined
      const entries = auditsByRequestId.get(request.id) ?? []
      const rejectEntry = entries.find((entry) => entry.action === 'company.reject')
      const approveEntry = entries.find((entry) => entry.action === 'company.approve')
      const rejectAfter = rejectEntry?.after as { reason?: unknown } | undefined
      const approveAfter = approveEntry?.after as { rights?: unknown } | undefined
      const rights = Array.isArray(approveAfter?.rights) ? approveAfter.rights : []
      return {
        id: request.id,
        company: `${request.companyName ?? '—'} (${request.regCode})`,
        applicant: `${applicantUser?.name ?? request.requesterName ?? '—'} · ${maskIsikukood(applicantUser?.isikukood)}`,
        status: request.status,
        reviewedAt: request.reviewedAt,
        reviewerName: request.reviewedBy
          ? (reviewerNames.get(request.reviewedBy) ?? request.reviewedBy)
          : '—',
        reason:
          typeof rejectAfter?.reason === 'string'
            ? rejectAfter.reason
            : '—',
        rights,
      }
    })

  const tabBaseClass =
    'inline-flex items-center gap-2 rounded-input px-3.5 py-1.5 text-label font-semibold transition-colors duration-hover ease-hover'
  const tabClass = (active: boolean) =>
    `${tabBaseClass} ${
      active
        ? 'bg-bgPage text-primary shadow-card'
        : 'text-ink-muted hover:text-primary'
    }`
  const tabCountClass = (active: boolean) =>
    `rounded-pill px-2 py-0.5 text-[12px] font-bold ${
      active ? 'bg-primary-light text-primaryDark' : 'bg-bgPage text-ink-muted'
    }`

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? (
        <div className="mb-md rounded-input border border-primary bg-primary-light px-md py-sm text-bodySm text-primaryDark">
          {teade}
        </div>
      ) : null}
      <PageHeader
        title="Ettevõtte taotlused"
        description="Registriandmete vaatamine logitakse. Otsus teavitatakse taotlejale e-postiga."
        backHref="/admin/leads"
      />
      <div className="mb-md inline-flex gap-1 rounded-input border border-border bg-bg-mist p-1">
        <a href="/admin/companies" className={tabClass(!historyView)}>
          Ootel taotlused
          <span className={tabCountClass(!historyView)}>{String(openCards.length)}</span>
        </a>
        <a href="/admin/companies?vaade=ajalugu" className={tabClass(historyView)}>
          Ajalugu
          <span className={tabCountClass(historyView)}>{String(decidedRows.length)}</span>
        </a>
      </div>

      {historyView ? (
        <DataTable
          columns={[
            { key: 'reviewedAt', label: 'Kuupäev', render: (row) => formatDateTime(row.reviewedAt) },
            { key: 'company', label: 'Ettevõte' },
            { key: 'applicant', label: 'Taotleja' },
            {
              key: 'status',
              label: 'Otsus',
              render: (row) => <StatusChip status={statusChipVariant[row.status]} />,
            },
            { key: 'reviewerName', label: 'Otsustaja' },
            { key: 'reason', label: 'Keeldumise põhjus' },
            {
              key: 'rights',
              label: 'Antud õigused',
              render: (row) =>
                row.rights.length > 0
                  ? row.rights
                      .map((right) => {
                        if (typeof right !== 'string') return String(right)
                        return auctionObjectTypeLabels[right as (typeof auctionObjectTypes)[number]]
                      })
                      .join(', ')
                  : '—',
            },
          ]}
          rows={decidedRows}
          emptyLabel="Läbivaadatud taotlusi ei ole."
        />
      ) : openCards.length === 0 ? (
        <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-ink-muted">
          Uusi taotlusi ei ole.
        </div>
      ) : (
        <div className="flex flex-col gap-lg">
          {openCards.map((card) => (
            <RequestCard key={card.request.id} data={card} canWrite={canWrite} />
          ))}
        </div>
      )}
    </div>
  )
}
