import { approveCompanyAccessRequestAction, holdCompanyAccessRequestAction, rejectCompanyAccessRequestAction } from '../../../_actions/ops'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  FormTextareaField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  CompanyAccessRequestStatusPill,
  formatDateTime,
  maskIsikukood,
} from '../../../_lib/labels'
import { can } from '../../../_lib/permissions'
import {
  crossCheckBoardMembership,
  resolveRegistrySnapshot,
  type BoardMembershipCheck,
  type RegistrySnapshot,
} from '../_components/registry-snapshot'

import type { AuditEntryDoc, UserDoc } from '@/lib/data/repositories'
import { getRepositories } from '@/lib/data/runtime'
import type { CompanyAccessRequest } from '@/lib/data/schema'
import { auctionObjectTypes } from '@/lib/data/schema'

export const metadata = { title: 'Ettevõtte taotlused' }

const auctionObjectTypeLabels: Record<(typeof auctionObjectTypes)[number], string> = {
  raieoigus: 'Raieõigus',
  kinnistu: 'Kinnistu',
  kiire: 'Kiire oksjon',
  pakett: 'Pakett',
}

// Settings 13 defaults: raieõigus ja kinnistu on ette valitud (design 07).
const DEFAULT_RIGHTS: readonly (typeof auctionObjectTypes)[number][] = [
  'raieoigus',
  'kinnistu',
]

interface ApplicantView {
  id: string
  name: string | null
  isikukoodMasked: string
  accountAge: string
}

interface DuplicateView {
  profileId: string
  ownerName: string
}

interface PriorDecisionView {
  status: string
  reason: string | null
  reviewedAt: string | null
}

interface RequestCardData {
  request: CompanyAccessRequest
  snapshot: RegistrySnapshot
  applicant: ApplicantView | null
  boardCheck: BoardMembershipCheck
  duplicate: DuplicateView | null
  priorDecision: PriorDecisionView | null
  waitingDays: number
}

function slaChipClass(days: number): string {
  if (days > 5) return 'bg-danger-light text-danger'
  if (days > 2) return 'bg-info-light text-info'
  return 'bg-bg-mist text-ink-muted'
}

function boardCheckLabel(check: BoardMembershipCheck): { text: string; className: string } {
  if (check.level === 'strong') {
    return {
      text: `Juhatuse liige kinnitatud (isikukood): ${check.matchedName ?? ''}`,
      className: 'text-primary',
    }
  }
  if (check.level === 'weak') {
    return {
      text: `Nimekattuvus — kinnita käsitsi: ${check.matchedName ?? ''}`,
      className: 'text-info',
    }
  }
  return {
    text: 'Taotleja ei ole juhatuse liige ega teadaolev esindaja',
    className: 'text-danger',
  }
}

const detailPanelClass = 'rounded-input border border-border bg-bg-mist p-sm'
const warningClass =
  'rounded-input border border-info bg-info-light px-sm py-xs text-bodySm text-info'
const dangerBlockClass =
  'rounded-input border border-danger bg-danger-light px-sm py-xs text-bodySm text-danger'

