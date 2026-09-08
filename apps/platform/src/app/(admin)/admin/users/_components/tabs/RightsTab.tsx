import { actionLabel, asString, objectTypeLabel, readPayload } from './userTabHelpers'
import {
  grantAuctionRightAction,
  revokeAuctionRightAction,
} from '../../../../_actions/users'
import {
  FormField,
  FormSelectField,
  primaryButtonClass,
} from '../../../../_components/FormField'
import { auctionObjectTypeLabels, formatDateTime } from '../../../../_lib/labels'

import type { CoreCollectionDocs, AuditEntryDoc } from '@/lib/data/repositories'
import { auctionObjectTypes } from '@/lib/data/schema'


const smallButtonClass =
  'inline-flex h-8 items-center rounded-button border border-border bg-bgPage px-3 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-danger hover:text-danger'

export type AuctionRightRow = CoreCollectionDocs['auction-rights']

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
