'use client'

import { useCallback, useEffect, useState } from 'react'

import { actionLabel, asString, objectTypeLabel, readPayload } from './userTabHelpers'
import {
  grantAuctionRightAction,
  revokeAuctionRightAction,
  userRightsContextAction,
  voidLeadingBidAction,
  type RightsContextProfile,
  type UserRightsContext,
} from '../../../../_actions/users'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
} from '../../../../_components/FormField'
import { auctionObjectTypeLabels, formatDateTime, formatEur } from '../../../../_lib/labels'

import type { CoreCollectionDocs, AuditEntryDoc } from '@/lib/data/repositories'
import { auctionObjectTypes } from '@/lib/data/schema'


const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-danger hover:text-danger'

const warningBoxClass =
  'rounded-input border border-danger bg-dangerLight px-md py-sm text-bodySm text-danger'

export type AuctionRightRow = CoreCollectionDocs['auction-rights']

/** One per-profile matrix row: the object types that profile can bid in. */
export interface RightsProfileRow {
  id: string
  label: string
  approvalStatus: string
  objectTypes: string[]
}

const approvalLabels: Record<string, string> = {
  approved: 'kinnitatud',
  pending: 'kinnitamata',
  rejected: 'tagasi lükatud',
}

function profileLabel(profile: Pick<RightsContextProfile, 'type' | 'displayName' | 'companyName'>): string {
  if (profile.type === 'company') {
    return profile.companyName ?? profile.displayName ?? 'Ettevõtte profiil'
  }
  return profile.displayName ?? 'Era profiil'
}

/**
 * Per-profile matrix rows (spec delta admin-people): profiles render as
 * their own rows only when their effective rights differ. An unapproved
 * profile carries no usable bidding rights; identical sets keep the single
 * shared matrix. Returns null when the shared matrix is enough.
 */
export function profileRightGroups(
  profiles: RightsContextProfile[],
  activeObjectTypes: readonly string[],
): RightsProfileRow[] | null {
  if (profiles.length <= 1) return null
  const rows = profiles.map((profile) => ({
    id: profile.id,
    label: profileLabel(profile),
    approvalStatus: profile.approvalStatus,
    objectTypes:
      profile.approvalStatus === 'approved' ? [...activeObjectTypes] : [],
  }))
  const first = JSON.stringify(rows[0]?.objectTypes ?? [])
  const allSame = rows.every((row) => JSON.stringify(row.objectTypes) === first)
  return allSame ? null : rows
}