function RequestCard({ data }: { data: RequestCardData }) {
  const { request, snapshot, applicant, boardCheck, duplicate, priorDecision, waitingDays } = data
  const blocked = snapshot.status === 'KUSTUTATUD'
  const check = boardCheckLabel(boardCheck)
  const uncheckedRegistry = !snapshot.verified

  return (
    <article className="rounded-card border border-border bg-bgPage p-md">
      <header className="mb-sm flex flex-wrap items-center justify-between gap-xs">
        <div>
          <h2 className="font-heading text-h4 font-bold text-ink">
            {request.companyName ?? 'Ettevõte puudub'} · registrikood {request.regCode}
          </h2>
          <p className="text-bodySm text-ink-muted">
            Taotlus #{request.id.slice(0, 8)} · esitatud {formatDateTime(request.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-xs">
          <span
            className={`rounded-pill px-2 py-0.5 text-label font-semibold ${slaChipClass(waitingDays)}`}
          >
            oodatud {String(waitingDays)} p
          </span>
          <CompanyAccessRequestStatusPill status={request.status} />
        </div>
      </header>

      {blocked ? (
        <div className={`${dangerBlockClass} mb-sm`}>
          Ettevõte on äriregistrist kustutatud (KUSTUTATUD) — ainult keeldumine on lubatud.
        </div>
      ) : null}
      {duplicate ? (
        <div className={`${warningClass} mb-sm`}>
          Sama ettevõte juba olemas: profiil #{duplicate.profileId.slice(0, 8)} (
          {duplicate.ownerName}). Suunage ligipääs olemasoleva omaniku kaudu või keelduge
          põhjusega „Ettevõte on juba registreeritud“.
        </div>
      ) : null}
      {priorDecision ? (
        <div className={`${warningClass} mb-sm`}>
          Varasem otsus ({priorDecision.status}) {formatDateTime(priorDecision.reviewedAt)}
          {priorDecision.reason ? ` — ${priorDecision.reason}` : ''}
        </div>
      ) : null}

      <div className="mb-sm grid grid-cols-1 gap-sm lg:grid-cols-2">
        <section className={detailPanelClass}>
          <h3 className="mb-xs text-label font-semibold text-ink">
            Äriregistri andmed (automaatselt)
          </h3>
          <dl className="space-y-1 text-bodySm text-ink-muted">
            <div className="flex justify-between gap-sm">
              <dt>Juriidiline nimi</dt>
              <dd className="text-ink">{snapshot.legalName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>Õigusvorm</dt>
              <dd className="text-ink">{snapshot.legalForm ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>Registreeringu olek</dt>
              <dd className={`text-ink ${blocked ? 'font-semibold text-danger' : ''}`}>
                {snapshot.status ?? 'Tundmatu'}
              </dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>Andmed päritud</dt>
              <dd className="text-ink">
                {snapshot.fetchedAt ? formatDateTime(snapshot.fetchedAt) : 'kinnitamata'}
              </dd>
            </div>
          </dl>
          <p className="mt-xs text-label font-semibold text-ink">Juhatuse liikmed</p>
          {snapshot.boardMembers.length > 0 ? (
            <ul className="text-bodySm text-ink-muted">
              {snapshot.boardMembers.map((member) => (
                <li key={member.name}>
                  {member.name} — {member.role}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-bodySm text-ink-muted">
              Andmed pole saadaval — võrrelge käsitsi{' '}
              <a
                className="text-primary underline"
                href="https://ariregister.rik.ee"
                target="_blank"
                rel="noreferrer"
              >
                ariregister.rik.ee
              </a>
            </p>
          )}
          <p className={`mt-xs text-bodySm font-semibold ${check.className}`}>✓ {check.text}</p>
          {uncheckedRegistry ? (
            <p className="mt-xs text-bodySm text-danger">
              Sisestatud andmed on kinnitamata — registrit vastet ei leitud.
            </p>
          ) : null}
        </section>

        <section className={detailPanelClass}>
          <h3 className="mb-xs text-label font-semibold text-ink">Taotleja</h3>
          <dl className="space-y-1 text-bodySm text-ink-muted">
            <div className="flex justify-between gap-sm">
              <dt>Nimi</dt>
              <dd className="text-ink">{applicant?.name ?? request.requesterName ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>Isikukood</dt>
              <dd className="text-ink">{applicant ? applicant.isikukoodMasked : '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>E-post</dt>
              <dd className="text-ink">{request.requesterEmail ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>Telefon</dt>
              <dd className="text-ink">{request.requesterPhone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt>Konto loodud</dt>
              <dd className="text-ink">{applicant ? applicant.accountAge : '—'}</dd>
            </div>
          </dl>
          <h3 className="mb-xs mt-sm text-label font-semibold text-ink">Motivatsioon</h3>
          <p className="text-bodySm text-ink-muted">{request.reason ?? '—'}</p>
        </section>
      </div>

      <footer className="flex flex-wrap items-start gap-sm">
        {blocked ? null : (
          <details className="rounded-input border border-border bg-bgPage p-xs">
            <summary className={`${primaryButtonClass} cursor-pointer list-none`}>
              Nõustu — aktiveeri profiil
            </summary>
            <form action={approveCompanyAccessRequestAction} className="mt-sm space-y-xs">
              <input type="hidden" name="id" value={request.id} />
              <p className="text-bodySm text-ink-muted">
                Profiil aktiveeritakse, antakse vaikimisi õigused ja taotleja teavitatakse.
              </p>
              <fieldset className="space-y-1">
                <legend className="text-label font-semibold text-ink">Vaikimisi õigused</legend>
                {auctionObjectTypes.map((objectType) => (
                  <label
                    key={objectType}
                    className="flex items-center gap-xs text-bodySm text-ink"
                  >
                    <input
                      type="checkbox"
                      name="rights"
                      value={objectType}
                      defaultChecked={DEFAULT_RIGHTS.includes(objectType)}
                    />
                    {auctionObjectTypeLabels[objectType]}
                  </label>
                ))}
              </fieldset>
              <label className="flex items-center gap-xs text-bodySm text-ink">
                <input
                  type="checkbox"
                  name="checkedRegistry"
                  defaultChecked={boardCheck.level !== 'none' && snapshot.verified}
                />
                Kontrollisin äriregistri andmeid
              </label>
              <button type="submit" className={primaryButtonClass}>
                Kinnita ja teavita
              </button>
            </form>
          </details>
        )}

        <details className="rounded-input border border-border bg-bgPage p-xs">
          <summary className={`${secondaryButtonClass} cursor-pointer list-none`}>
            Keeldu põhjusega
          </summary>
          <form action={rejectCompanyAccessRequestAction} className="mt-sm space-y-xs">
            <input type="hidden" name="id" value={request.id} />
            <FormTextareaField
              label="Keeldumise põhjus (kohustuslik)"
              name="reason"
              rows={3}
              required
              hint="Põhjus edastatakse taotlejale teavitusega."
            />
            <button type="submit" className={secondaryButtonClass}>
              Keeldu ja teavita
            </button>
          </form>
        </details>

        <details className="rounded-input border border-border bg-bgPage p-xs">
          <summary className={`${secondaryButtonClass} cursor-pointer list-none`}>
            Hoia ootel
          </summary>
          <form action={holdCompanyAccessRequestAction} className="mt-sm space-y-xs">
            <input type="hidden" name="id" value={request.id} />
            <FormTextareaField
              label="Sisemärkus (kohustuslik)"
              name="note"
              rows={2}
              required
            />
            <FormField label="Meeldetuletus" name="remindAt" type="datetime-local" />
            <button type="submit" className={secondaryButtonClass}>
              Pane ootele
            </button>
          </form>
        </details>
      </footer>
    </article>
  )
}

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
  const openCards: RequestCardData[] = requests
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
        priorDecision: null,
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

  const tabClass = (active: boolean) =>
    `rounded-pill px-3 py-1 text-label font-semibold transition-colors duration-hover ease-hover ${
      active
        ? 'bg-primaryLight text-primaryDark'
        : 'border border-border bg-bgPage text-ink-muted hover:text-primary'
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
        title="Ettevõtte juurdepääsu taotlused"
        description="Registriandmete vaatamine logitakse. Otsus teavitatakse taotlejale e-postiga."
        backHref="/admin/leads"
      />
      <div className="mb-sm flex items-center gap-xs">
        <a href="/admin/leads/requests" className={tabClass(!historyView)}>
          Ootel ({String(openCards.length)})
        </a>
        <a href="/admin/leads/requests?vaade=ajalugu" className={tabClass(historyView)}>
          Ajalugu ({String(decidedRows.length)})
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
              render: (row) => <CompanyAccessRequestStatusPill status={row.status} />,
            },
            { key: 'reviewerName', label: 'Otsustaja' },
            { key: 'reason', label: 'Põhjus' },
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
        <div className="space-y-sm">
          {openCards.map((card) => (
            <RequestCard key={card.request.id} data={card} />
          ))}
        </div>
      )}
    </div>
  )
}
