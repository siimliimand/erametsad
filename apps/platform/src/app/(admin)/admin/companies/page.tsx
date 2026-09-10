
import { HistoryExportButton } from './_components/HistoryExportButton'
import type {
  ApplicantProfileView,
  ApplicantView,
  BiddingHistoryView,
  DuplicateView,
  FrameworkContractView,
} from './_components/RequestCard'
import { RequestCard } from './_components/RequestCard'
import {
  buildCompanyHistoryRow,
  companyApproveRightsDefaults,
  matchesCompanyHistoryFilters,
  parseCompanyHistoryFilters,
  paginateCompanyHistory,
} from './_components/history-view'
import { AdminLink } from '../../_components/AdminLink'
import { DataTable } from '../../_components/DataTable'
import { ErrorNotice } from '../../_components/ErrorNotice'
import { FormField, FormSelectField, primaryButtonClass, secondaryButtonClass } from '../../_components/FormField'
import { PageHeader } from '../../_components/PageHeader'
import { StatusChip, type StatusChipVariant } from '../../_components/StatusChip'
import { requireAdminRepositories } from '../../_lib/admin'
import { formatDateTime, maskIsikukood } from '../../_lib/labels'
import { can } from '../../_lib/permissions'
import {
  crossCheckBoardMembership,
  resolveRegistrySnapshot,
} from '../leads/_components/registry-snapshot'


import type { AuditEntryDoc, ProfileDoc, UserDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { CompanyAccessRequest, CompanyAccessRequestStatus, auctionObjectTypes } from '@/lib/data/schema'

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
  existingProfiles: ApplicantProfileView[]
  biddingHistory: BiddingHistoryView | null
  frameworkContract: FrameworkContractView
  defaultRights: (typeof auctionObjectTypes)[number][]
}

const dangerBlockClass =
  'rounded-input border border-danger bg-danger-light px-sm py-xs text-bodySm text-danger'

/** History pagination link that preserves the active filters. */
function PaginationLink({
  base,
  page,
  label,
}: {
  base: Record<string, string | undefined>
  page: number
  label: string
}) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(base)) {
    if (value) search.set(key, value)
  }
  search.set('lehekulg', String(page))
  return (
    <AdminLink
      href={`/companies?${search.toString()}`}
      className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
    >
      {label}
    </AdminLink>
  )
}

