import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  grantAuctionRightAction,
  resumeUserAction,
  revokeAuctionRightAction,
  revokeUserSessionAction,
  suspendUserAction,
  updateUserAction,
} from '../../../_actions/users'
import { DataTable } from '../../../_components/DataTable'
import { ErrorNotice } from '../../../_components/ErrorNotice'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { PageHeader } from '../../../_components/PageHeader'
import { requireAdminRepositories } from '../../../_lib/admin'
import {
  auctionObjectTypeLabels,
  authMethodLabels,
  bidSourceLabels,
  bidStatusLabels,
  ContractStatusPill,
  formatDateTime,
  formatEur,
  maskIsikukood,
  UserStatusPill,
  userRoleLabels,
  userStatusLabels,
} from '../../../_lib/labels'
import { can } from '../../../_lib/permissions'
import { IsikukoodReveal } from '../_components/IsikukoodReveal'
import { suspendDurationLabels, suspendDurations } from '../_components/suspend'

import { listUserSessions } from '@/lib/auth/session'
import type { AuditEntryDoc, UserDoc } from '@/lib/data/repositories'
import type { AuctionObjectType, BidSource, BidStatus } from '@/lib/data/schema'
import { auctionObjectTypes } from '@/lib/data/schema'

export const metadata = { title: 'Kasutaja' }

// guest is a technical role; staff never assign it.
const roleOptions = (Object.keys(userRoleLabels) as (keyof typeof userRoleLabels)[])
  .filter((role) => role !== 'guest')
  .map((role) => ({ value: role, label: userRoleLabels[role] }))

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-danger hover:text-danger'

const dangerButtonClass =
  'inline-flex h-10 items-center gap-xs rounded-button bg-danger px-4 text-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-danger/90'

const TABS = [
  { id: 'identiteet', label: 'Identiteet' },
  { id: 'profiilid', label: 'Profiilid' },
  { id: 'oigused', label: 'Õigused' },
  { id: 'lepingud', label: 'Lepingud' },
  { id: 'pakkumised', label: 'Pakkumised' },
] as const

type TabId = (typeof TABS)[number]['id']

function parseTab(raw: string): TabId {
  const match = TABS.find((tab) => tab.id === raw)
  return match ? match.id : 'identiteet'
}

