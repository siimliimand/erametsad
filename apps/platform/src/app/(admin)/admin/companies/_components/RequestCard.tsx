'use client'

import { Clock as ClockIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { slaChip } from './history-view'
import {
  approveCompanyAccessRequestAction,
  holdCompanyAccessRequestAction,
  rejectCompanyAccessRequestAction,
  registryRecheckAction,
} from '../../../_actions/ops'
import { primaryButtonClass, secondaryButtonClass } from '../../../_components/FormField'
import { StatusChip, type StatusChipVariant } from '../../../_components/StatusChip'
import {
  BuildingIcon,
  CheckIcon,
  MapPinHouseIcon,
  MessageSquareIcon,
  PackageIcon,
  TriangleAlertIcon,
  TreePineIcon,
  UsersIcon,
  XIcon,
  ZapIcon,
} from '../../../_components/icons'
import { ConfirmDialog } from '../../../_components/ui/ConfirmDialog'
import { Modal } from '../../../_components/ui/Modal'
import { Switch } from '../../../_components/ui/Switch'
import { formatDateTime } from '../../../_lib/labels'
import type {
  BoardMembershipCheck,
  RegistryNameDiscrepancy,
  RegistrySnapshot,
} from '../../leads/_components/registry-snapshot'
import { detectNameDiscrepancy } from '../../leads/_components/registry-snapshot'

import type { CompanyAccessRequest, CompanyAccessRequestStatus } from '@/lib/data/schema'

export interface ApplicantView {
  id: string
  name: string | null
  isikukoodMasked: string
  accountAge: string
}

export interface DuplicateView {
  profileId: string
  ownerName: string
}

/** One profile already registered on this company's registry code. */
export interface ApplicantProfileView {
  profileId: string
  ownerName: string
  approvalStatus: 'pending' | 'approved' | 'rejected'
}

/** Compact bidding history of the applicant (past bids and auctions). */
export interface BiddingHistoryView {
  bidCount: number
  auctionCount: number
  lastBidAt: string | null
}

/**
 * Framework contract (raamleping) status of the applicant: signed with the
 * date, unsigned when an active framework template exists, unknown when the
 * gate has no active framework template.
 */
export interface FrameworkContractView {
  state: 'signed' | 'unsigned' | 'unknown'
  signedAt: string | null
}

export interface RequestCardData {
  request: CompanyAccessRequest
  snapshot: RegistrySnapshot
  applicant: ApplicantView | null
  boardCheck: BoardMembershipCheck
  duplicate: DuplicateView | null
  waitingDays: number
  /** Profiles already registered on the same registry code. */
  existingProfiles: ApplicantProfileView[]
  /** Applicant bidding history, null when no portal account was found. */
  biddingHistory: BiddingHistoryView | null
  frameworkContract: FrameworkContractView
  /** Approve rights defaults read from Seaded (spec delta admin-people). */
  defaultRights: readonly AuctionObjectTypeValue[]
}

// Local copy of lib/data/schema auctionObjectTypes so the client bundle does
// not pull in the Drizzle schema barrel; the approve action re-validates the
// posted values server-side.
const auctionObjectTypeRows = [
  { value: 'raieoigus', label: 'Raieõigus', Icon: TreePineIcon },
  { value: 'kinnistu', label: 'Kinnistu', Icon: MapPinHouseIcon },
  { value: 'kiire', label: 'Kiire oksjon', Icon: ZapIcon },
  { value: 'pakett', label: 'Pakett', Icon: PackageIcon },
] as const

type AuctionObjectTypeValue = (typeof auctionObjectTypeRows)[number]['value']

const statusChipVariant: Record<CompanyAccessRequestStatus, StatusChipVariant> = {
  pending: 'company:pending',
  held: 'company:held',
  approved: 'company:approved',
  rejected: 'company:rejected',
}

const slaChipToneClass: Record<ReturnType<typeof slaChip>['tone'], string> = {
  neutral:
    'bg-bg-mist text-ink-muted',
  amber:
    'bg-[var(--st-ended-bg)] text-[color:var(--st-ended-text)]',
  red: 'bg-danger-light text-danger',
}

const profileStatusLabels: Record<ApplicantProfileView['approvalStatus'], string> = {
  pending: 'ootel',
  approved: 'kinnitatud',
  rejected: 'tagasi lükatud',
}

const frameworkContractLabels: Record<FrameworkContractView['state'], string> = {
  signed: 'Allkirjastatud',
  unsigned: 'Allkirjastamata',
  unknown: '—',
}

const panelLabelClass =
  'flex items-center gap-1.5 font-heading text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted'
const dataRowClass =
  'grid grid-cols-[118px_minmax(0,1fr)] gap-3 border-t border-border py-[7px] text-bodySm first:border-t-0 sm:grid-cols-[140px_minmax(0,1fr)]'
const warnAmberClass =
  'flex items-start gap-2.5 rounded-input bg-[var(--st-ended-bg)] px-3.5 py-2.5 text-bodySm font-medium text-[color:var(--st-ended-text)]'
const warnRedClass =
  'flex items-start gap-2.5 rounded-input bg-danger-light px-3.5 py-2.5 text-bodySm font-medium text-danger'
const dangerOutlineButtonClass =
  'inline-flex h-10 items-center gap-xs rounded-button border border-danger bg-bgPage px-4 text-label font-semibold text-danger transition-colors duration-hover ease-hover hover:bg-danger-light'
const ghostButtonClass =
  'inline-flex h-10 items-center gap-xs rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:border-primary hover:text-primary'
const textareaClass =
  'w-full resize-y rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20'

export function RequestCard({ data, canWrite }: { data: RequestCardData; canWrite: boolean }) {
  const { request, snapshot, applicant, boardCheck, duplicate, waitingDays } = data
  const companyName = request.companyName ?? 'Ettevõte puudub'
  const blocked = snapshot.status === 'KUSTUTATUD'
  const uncheckedRegistry = !snapshot.verified
  const nameDiscrepancy: RegistryNameDiscrepancy | null = detectNameDiscrepancy(
    request.companyName,
    snapshot.legalName,
    snapshot.verified,
  )
  const sla = slaChip(waitingDays)
  // Volikiri enforcement (spec delta admin-people): a failed board-member
  // check forces the approve dialog to collect a justification and the
  // power-of-attorney upload before the action can fire.
  const volikiriRequired = boardCheck.level === 'none'

  const defaultRightsState = () =>
    Object.fromEntries(
      auctionObjectTypeRows.map((row) => [row.value, data.defaultRights.includes(row.value)]),
    ) as Record<AuctionObjectTypeValue, boolean>

  const [approveOpen, setApproveOpen] = useState(false)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [holdOpen, setHoldOpen] = useState(false)
  const [rejectBusy, setRejectBusy] = useState(false)
  const [rights, setRights] = useState<Record<AuctionObjectTypeValue, boolean>>(defaultRightsState)
  const [justification, setJustification] = useState('')
  const [volikiriFile, setVolikiriFile] = useState<File | null>(null)

  const rejectFormRef = useRef<HTMLFormElement>(null)
  const rejectReasonRef = useRef<HTMLInputElement>(null)

  const volikiriSatisfied = justification.trim().length >= 5 && volikiriFile !== null

  const openApprove = () => {
    setRights(defaultRightsState())
    setJustification('')
    setVolikiriFile(null)
    setApproveOpen(true)
  }

  const confirmReject = (reason: string) => {
    const form = rejectFormRef.current
    const input = rejectReasonRef.current
    if (!form || !input) return
    input.value = reason
    setRejectBusy(true)
    form.requestSubmit()
  }

  const members = snapshot.boardMembers

  return (
    <article className="flex flex-col overflow-hidden rounded-card border border-border bg-bgPage shadow-card">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3.5">
        <h2 className="m-0 font-heading text-h4 font-semibold text-ink">
          Taotlus <span className="font-mono text-bodySm text-ink-muted">#{request.id.slice(0, 8)}</span> ·{' '}
          {companyName}{' '}
          <span className="font-mono text-bodySm font-medium text-ink-muted">
            (Registrikood: {request.regCode})
          </span>
        </h2>
        <span className="ml-auto text-bodySm text-ink-muted">
          Esitatud: {formatDateTime(request.createdAt)}
        </span>
        <span
          title="Taotluse ooteaeg: kollane üle 2 päeva, punane üle 5 päeva"
          className={`inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-label font-semibold ${slaChipToneClass[sla.tone]}`}
        >
          <ClockIcon className="h-3 w-3" aria-hidden="true" />
          {sla.label}
        </span>
        <StatusChip status={statusChipVariant[request.status]} />
      </header>

      <div className="grid grid-cols-1 gap-md px-5 py-md md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-md">
          <div className="rounded-input border border-border p-3.5">
            <h3 className={`${panelLabelClass} mb-2`}>
              <BuildingIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Äriregistri andmed
              <span className="ml-auto rounded-pill bg-info-light px-2 py-0.5 text-[10px] font-semibold normal-case tracking-[0.02em] text-info">
                Automaatne päring
              </span>
            </h3>
            <dl className="m-0">
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Ärinimi</dt>
                <dd className="m-0 min-w-0 break-words text-ink">{snapshot.legalName ?? companyName}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Registrikood</dt>
                <dd className="m-0 font-mono text-ink">{request.regCode}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Asukoht</dt>
                <dd className="m-0 min-w-0 break-words text-ink">{snapshot.address ?? '—'}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">KMKR nr</dt>
                <dd className="m-0 font-mono text-ink">{snapshot.kmkrNr ?? '—'}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Õiguslik vorm</dt>
                <dd className="m-0 min-w-0 break-words text-ink">{snapshot.legalForm ?? '—'}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Staatus</dt>
                <dd
                  className={`m-0 inline-flex items-center gap-1.5 font-semibold tracking-[0.02em] ${
                    blocked ? 'text-danger' : 'text-[color:var(--st-active-text)]'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-pill ${blocked ? 'bg-danger' : 'bg-[var(--st-active-dot)]'}`}
                  />
                  {snapshot.status ?? 'Tundmatu'}
                </dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Andmed päritud</dt>
                <dd className="m-0 text-ink">
                  {snapshot.fetchedAt ? formatDateTime(snapshot.fetchedAt) : 'kinnitamata'}
                </dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Juhatuse liige</dt>
                <dd className="m-0 min-w-0 break-words text-ink">
                  {boardCheck.level === 'strong' ? (
                    <span className="font-semibold text-[color:var(--st-active-text)]">
                      {boardCheck.matchedName ?? '—'} <span aria-hidden="true">✓</span> (Kattub!)
                    </span>
                  ) : boardCheck.level === 'weak' ? (
                    <span className="font-medium text-[color:var(--st-ended-text)]">
                      {boardCheck.matchedName ?? '—'} — nimekattuvus, kinnita käsitsi
                    </span>
                  ) : members.length > 0 ? (
                    members.map((member) => member.name).join(', ')
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>
            {nameDiscrepancy ? (
              <div className={`${warnAmberClass} mt-2`}>
                <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <strong>Nime erinevus.</strong> Taotleja sisestatud nimi ei kattu äriregistri
                  nimega.
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-input border border-border bg-bgPage px-2.5 py-1.5">
                      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                        Taotleja sisestus
                      </span>
                      <span className="break-words font-medium">{nameDiscrepancy.applicantName}</span>
                    </div>
                    <div className="rounded-input border border-border bg-bgPage px-2.5 py-1.5">
                      <span className="mb-0.5 block text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                        Äriregister
                      </span>
                      <span className="break-words font-medium">{nameDiscrepancy.registryName}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            {boardCheck.level !== 'strong' && members.length > 0 ? (
              <p className="mb-0 mt-2 text-bodySm text-ink-muted">
                Registri juhatus:{' '}
                {members.map((member) => `${member.name} (${member.role})`).join(', ')}
              </p>
            ) : null}
            {members.length === 0 ? (
              <p className="mb-0 mt-2 text-bodySm text-ink-muted">
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
            ) : null}
            {boardCheck.level === 'none' ? (
              <div className={`${warnRedClass} mt-2`}>
                <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong>Taotleja ei ole juhatuse liige.</strong> Ainult keeldumine või nõustumine
                  põhjenduse ja volikirjaga.
                </span>
              </div>
            ) : null}
            {uncheckedRegistry ? (
              <p className="mb-0 mt-2 text-bodySm font-medium text-danger">
                Sisestatud andmed on kinnitamata — registrit vastet ei leitud.
              </p>
            ) : null}
            {canWrite ? (
              <form action={registryRecheckAction} className="mt-2.5 border-t border-border pt-2.5">
                <input type="hidden" name="id" value={request.id} />
                <input type="hidden" name="redirectTo" value="/admin/companies" />
                <button
                  type="submit"
                  className="inline-flex h-7 items-center rounded-button border border-border bg-bgPage px-2.5 text-label font-semibold text-ink-muted transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
                >
                  Kontrolli uuesti
                </button>
              </form>
            ) : null}
          </div>
        </section>

        <section className="flex min-w-0 flex-col gap-md">
          <div className="rounded-input border border-border p-3.5">
            <h3 className={`${panelLabelClass} mb-2`}>
              <UsersIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Taotleja profiil
            </h3>
            <dl className="m-0">
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Kasutaja</dt>
                <dd className="m-0 min-w-0 break-words text-ink">
                  {applicant?.name ?? request.requesterName ?? '—'}
                </dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Isikukood</dt>
                <dd className="m-0 font-mono text-ink">
                  {applicant ? applicant.isikukoodMasked : '—'}
                </dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">E-post</dt>
                <dd className="m-0 min-w-0 break-words text-ink">{request.requesterEmail ?? '—'}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Telefon</dt>
                <dd className="m-0 text-ink">{request.requesterPhone ?? '—'}</dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Konto loodud</dt>
                <dd className="m-0 text-ink">{applicant ? applicant.accountAge : '—'}</dd>
              </div>
            </dl>
          </div>
          <div className="rounded-input border border-border p-3.5">
            <h3 className={`${panelLabelClass} mb-2`}>
              <MessageSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Taotleja põhjendus
            </h3>
            <blockquote className="m-0 rounded-r-input border-l-[3px] border-primary-light bg-bg-mist px-3.5 py-2.5 text-bodySm italic text-ink">
              {request.reason ?? '—'}
            </blockquote>
          </div>
          <div className="rounded-input border border-border p-3.5">
            <h3 className={`${panelLabelClass} mb-2`}>
              <UsersIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Taotleja kontekst
            </h3>
            <dl className="m-0">
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Olemasolevad profiilid</dt>
                <dd className="m-0 min-w-0 text-ink">
                  {data.existingProfiles.length > 0 ? (
                    <span className="flex flex-col gap-1">
                      {data.existingProfiles.map((profile) => (
                        <span key={profile.profileId} className="break-words">
                          {profile.ownerName}{' '}
                          <span className="font-medium text-ink-muted">
                            ({profileStatusLabels[profile.approvalStatus]})
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Pakkumiste ajalugu</dt>
                <dd className="m-0 min-w-0 break-words text-ink">
                  {data.biddingHistory ? (
                    <>
                      {`${String(data.biddingHistory.bidCount)} pakkumist · ${String(data.biddingHistory.auctionCount)} oksjonit`}
                      {data.biddingHistory.lastBidAt
                        ? ` · viimane ${formatDateTime(data.biddingHistory.lastBidAt)}`
                        : ''}
                    </>
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
              <div className={dataRowClass}>
                <dt className="text-ink-muted">Raamleping</dt>
                <dd className="m-0 min-w-0 break-words text-ink">
                  <span
                    className={
                      data.frameworkContract.state === 'signed'
                        ? 'font-semibold text-[color:var(--st-active-text)]'
                        : data.frameworkContract.state === 'unsigned'
                          ? 'font-semibold text-[color:var(--st-ended-text)]'
                          : undefined
                    }
                  >
                    {frameworkContractLabels[data.frameworkContract.state]}
                  </span>
                  {data.frameworkContract.state === 'signed' && data.frameworkContract.signedAt
                    ? ` ${formatDateTime(data.frameworkContract.signedAt)}`
                    : null}
                </dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      {blocked ? (
        <div className={`${warnRedClass} mx-5 mb-md`}>
          <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Ettevõte on äriregistrist kustutatud (KUSTUTATUD).</strong> Ainult keeldumine on lubatud.
          </span>
        </div>
      ) : null}
      {duplicate ? (
        <div className={`${warnAmberClass} mx-5 mb-md`}>
          <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>DUPLIKAADI HOIATUS:</strong> Ettevõte {companyName} on juba registreeritud teise
            kasutaja profiili all: profiil #{duplicate.profileId.slice(0, 8)} ({duplicate.ownerName}).
            Suunage ligipääs olemasoleva omaniku kaudu või keelduge põhjusega „Ettevõte on juba
            registreeritud“.
          </span>
        </div>
      ) : null}

      {canWrite ? (
        <footer className="flex flex-wrap gap-2.5 border-t border-border px-5 py-3.5">
          {!blocked ? (
            <button type="button" onClick={openApprove} className={primaryButtonClass}>
              <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
              Nõustu — Aktiveeri profiil
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setRejectOpen(true)
            }}
            className={dangerOutlineButtonClass}
          >
            <XIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Keeldu põhjusega
          </button>
          <button
            type="button"
            onClick={() => {
              setHoldOpen(true)
            }}
            className={ghostButtonClass}
          >
            <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
            Jäta ootele
          </button>
        </footer>
      ) : null}

      {!blocked && canWrite ? (
        <Modal open={approveOpen} onClose={() => { setApproveOpen(false); }} title="Nõustu — aktiveeri profiil">
          <form action={approveCompanyAccessRequestAction} className="flex flex-col gap-3">
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="redirectTo" value="/admin/companies" />
            <p className="m-0 text-bodySm text-ink">
              Aktiveeritav ettevõte: <strong>{companyName}</strong>
            </p>
            {volikiriRequired ? (
              <div className={warnRedClass}>
                <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  <strong>Taotleja ei ole juhatuse liige.</strong> Nõustumine nõuab põhjendust ja
                  volikirja (PDF/JPG/PNG, kuni 5 MB); mõlemad logitakse auditilogisse.
                </span>
              </div>
            ) : null}
            <div className="flex flex-col gap-1">
              <span className="text-label font-semibold text-ink">
                Vaikimisi antavad pakkumisõigused
              </span>
              <div
                role="group"
                aria-label="Vaikimisi antavad pakkumisõigused"
                className="flex flex-col gap-2"
              >
                {auctionObjectTypeRows.map(({ value, label, Icon }) => (
                  <label
                    key={value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-input border border-border px-3 py-2 text-bodySm font-medium text-ink transition-colors duration-hover ease-hover hover:bg-bg-mist"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                    <span className="flex-1">{label}</span>
                    <Switch
                      checked={rights[value]}
                      onChange={(checked) => {
                        setRights((prev) => ({ ...prev, [value]: checked }))
                      }}
                      label={label}
                    />
                  </label>
                ))}
              </div>
            </div>
            {auctionObjectTypeRows.map(({ value }) =>
              rights[value] ? (
                <input key={value} type="hidden" name="rights" value={value} />
              ) : null,
            )}
            {volikiriRequired ? (
              <>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`volikiri-justification-${request.id}`}
                    className="text-label font-semibold text-ink"
                  >
                    Põhjendus (kohustuslik, min 5 tähemärki)
                  </label>
                  <textarea
                    id={`volikiri-justification-${request.id}`}
                    name="justification"
                    rows={3}
                    required
                    minLength={5}
                    value={justification}
                    onChange={(event) => {
                      setJustification(event.target.value)
                    }}
                    placeholder="Nt taotleja volitatud juhatuse poolt — volikiri lisatud."
                    className={textareaClass}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`volikiri-file-${request.id}`}
                    className="text-label font-semibold text-ink"
                  >
                    Volikiri (kohustuslik, PDF/JPG/PNG, kuni 5 MB)
                  </label>
                  <input
                    id={`volikiri-file-${request.id}`}
                    type="file"
                    name="volikiri"
                    required
                    accept=".pdf,image/jpeg,image/png"
                    onChange={(event) => {
                      setVolikiriFile(event.target.files?.[0] ?? null)
                    }}
                    className="w-full rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink"
                  />
                </div>
              </>
            ) : null}
            <label className="flex items-center gap-2 text-bodySm text-ink">
              <input
                type="checkbox"
                name="checkedRegistry"
                defaultChecked={boardCheck.level !== 'none' && snapshot.verified}
                className="h-4 w-4"
              />
              Kontrollisin äriregistri andmeid
            </label>
            <p className="m-0 text-label text-ink-muted">
              Kasutajale saadetakse automaatne e-kiri profiili aktiveerimisest.
            </p>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
              <button type="button" onClick={() => { setApproveOpen(false); }} className={secondaryButtonClass}>
                Tühista
              </button>
              <button type="submit" disabled={volikiriRequired && !volikiriSatisfied} className={primaryButtonClass}>
                <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
                Kinnita ja aktiveeri
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {canWrite ? (
        <>
          <ConfirmDialog
            open={rejectOpen}
            onClose={() => {
              setRejectOpen(false)
            }}
            title="Keeldu põhjusega"
            description={
              <>
                Keeldutav ettevõte: <strong>{companyName}</strong>
              </>
            }
            note="Taotlejale saadetakse e-kiri koos keeldumise põhjusega."
            variant="reason"
            reasonLabel="Keeldumise põhjus (edastatakse taotlejale)"
            reasonPlaceholder="Nt. Registrikoodi staatus Äriregistris ei võimalda taotlust heaks kiita."
            confirmLabel="Kinnita keeldumine"
            busy={rejectBusy}
            onConfirm={confirmReject}
          />
          <form ref={rejectFormRef} action={rejectCompanyAccessRequestAction} hidden>
            <input type="hidden" name="id" value={request.id} />
            <input type="hidden" name="redirectTo" value="/admin/companies" />
            <input ref={rejectReasonRef} type="hidden" name="reason" defaultValue="" />
          </form>

          <Modal open={holdOpen} onClose={() => { setHoldOpen(false); }} title="Jäta taotlus ootele">
            <form action={holdCompanyAccessRequestAction} className="flex flex-col gap-3">
              <input type="hidden" name="id" value={request.id} />
              <input type="hidden" name="redirectTo" value="/admin/companies" />
              <div className="flex flex-col gap-1">
                <label htmlFor={`hold-note-${request.id}`} className="text-label font-semibold text-ink">
                  Sisemärkus (kohustuslik)
                </label>
                <textarea
                  id={`hold-note-${request.id}`}
                  name="note"
                  rows={3}
                  required
                  minLength={5}
                  placeholder="Nt. ootab volikirja saatmist"
                  className={textareaClass}
                />
                <p className="m-0 text-label text-ink-muted">
                  Sisemärkus on kohustuslik (vähemalt 5 tähemärki).
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor={`hold-remind-${request.id}`}
                  className="text-label font-semibold text-ink"
                >
                  Meeldetuletus (valikuline)
                </label>
                <input
                  id={`hold-remind-${request.id}`}
                  type="datetime-local"
                  name="remindAt"
                  className="h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="m-0 text-label text-ink-muted">Taotlus jääb ootel taotluste loendisse.</p>
              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <button type="button" onClick={() => { setHoldOpen(false); }} className={secondaryButtonClass}>
                  Tühista
                </button>
                <button type="submit" className={primaryButtonClass}>
                  <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
                  Jäta ootele
                </button>
              </div>
            </form>
          </Modal>
        </>
      ) : null}
    </article>
  )
}