export default async function CompanyAccessRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    viga?: string
    teade?: string
    vaade?: string
    otsus?: string
    kuupaev?: string
    q?: string
    lehekulg?: string
  }>
}) {
  const { viga, teade, vaade, otsus, kuupaev, q, lehekulg } = await searchParams
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
  const { docs: regCodeProfiles } =
    regCodes.length > 0
      ? await repositories.find({
          collection: 'profile',
          where: { companyRegCode: { in: regCodes } },
          pagination: false,
        })
      : { docs: [] as ProfileDoc[] }
  const profilesByRegCode = new Map<string, ProfileDoc[]>()
  for (const profile of regCodeProfiles) {
    if (!profile.companyRegCode) continue
    const list = profilesByRegCode.get(profile.companyRegCode) ?? []
    list.push(profile)
    profilesByRegCode.set(profile.companyRegCode, list)
  }
  const duplicateByRegCode = new Map<string, DuplicateView>()
  for (const profile of regCodeProfiles) {
    if (!profile.companyRegCode || profile.approvalStatus !== 'approved') continue
    const owner = applicantUsers.find((user) => user.id === profile.userId)
    duplicateByRegCode.set(profile.companyRegCode, {
      profileId: profile.id,
      ownerName: owner?.name ?? owner?.email ?? profile.userId,
    })
  }

  // Approve rights defaults read from Seaded (spec delta admin-people). The
  // defaults ride the featureFlags JSON under a reserved key; until the
  // Seaded form gains the field, the documented design default applies.
  const { docs: settingsRows } = await repositories.find({ collection: 'settings', limit: 1 })
  const defaultRights = companyApproveRightsDefaults(settingsRows[0]?.featureFlags)

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

  // Applicant context (spec delta admin-people): bidding history and the
  // framework contract (raamleping) status for every applicant with a
  // portal account, plus the per-code existing profiles list.
  const applicantIds = applicantUsers.map((user) => user.id)
  const [{ docs: applicantBids }, frameworkTemplate] = await Promise.all([
    applicantIds.length > 0
      ? repositories.find({
          collection: 'bids',
          where: { user: { in: applicantIds } },
          sort: '-createdAt',
          pagination: false,
          limit: 5000,
        })
      : Promise.resolve({ docs: [] as { userId: string; auctionId: string; createdAt: string }[] }),
    repositories.find({
      collection: 'contract-templates',
      where: {
        and: [
          { type: { equals: 'framework' } },
          { active: { equals: true } },
        ],
      },
      limit: 1,
    }),
  ])
  const biddingHistoryByUser = new Map<string, BiddingHistoryView>()
  const bidsByUser = new Map<string, { count: number; auctions: Set<string>; lastBidAt: string | null }>()
  for (const bid of applicantBids) {
    const current = bidsByUser.get(bid.userId) ?? {
      count: 0,
      auctions: new Set<string>(),
      lastBidAt: null as string | null,
    }
    current.count += 1
    current.auctions.add(bid.auctionId)
    if (current.lastBidAt === null || bid.createdAt > current.lastBidAt) {
      current.lastBidAt = bid.createdAt
    }
    bidsByUser.set(bid.userId, current)
  }
  for (const [userId, stats] of bidsByUser) {
    biddingHistoryByUser.set(userId, {
      bidCount: stats.count,
      auctionCount: stats.auctions.size,
      lastBidAt: stats.lastBidAt,
    })
  }

  const frameworkTemplateId = frameworkTemplate.docs[0]?.id ?? null
  const { docs: signedFrameworkContracts } = frameworkTemplateId
    ? await repositories.find({
        collection: 'contracts',
        where: {
          and: [
            { template: { equals: frameworkTemplateId } },
            { status: { equals: 'signed' } },
            ...(applicantIds.length > 0 ? [{ signedBy: { in: applicantIds } }] : []),
          ],
        },
        pagination: false,
      })
    : { docs: [] }
  const frameworkSignedAtByUser = new Map<string, string>()
  for (const contract of signedFrameworkContracts) {
    if (contract.signedBy && contract.signedAt) {
      frameworkSignedAtByUser.set(contract.signedBy, contract.signedAt)
    }
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
        existingProfiles: (profilesByRegCode.get(request.regCode) ?? []).map((profile) => ({
          profileId: profile.id,
          ownerName:
            applicantUsers.find((user) => user.id === profile.userId)?.name ??
            profile.displayName ??
            profile.userId,
          approvalStatus: profile.approvalStatus,
        })),
        biddingHistory: applicantUser
          ? (biddingHistoryByUser.get(applicantUser.id) ?? {
              bidCount: 0,
              auctionCount: 0,
              lastBidAt: null,
            })
          : null,
        frameworkContract: (() => {
          if (!applicantUser) return { state: 'unknown', signedAt: null } as const
          const signedAt = frameworkSignedAtByUser.get(applicantUser.id)
          if (signedAt) return { state: 'signed', signedAt } as const
          return { state: frameworkTemplateId ? 'unsigned' : 'unknown', signedAt: null } as const
        })(),
        defaultRights,
      }
    })
  openCards.sort((a, b) => {
    if (a.request.status === 'held' && b.request.status !== 'held') return 1
    if (b.request.status === 'held' && a.request.status !== 'held') return -1
    return Date.parse(a.request.createdAt) - Date.parse(b.request.createdAt)
  })

  // History tab (spec delta admin-people): decision/date/freetext filters,
  // pagination, and an audited CSV export.
  const historyFilters = parseCompanyHistoryFilters({ decision: otsus, date: kuupaev, q })
  const historyRows = requests
    .filter(
      (request): request is CompanyAccessRequest & { status: 'approved' | 'rejected' } =>
        request.status === 'approved' || request.status === 'rejected',
    )
    .map((request) => {
      const applicantUser = request.requesterEmail
        ? applicantsByEmail.get(request.requesterEmail)
        : undefined
      const entries = auditsByRequestId.get(request.id) ?? []
      const rejectAfter = entries.find((entry) => entry.action === 'company.reject')?.after as
        | { reason?: unknown }
        | undefined
      const approveAfter = entries.find((entry) => entry.action === 'company.approve')?.after as
        | { rights?: unknown }
        | undefined
      const rights = Array.isArray(approveAfter?.rights) ? approveAfter.rights : []
      return buildCompanyHistoryRow({
        request: {
          id: request.id,
          regCode: request.regCode,
          companyName: request.companyName,
          requesterName: request.requesterName,
          requesterEmail: request.requesterEmail,
          status: request.status,
          reviewedAt: request.reviewedAt,
        },
        applicant: {
          name: applicantUser?.name ?? null,
          isikukoodMasked: maskIsikukood(applicantUser?.isikukood),
        },
        reviewerName: request.reviewedBy
          ? (reviewerNames.get(request.reviewedBy) ?? request.reviewedBy)
          : null,
        rejectReason: typeof rejectAfter?.reason === 'string' ? rejectAfter.reason : null,
        rights: rights.filter((right): right is string => typeof right === 'string'),
      })
    })
    .filter((row) => matchesCompanyHistoryFilters(row, historyFilters))
  const historyPage = paginateCompanyHistory(historyRows, lehekulg)

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
        <a href="/companies" className={tabClass(!historyView)}>
          Ootel taotlused
          <span className={tabCountClass(!historyView)}>{String(openCards.length)}</span>
        </a>
        <a href="/companies?vaade=ajalugu" className={tabClass(historyView)}>
          Ajalugu
          <span className={tabCountClass(historyView)}>{String(historyRows.length)}</span>
        </a>
      </div>

      {historyView ? (
        <>
          <form
            method="get"
            className="mb-md flex max-w-container-sm flex-wrap items-end gap-sm rounded-card border border-border bg-bgPage p-md"
          >
            <input type="hidden" name="vaade" value="ajalugu" />
            <div className="w-40">
              <FormSelectField
                label="Otsus"
                name="otsus"
                defaultValue={historyFilters.decision ?? ''}
                options={[
                  { value: '', label: 'Kõik' },
                  { value: 'approved', label: 'Nõustutud' },
                  { value: 'rejected', label: 'Keeldutud' },
                ]}
              />
            </div>
            <div className="w-40">
              <FormField
                label="Kuupäev"
                name="kuupaev"
                type="date"
                defaultValue={historyFilters.date ?? ''}
              />
            </div>
            <div className="w-56">
              <FormField
                label="Otsing"
                name="q"
                type="search"
                defaultValue={q ?? ''}
                hint="Ettevõte, taotleja, registrikood"
              />
            </div>
            <button type="submit" className={primaryButtonClass}>
              Filtreeri
            </button>
            <AdminLink href="/companies?vaade=ajalugu" className={secondaryButtonClass}>
              Tühjenda
            </AdminLink>
          </form>
          <div className="mb-md flex flex-wrap items-center justify-between gap-sm">
            <span className="text-label text-ink-muted">
              {`${String(historyPage.total)} rida · lehekülg ${String(historyPage.page)}/${String(historyPage.pageCount)}`}
            </span>
            <HistoryExportButton
              filters={{
                decision: historyFilters.decision ?? undefined,
                date: historyFilters.date ?? undefined,
                q: historyFilters.freetext,
              }}
              disabled={historyPage.total === 0}
            />
          </div>
          <DataTable
            columns={[
              { key: 'reviewedAt', label: 'Kuupäev', render: (row) => formatDateTime(row.reviewedAt) },
              {
                key: 'company',
                label: 'Ettevõte',
                render: (row) => `${row.companyName ?? '—'} (${row.regCode})`,
              },
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
            rows={historyPage.rows}
            emptyLabel="Filtritele ei vasta ühtegi läbivaadatud taotlust."
          />
          {historyPage.pageCount > 1 ? (
            <div className="mt-md flex items-center justify-between">
              {historyPage.page > 1 ? (
                <PaginationLink
                  base={{ vaade: 'ajalugu', otsus, kuupaev, q }}
                  page={historyPage.page - 1}
                  label="← Eelmine"
                />
              ) : (
                <span />
              )}
              {historyPage.page < historyPage.pageCount ? (
                <PaginationLink
                  base={{ vaade: 'ajalugu', otsus, kuupaev, q }}
                  page={historyPage.page + 1}
                  label="Järgmine →"
                />
              ) : (
                <span />
              )}
            </div>
          ) : null}
        </>
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