function DetailTabs({ userId, active }: { userId: string; active: TabId }) {
  return (
    <nav className="mb-md flex flex-wrap gap-xs border-b border-border pb-xs" aria-label="Kasutaja detaili vaated">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={`/admin/users/${userId}?tab=${tab.id}`}
          aria-current={tab.id === active ? 'page' : undefined}
          className={`rounded-pill px-3 py-1.5 text-label font-semibold transition-colors duration-hover ease-hover ${
            tab.id === active
              ? 'bg-primary text-ink-inverse'
              : 'text-ink-muted hover:bg-bg-mist hover:text-ink'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

function SuccessNotice({ message }: { message: string }) {
  return (
    <div
      role="status"
      className="mb-md rounded-input border border-l-4 border-info bg-info-light px-md py-sm text-bodySm text-info"
    >
      {message}
    </div>
  )
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label font-semibold text-ink">{label}</span>
      <div className="flex h-10 items-center rounded-input border border-border bg-bg-mist px-3 text-bodySm text-ink-muted">
        {children}
      </div>
    </div>
  )
}

interface SuspensionInfo {
  active: boolean
  duration: string | null
  suspendedUntil: string | null
  reason: string | null
  changedAt: string | null
}

interface RightAuditPayload {
  objectType?: unknown
  reason?: unknown
  status?: unknown
  duration?: unknown
  suspendedUntil?: unknown
}

function readPayload(after: unknown): RightAuditPayload {
  if (typeof after === 'object' && after !== null) {
    return after
  }
  return {}
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

function suspensionFromAudit(entries: AuditEntryDoc[]): SuspensionInfo {
  const latest = entries[0]
  if (!latest) return { active: false, duration: null, suspendedUntil: null, reason: null, changedAt: null }
  const payload = readPayload(latest.after)
  return {
    active: payload.status === 'suspended',
    duration: asString(payload.duration),
    suspendedUntil: asString(payload.suspendedUntil),
    reason: asString(payload.reason),
    changedAt: latest.createdAt,
  }
}

function actionLabel(action: string): string {
  switch (action) {
    case 'user.right_grant':
      return 'Õigus antud'
    case 'user.right_revoke':
      return 'Õigus tühistatud'
    case 'user.suspend':
      return 'Konto peatus'
    default:
      return action
  }
}

function objectTypeLabel(objectType: string): string {
  return (auctionObjectTypes as readonly string[]).includes(objectType)
    ? auctionObjectTypeLabels[objectType as AuctionObjectType]
    : objectType
}

interface SessionRow {
  id: string
  sessionId: string
  createdAt: string
  userId: string
}

interface BidRow {
  id: string
  auctionId: string
  auctionTitle: string
  amount: number
  status: BidStatus
  source: BidSource
  createdAt: string
}

interface ContractRow {
  id: string
  auctionId: string
  auctionTitle: string
  status: React.ComponentProps<typeof ContractStatusPill>['status']
  createdAt: string
  signedAt: string | null
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ viga?: string; teade?: string; tab?: string }>
}) {
  const { id } = await params
  const { viga, teade, tab: rawTab } = await searchParams
  const tab = parseTab(rawTab ?? '')

  const { session, repositories } = await requireAdminRepositories()
  if (!can(session.role, 'users:read')) {
    return (
      <div>
        <PageHeader title="Kasutaja" backHref="/admin/users" />
        <ErrorNotice message="Ainult administraatorile." />
      </div>
    )
  }

  const user = await repositories.findByID({ collection: 'users', id })
  if (!user) notFound()

  const canWrite = can(session.role, 'users:write')

  const auditEntries =
    tab === 'oigused' || user.status === 'suspended'
      ? (
          await repositories.find({
            collection: 'audit-entry',
            where: {
              and: [
                { entityType: { equals: 'user' } },
                { entityId: { equals: id } },
                {
                  action: {
                    in: ['user.right_grant', 'user.right_revoke', 'user.suspend'],
                  },
                },
              ],
            },
            sort: '-createdAt',
            pagination: false,
            limit: 200,
          })
        ).docs
      : []

  const suspension = suspensionFromAudit(auditEntries)

  return (
    <div>
      {viga ? <ErrorNotice message={viga} /> : null}
      {teade ? <SuccessNotice message={teade} /> : null}
      <PageHeader
        title={user.name ?? user.email}
        description={`Kasutaja haldus · roll ${userRoleLabels[user.role]} · olek ${userStatusPillFor(user)}`}
        backHref="/admin/users"
      />
      <DetailTabs userId={user.id} active={tab} />

      {tab === 'identiteet' ? (
        <IdentityTab
          user={user}
          sessions={
            (
              await listUserSessions(id)
            ).map((sessionInfo) => ({
              id: sessionInfo.sessionId,
              sessionId: sessionInfo.sessionId,
              createdAt: sessionInfo.createdAt.toISOString(),
              userId: id,
            })) satisfies SessionRow[]
          }
          suspension={suspension}
          canWrite={canWrite}
        />
      ) : null}

      {tab === 'profiilid' ? <ProfilesTab userId={id} /> : null}

      {tab === 'oigused' ? (
        <RightsTab
          user={user}
          auditEntries={auditEntries}
          canWrite={canWrite}
        />
      ) : null}

      {tab === 'lepingud' ? <ContractsTab userId={id} /> : null}

      {tab === 'pakkumised' ? <BidsTab userId={id} /> : null}
    </div>
  )
}

function userStatusPillFor(user: UserDoc): string {
  return user.status === 'active' ? userStatusLabels.active : userStatusLabels.suspended
}

// ---------------------------------------------------------------------------
// Identiteet + sessions
// ---------------------------------------------------------------------------

function IdentityTab({
  user,
  sessions,
  suspension,
  canWrite,
}: {
  user: UserDoc
  sessions: SessionRow[]
  suspension: SuspensionInfo
  canWrite: boolean
}) {
  return (
    <div className="space-y-lg">
      <section className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md">
        <h2 className="font-heading text-h4 font-bold text-ink">Identiteet</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <InfoRow label="E-post">{user.email}</InfoRow>
          <InfoRow label="Loodud">{formatDateTime(user.createdAt)}</InfoRow>
          <div className="flex flex-col gap-1">
            <span className="text-label font-semibold text-ink">Isikukood</span>
            <div className="flex h-10 items-center rounded-input border border-border bg-bg-mist px-3">
              <IsikukoodReveal userId={user.id} masked={maskIsikukood(user.isikukood)} />
            </div>
          </div>
          <InfoRow label="Sisselogimise viis">{authMethodLabels[user.authMethod]}</InfoRow>
          <InfoRow label="Roll">{userRoleLabels[user.role]}</InfoRow>
          <InfoRow label="Olek">
            <UserStatusPill status={user.status} />
          </InfoRow>
        </div>

        {suspension.active ? (
          <div className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
            <p className="font-semibold">Konto on peatatud.</p>
            <p>
              {suspension.duration
                ? `Kestus: ${suspendDurationLabels[suspension.duration as keyof typeof suspendDurationLabels]}.`
                : 'Kestus: tähtajatu.'}{' '}
              {suspension.suspendedUntil
                ? `Lõpeb: ${formatDateTime(suspension.suspendedUntil)}.`
                : null}{' '}
              {suspension.reason ? `Põhjus: ${suspension.reason}` : null}
            </p>
          </div>
        ) : null}

        {canWrite ? (
          suspension.active ? (
            <form
              action={resumeUserAction}
              className="mt-sm flex flex-wrap items-end gap-sm border-t border-border pt-md"
            >
              <input type="hidden" name="userId" value={user.id} />
              <div className="w-80">
                <FormField
                  label="Aktiveerimise põhjus (kohustuslik)"
                  name="reason"
                  type="text"
                  required
                  minLength={5}
                />
              </div>
              <button type="submit" className={primaryButtonClass}>
                Lõpeta peatus
              </button>
            </form>
          ) : (
            <form
              action={suspendUserAction}
              className="mt-sm flex flex-wrap items-end gap-sm border-t border-border pt-md"
            >
              <input type="hidden" name="userId" value={user.id} />
              <div className="w-56">
                <FormSelectField
                  label="Kestus"
                  name="duration"
                  options={suspendDurations.map((duration) => ({
                    value: duration,
                    label: suspendDurationLabels[duration],
                  }))}
                  defaultValue="24h"
                />
              </div>
              <div className="w-80">
                <FormField
                  label="Peatamise põhjus (kohustuslik)"
                  name="reason"
                  type="text"
                  required
                  minLength={5}
                />
              </div>
              <button type="submit" className={dangerButtonClass}>
                Peata konto
              </button>
            </form>
          )
        ) : null}
        <p className="text-bodySm text-ink-muted">
          Peatamine blokeerib sisselogimise ja pakkumised, deaktiveerib aktiivsed automaatpakkujad ning
          teavitab kasutajat.
        </p>
      </section>

      <section className="max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md">
        <h2 className="font-heading text-h4 font-bold text-ink">Muuda andmeid</h2>
        {canWrite ? (
          <form action={updateUserAction} className="space-y-sm">
            <input type="hidden" name="id" value={user.id} />
            <FormField label="Nimi" name="name" defaultValue={user.name ?? ''} />
            <FormField label="Telefon" name="phone" type="tel" defaultValue={user.phone ?? ''} />
            <div className="w-64">
              <FormSelectField label="Roll" name="role" options={roleOptions} defaultValue={user.role} />
            </div>
            <div className="flex items-center gap-sm pt-xs">
              <button type="submit" className={primaryButtonClass}>
                Salvesta
              </button>
              <Link href="/admin/users" className={secondaryButtonClass}>
                Tühista
              </Link>
            </div>
          </form>
        ) : (
          <p className="text-bodySm text-ink-muted">Ainult lugemise õigus.</p>
        )}
      </section>

      <section>
        <h2 className="font-heading text-h4 font-bold text-ink">Aktiivsed sessioonid</h2>
        <p className="mt-xs text-bodySm text-ink-muted">
          Kasutaja avatud sisselogimisseansid. Tühistamine sunnib uue sisselogimise.
        </p>
        <div className="mt-sm">
          <DataTable
            columns={[
              {
                key: 'sessionId',
                label: 'Sessioon',
                render: (row) => (
                  <span className="font-mono text-bodySm">{row.sessionId.slice(0, 8)}</span>
                ),
              },
              {
                key: 'createdAt',
                label: 'Algatatud',
                render: (row) => formatDateTime(row.createdAt),
              },
              {
                key: 'actions',
                label: 'Tegevused',
                render: (row) => (
                  <form action={revokeUserSessionAction}>
                    <input type="hidden" name="userId" value={row.userId} />
                    <input type="hidden" name="sessionId" value={row.sessionId} />
                    <button type="submit" className={smallButtonClass}>
                      Tühista
                    </button>
                  </form>
                ),
              },
            ]}
            rows={sessions}
            emptyLabel="Aktiivseid sessioone ei ole."
          />
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Profiilid
// ---------------------------------------------------------------------------

async function ProfilesTab({ userId }: { userId: string }) {
  const { repositories } = await requireAdminRepositories()
  const { docs: profiles } = await repositories.find({
    collection: 'profile',
    where: { user: { equals: userId } } ,
    sort: '-createdAt',
    pagination: false,
  })

  if (profiles.length === 0) {
    return (
      <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-ink-muted">
        Kasutajal ei ole profiile.
      </div>
    )
  }

  const approvalLabels: Record<string, string> = {
    pending: 'Ootel',
    approved: 'Kinnitatud',
    rejected: 'Tagasi lükatud',
  }

  return (
    <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
      {profiles.map((profile) => (
        <article
          key={profile.id}
          className="space-y-xs rounded-card border border-border bg-bgPage p-md"
        >
          <header className="flex items-center justify-between gap-sm">
            <h3 className="font-heading text-h5 font-bold text-ink">
              {profile.type === 'company' ? 'Ettevõtte profiil' : 'Eraprofiiil'}
            </h3>
            <span className="text-label font-semibold text-ink-muted">
              {approvalLabels[profile.approvalStatus] ?? profile.approvalStatus}
            </span>
          </header>
          <dl className="space-y-1 text-bodySm">
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Kuvatav nimi</dt>
              <dd className="font-semibold text-ink">{profile.displayName ?? '—'}</dd>
            </div>
            {profile.type === 'company' ? (
              <>
                <div className="flex justify-between gap-sm">
                  <dt className="text-ink-muted">Ettevõte</dt>
                  <dd className="font-semibold text-ink">{profile.companyName ?? '—'}</dd>
                </div>
                <div className="flex justify-between gap-sm">
                  <dt className="text-ink-muted">Registrikood</dt>
                  <dd className="font-mono font-semibold text-ink">{profile.companyRegCode ?? '—'}</dd>
                </div>
              </>
            ) : null}
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Telefon</dt>
              <dd className="font-semibold text-ink">{profile.phone ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-sm">
              <dt className="text-ink-muted">Loodud</dt>
              <dd className="font-semibold text-ink">{formatDateTime(profile.createdAt)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Õigused
// ---------------------------------------------------------------------------

async function RightsTab({
  user,
  auditEntries,
  canWrite,
}: {
  user: UserDoc
  auditEntries: AuditEntryDoc[]
  canWrite: boolean
}) {
  const { repositories } = await requireAdminRepositories()
  const { docs: rights } = await repositories.find({
    collection: 'auction-rights',
    where: { user: { equals: user.id } },
    sort: '-grantedAt',
    pagination: false,
  })

  const granterIds = [...new Set(rights.map((right) => right.grantedBy))]
  const granters =
    granterIds.length > 0
      ? (
          await repositories.find({
            collection: 'users',
            where: { id: { in: granterIds } },
            pagination: false,
          })
        ).docs
      : []
  const granterNames = new Map(granters.map((granter) => [granter.id, granter.name ?? granter.email]))

  const activeByType = new Map(
    rights.filter((right) => right.revokedAt === null).map((right) => [right.objectType, right]),
  )

  // Latest reason per object type from the grant audit trail.
  const grantReasons = new Map<string, string>()
  for (const entry of [...auditEntries].reverse()) {
    if (entry.action !== 'user.right_grant') continue
    const payload = readPayload(entry.after)
    const objectType = asString(payload.objectType)
    const reason = asString(payload.reason)
    if (objectType && reason && !grantReasons.has(objectType)) {
      grantReasons.set(objectType, reason)
    }
  }

  const timeline = auditEntries
  const grantOptions = auctionObjectTypes
    .filter((objectType) => !activeByType.has(objectType))
    .map((objectType) => ({ value: objectType, label: auctionObjectTypeLabels[objectType] }))

  return (
    <div className="space-y-lg">
      <section>
        <h2 className="font-heading text-h4 font-bold text-ink">Õiguste maatriks</h2>
        <p className="mt-xs text-bodySm text-ink-muted">
          Millistes objekti tüüpides tohib kasutaja pakkumusi teha. Andmine ja tühistamine nõuavad
          põhjust.
        </p>
        <div className="mt-sm space-y-sm">
          {auctionObjectTypes.map((objectType) => {
            const active = activeByType.get(objectType)
            return (
              <div
                key={objectType}
                className="flex flex-wrap items-start justify-between gap-sm rounded-card border border-border bg-bgPage p-md"
              >
                <div className="min-w-48 space-y-1">
                  <p className="text-body font-semibold text-ink">
                    {auctionObjectTypeLabels[objectType]}
                  </p>
                  {active ? (
                    <p className="text-bodySm text-ink-muted">
                      Antud {formatDateTime(active.grantedAt)} · andja{' '}
                      {granterNames.get(active.grantedBy) ?? active.grantedBy}
                    </p>
                  ) : (
                    <p className="text-bodySm text-ink-muted">Pole antud</p>
                  )}
                  {grantReasons.has(objectType) ? (
                    <p className="text-bodySm text-ink-muted">Põhjus: {grantReasons.get(objectType)}</p>
                  ) : null}
                </div>
                {canWrite ? (
                  active ? (
                    <form
                      action={revokeAuctionRightAction}
                      className="flex flex-wrap items-end gap-sm"
                    >
                      <input type="hidden" name="userId" value={user.id} />
                      <input type="hidden" name="rightId" value={active.id} />
                      <div className="w-72">
                        <FormField
                          label="Tühistamise põhjus (kohustuslik)"
                          name="reason"
                          type="text"
                          required
                          minLength={5}
                        />
                      </div>
                      <label className="flex items-center gap-2 pb-2 text-bodySm text-ink">
                        <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" />
                        Teavita kasutajat
                      </label>
                      <button type="submit" className={smallButtonClass}>
                        Tühista õigus
                      </button>
                    </form>
                  ) : (
                    <p className="text-bodySm text-ink-muted">—</p>
                  )
                ) : null}
              </div>
            )
          })}
        </div>

        {canWrite ? (
          grantOptions.length > 0 ? (
            <form
              action={grantAuctionRightAction}
              className="mt-sm flex max-w-container-sm flex-wrap items-end gap-sm rounded-card border border-border bg-bgPage p-md"
            >
              <input type="hidden" name="userId" value={user.id} />
              <div className="w-56">
                <FormSelectField
                  label="Anna uus õigus"
                  name="objectType"
                  options={grantOptions}
                  defaultValue={grantOptions[0]?.value}
                />
              </div>
              <div className="w-72">
                <FormField
                  label="Andmise põhjus (kohustuslik)"
                  name="reason"
                  type="text"
                  required
                  minLength={5}
                />
              </div>
              <label className="flex items-center gap-2 pb-2 text-bodySm text-ink">
                <input type="checkbox" name="notify" defaultChecked className="h-4 w-4" />
                Teavita kasutajat
              </label>
              <button type="submit" className={primaryButtonClass}>
                Anna õigus
              </button>
            </form>
          ) : (
            <p className="mt-sm text-bodySm text-ink-muted">Kõik objekti tüübid on juba õigustatud.</p>
          )
        ) : null}
      </section>

      <section>
        <h2 className="font-heading text-h4 font-bold text-ink">Õiguste ja peatuste ajalugu</h2>
        <p className="mt-xs text-bodySm text-ink-muted">
          Auditilogi kirjed: õiguste andmine, tühistamine põhjusega ja konto peatused.
        </p>
        <div className="mt-sm">
          {timeline.length === 0 ? (
            <div className="rounded-card border border-border bg-bgPage px-md py-lg text-center text-bodySm text-ink-muted">
              Ajaloo kirjeid ei ole.
            </div>
          ) : (
            <ol className="space-y-sm">
              {timeline.map((entry) => {
                const payload = readPayload(entry.after)
                const objectType = asString(payload.objectType)
                const reason = asString(payload.reason)
                return (
                  <li
                    key={entry.id}
                    className="rounded-card border border-border bg-bgPage px-md py-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-sm">
                      <span className="text-bodySm font-semibold text-ink">{actionLabel(entry.action)}</span>
                      <span className="text-bodySm text-ink-muted">{formatDateTime(entry.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-bodySm text-ink-muted">
                      {objectType ? `${objectTypeLabel(objectType)} · ` : ''}
                      {reason ? `Põhjus: ${reason}` : 'Põhjus pole kirjas'}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Lepingud
// ---------------------------------------------------------------------------

async function ContractsTab({ userId }: { userId: string }) {
  const { repositories } = await requireAdminRepositories()
  const { docs: contracts } = await repositories.find({
    collection: 'contracts',
    where: { signedBy: { equals: userId } },
    sort: '-createdAt',
    pagination: false,
  })

  const lotIds = [...new Set(contracts.map((contract) => contract.lotId))]
  const lots =
    lotIds.length > 0
      ? (
          await repositories.find({
            collection: 'auctions',
            where: { id: { in: lotIds } },
            pagination: false,
          })
        ).docs
      : []
  const lotTitles = new Map(lots.map((lot) => [lot.id, lot.title]))

  const rows: ContractRow[] = contracts.map((contract) => ({
    id: contract.id,
    auctionId: contract.lotId,
    auctionTitle: lotTitles.get(contract.lotId) ?? contract.lotId,
    status: contract.status,
    createdAt: contract.createdAt,
    signedAt: contract.signedAt,
  }))

  return (
    <div>
      <p className="mb-sm text-bodySm text-ink-muted">
        Lepingud, mille allkirjastaja on see kasutaja.
      </p>
      <DataTable
        columns={[
          {
            key: 'auctionTitle',
            label: 'Oksjon',
            render: (row) => (
              <Link
                href={`/admin/auctions/${row.auctionId}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.auctionTitle}
              </Link>
            ),
          },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => <ContractStatusPill status={row.status} />,
          },
          { key: 'createdAt', label: 'Loodud', render: (row) => formatDateTime(row.createdAt) },
          {
            key: 'signedAt',
            label: 'Allkirjastatud',
            render: (row) => formatDateTime(row.signedAt),
          },
        ]}
        rows={rows}
        emptyLabel="Lepinguid ei leitud."
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pakkumised
// ---------------------------------------------------------------------------

