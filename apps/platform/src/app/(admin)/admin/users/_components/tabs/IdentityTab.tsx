import Link from 'next/link'

import {
  resumeUserAction,
  revokeUserSessionAction,
  suspendUserAction,
  updateUserAction,
} from '../../../../_actions/users'
import { DataTable } from '../../../../_components/DataTable'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../../_components/FormField'
import {
  authMethodLabels,
  formatDateTime,
  UserStatusPill,
  userRoleLabels,
} from '../../../../_lib/labels'
import { IsikukoodReveal } from '../IsikukoodReveal'
import { suspendDurationLabels, suspendDurations } from '../suspend'
import type { SuspensionInfo } from './userTabHelpers'

const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-danger hover:text-danger'

const dangerButtonClass =
  'inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-ink-inverse transition-colors duration-hover ease-hover hover:bg-danger/90'

// guest is a technical role; staff never assign it.
const roleOptions = (Object.keys(userRoleLabels) as (keyof typeof userRoleLabels)[])
  .filter((role) => role !== 'guest')
  .map((role) => ({ value: role, label: userRoleLabels[role] }))

// Serializable user projection for the shared panel: the raw isikukood never
// leaves the server, only the masked form (unmasking stays the audited
// IsikukoodReveal action).
export interface IdentityTabUser {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: keyof typeof userRoleLabels
  status: React.ComponentProps<typeof UserStatusPill>['status']
  authMethod: keyof typeof authMethodLabels
  createdAt: string
  isikukoodMasked: string
}

export interface SessionRow {
  id: string
  sessionId: string
  createdAt: string
  userId: string
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

export function IdentityTab({
  user,
  sessions,
  suspension,
  canWrite,
}: {
  user: IdentityTabUser
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
              <IsikukoodReveal userId={user.id} masked={user.isikukoodMasked} />
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
            <p className="font-semibold">
              {suspension.banned ? 'Konto on keelatud.' : 'Konto on peatatud.'}
            </p>
            {suspension.banned ? (
              <p>Sama isikukoodiga uute kontode loomine on blokeeritud. </p>
            ) : null}
            <p>
              {!suspension.banned && suspension.duration
                ? `Kestus: ${suspendDurationLabels[suspension.duration as keyof typeof suspendDurationLabels]}.`
                : null}{' '}
              {suspension.suspendedUntil
                ? `Lõpeb: ${formatDateTime(suspension.suspendedUntil)}.`
                : null}{' '}
              {suspension.reason ? `Põhjus: ${suspension.reason}` : null}
            </p>
          </div>
        ) : null}

        {canWrite ? (
          suspension.active && !suspension.banned ? (
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