export function RightsTab({
  userId,
  rights,
  granterNames,
  auditEntries,
  canWrite,
}: {
  userId: string
  rights: AuctionRightRow[]
  granterNames: Record<string, string>
  auditEntries: AuditEntryDoc[]
  canWrite: boolean
}) {
  const activeByType = new Map(
    rights.filter((right) => right.revokedAt === null).map((right) => [right.objectType, right]),
  )
  const activeTypes = [...activeByType.keys()]

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

  const [context, setContext] = useState<UserRightsContext | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [voidingBidId, setVoidingBidId] = useState<string | null>(null)
  const [voidError, setVoidError] = useState<string | null>(null)

  const loadContext = useCallback(() => {
    userRightsContextAction(userId)
      .then((result) => {
        if (result.ok) {
          setContext(result.context)
        }
      })
      .catch(() => {
        // No context feed: the tab keeps its static matrix.
      })
  }, [userId])

  useEffect(() => {
    loadContext()
  }, [loadContext])

  const leadingBids = context?.leadingBids ?? []
  const voidReady = (context?.isSuperadmin ?? false) && voidReason.trim().length >= 5

  const voidLeadingBid = (bidId: string) => {
    setVoidingBidId(bidId)
    setVoidError(null)
    voidLeadingBidAction(bidId, voidReason.trim())
      .then((result) => {
        setVoidingBidId(null)
        if (result.ok) {
          setVoidReason('')
          loadContext()
        } else {
          setVoidError(result.error)
        }
      })
      .catch(() => {
        setVoidingBidId(null)
        setVoidError('Juhtiva pakkumise tühistamine ebaõnnestus.')
      })
  }

  const timeline = auditEntries
  const grantOptions = auctionObjectTypes
    .filter((objectType) => !activeByType.has(objectType))
    .map((objectType) => ({ value: objectType, label: auctionObjectTypeLabels[objectType] }))

  const profileGroups = profileRightGroups(context?.profiles ?? [], activeTypes)

  const leadingBidWarning = (keyPrefix: string) => (
    <div className={`${warningBoxClass} mt-2`} role="alert">
      <p className="font-semibold">HT: kasutajal on juhtiv pakkumine aktiivsel oksjonil</p>
      {leadingBids.map((bid) => (
        <p key={`${keyPrefix}-${bid.bidId}`}>
          {bid.auctionTitle ?? bid.auctionId} · {formatEur(bid.amountCents)} · viide{' '}
          {bid.bidId.slice(0, 8)}
        </p>
      ))}
    </div>
  )

  return (
    <div className="space-y-lg">
      {leadingBids.length > 0 ? (
        <section aria-label="Juhtivad pakkumised">
          {leadingBidWarning('top')}
          {context?.isSuperadmin ? (
            <div className="mt-sm max-w-container-sm space-y-sm rounded-card border border-border bg-bgPage p-md">
              <h3 className="text-body font-semibold text-ink">Juhtiva pakkumise tühistamine (superadmin)</h3>
              <p className="text-bodySm text-ink-muted">
                Tühistamine komenseerib pakkumise oleku (summat ei muudeta) ja logitakse auditilogisse.
              </p>
              <div className="w-80">
                <FormField
                  label="Tühistamise põhjus (kohustuslik)"
                  name="voidReason"
                  type="text"
                  value={voidReason}
                  onChange={(event) => {
                    setVoidReason(event.target.value)
                  }}
                />
              </div>
              {voidError ? (
                <p role="alert" className="text-bodySm text-danger">
                  {voidError}
                </p>
              ) : null}
              <ul className="space-y-xs">
                {leadingBids.map((bid) => (
                  <li key={bid.bidId} className="flex flex-wrap items-center gap-sm">
                    <span className="text-bodySm text-ink">
                      {bid.auctionTitle ?? bid.auctionId} · {formatEur(bid.amountCents)} ·{' '}
                      {bid.bidId.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        voidLeadingBid(bid.bidId)
                      }}
                      disabled={!voidReady || voidingBidId !== null}
                      className={smallButtonClass}
                    >
                      {voidingBidId === bid.bidId ? 'Tühistan…' : 'Tühista juhtiv pakkumine'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      {profileGroups ? (
        <section>
          <h2 className="font-heading text-h4 font-bold text-ink">Profiilipõhised õigused</h2>
          <p className="mt-xs text-bodySm text-ink-muted">
            Profiilide õigused erinevad, seega kuvame maatriksi profiilide lõikes. Kinnitamata
            profiil ei saa pakkumisi esitada.
          </p>
          <div className="mt-sm space-y-sm">
            {profileGroups.map((group) => (
              <div
                key={group.id}
                className="rounded-card border border-border bg-bgPage p-md"
              >
                <p className="text-body font-semibold text-ink">
                  {group.label}{' '}
                  <span className="text-bodySm font-normal text-ink-muted">
                    ({approvalLabels[group.approvalStatus] ?? group.approvalStatus})
                  </span>
                </p>
                <p className="mt-1 text-bodySm text-ink-muted">
                  {group.objectTypes.length > 0
                    ? `Kehtivad: ${group.objectTypes.map((objectType) => auctionObjectTypeLabels[objectType as keyof typeof auctionObjectTypeLabels]).join(', ')}`
                    : 'Kehtivaid õigusi pole'}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

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
                      {granterNames[active.grantedBy] ?? active.grantedBy}
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
                      <input type="hidden" name="userId" value={userId} />
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
                      {leadingBids.length > 0 ? leadingBidWarning(`revoke-${active.id}`) : null}
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
              <input type="hidden" name="userId" value={userId} />
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