async function BidsTab({ userId }: { userId: string }) {
  const { repositories } = await requireAdminRepositories()
  const { docs: bids } = await repositories.find({
    collection: 'bids',
    where: { user: { equals: userId } },
    sort: '-createdAt',
    limit: 100,
  })

  const auctionIds = [...new Set(bids.map((bid) => bid.auctionId))]
  const auctions =
    auctionIds.length > 0
      ? (
          await repositories.find({
            collection: 'auctions',
            where: { id: { in: auctionIds } },
            pagination: false,
          })
        ).docs
      : []
  const auctionTitles = new Map(auctions.map((auction) => [auction.id, auction.title]))

  const rows: BidRow[] = bids.map((bid) => ({
    id: bid.id,
    auctionId: bid.auctionId,
    auctionTitle: auctionTitles.get(bid.auctionId) ?? bid.auctionId,
    amount: bid.amountCents,
    status: bid.status,
    source: bid.source,
    createdAt: bid.createdAt,
  }))

  return (
    <div>
      <p className="mb-sm text-bodySm text-ink-muted">
        Kasutaja 100 viimast pakkumist. Summad ja olekud on nähtavad; teiste pakkujate identiteet
        ei kuvata.
      </p>
      <DataTable
        columns={[
          {
            key: 'auctionTitle',
            label: 'Oksjon',
            render: (row) => (
              <Link
                href={`/admin/auctions/${row.auctionId}`}
                className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
              >
                {row.auctionTitle}
              </Link>
            ),
          },
          { key: 'amount', label: 'Summa', render: (row) => formatEur(row.amount) },
          {
            key: 'status',
            label: 'Olek',
            render: (row) => bidStatusLabels[row.status],
          },
          {
            key: 'source',
            label: 'Allikas',
            render: (row) => bidSourceLabels[row.source],
          },
          { key: 'createdAt', label: 'Aeg', render: (row) => formatDateTime(row.createdAt) },
        ]}
        rows={rows}
        emptyLabel="Pakkumisi ei ole."
      />
    </div>
  )
}
