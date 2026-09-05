'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect } from 'react'

import { CeremonyChecklist, ceremonyChecklistPass } from './ceremony-checklist'
import { formatCountdown, SIGNATURE_TTL_MS, useCeremonyClock } from './use-ceremony-clock'
import {
  signSealedApproverAction,
  signSealedOpenerAction,
  type SealedCeremonyActionState,
  type SealedCeremonyContext,
} from '../../../../../_actions/auctions'
import { FormField, FormTextareaField, primaryButtonClass } from '../../../../../_components/FormField'
import { formatDateTime } from '../../../../../_lib/labels'

type SignatureSlot = SealedCeremonyContext['opener']

const initialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'checklist',
  error: null,
}

function SignatureState({
  signer,
  label,
  now,
}: {
  signer: SignatureSlot
  label: string
  now: number | null
}) {
  const remainingMs =
    signer !== null && now !== null
      ? Date.parse(signer.signedAt) + SIGNATURE_TTL_MS - now
      : null
  return (
    <div className="rounded-input border border-border bg-bgMist px-md py-sm">
      <dt className="text-label font-semibold text-ink-muted">{label}</dt>
      <dd className="mt-1 text-bodySm text-ink">
        {signer !== null ? (
          <>
            <span className="font-semibold">{signer.userId}</span>
            {' · '}
            {formatDateTime(signer.signedAt)}
            {remainingMs !== null ? (
              <>
                {' · '}
                {remainingMs > 0 ? (
                  <span className="text-primary">kehtiv veel {formatCountdown(remainingMs)}</span>
                ) : (
                  <span className="text-danger">azenud</span>
                )}
              </>
            ) : null}
          </>
        ) : (
          <span className="text-ink-muted">—allkiri puudub</span>
        )}
      </dd>
    </div>
  )
}

/**
 * Checklist gating plus the two-person signing step: opener types "AVAN",
 * approver types "KINNITAN" from a distinct session; each signature is
 * valid for 30 minutes (server-enforced, countdown is display-only).
 */
export function SigningPanel({
  auctionId,
  checklist,
  opener,
  approver,
  signaturesExpired,
  currentUserId,
}: {
  auctionId: string
  checklist: SealedCeremonyContext['checklist']
  opener: SignatureSlot
  approver: SignatureSlot
  signaturesExpired: boolean
  currentUserId: string
}) {
  const router = useRouter()
  const [openerState, openerFormAction, openerPending] = useActionState(
    signSealedOpenerAction,
    initialState,
  )
  const [approverState, approverFormAction, approverPending] = useActionState(
    signSealedApproverAction,
    initialState,
  )
  const now = useCeremonyClock()

  const signed = openerState.ok || approverState.ok
  useEffect(() => {
    if (signed) router.refresh()
  }, [signed, router])

  const checklistPass = ceremonyChecklistPass(checklist)
  const openerSigned = opener !== null

  return (
    <div className="space-y-md">
      <CeremonyChecklist checklist={checklist} />

      {!checklistPass ? (
        <p className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Eelkontroll ei läbi — allkirjastamine on lukus, kuni kõik eeltingimused on täidetud.
        </p>
      ) : null}
      {signaturesExpired ? (
        <p className="rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          Allkirjad on aegunud (30 minutit). Alusta avamist uuesti: avaja annab allkirja uuesti.
        </p>
      ) : null}

      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-sm font-heading text-h4 font-bold text-ink">Kahe isiku allkirjad</h2>
        <dl className="mb-md grid grid-cols-1 gap-xs sm:grid-cols-2">
          <SignatureState signer={opener} label="Avaja" now={now} />
          <SignatureState signer={approver} label="Kinnitaja" now={now} />
        </dl>

        {openerState.error ? (
          <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
            {openerState.error}
          </p>
        ) : null}
        {approverState.error ? (
          <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
            {approverState.error}
          </p>
        ) : null}

        {!openerSigned || signaturesExpired ? (
          <form action={openerFormAction} className="max-w-md space-y-sm">
            <input type="hidden" name="auctionId" value={auctionId} />
            <FormField
              label="Avaja kinnitus (kirjuta AVAN)"
              name="keyword"
              autoComplete="off"
              required
              minLength={4}
              maxLength={4}
              disabled={!checklistPass || openerPending}
            />
            <FormTextareaField
              label="Märkus (valikuline, läheb auditilogisse)"
              name="note"
              rows={2}
              disabled={!checklistPass || openerPending}
            />
            <button type="submit" className={primaryButtonClass} disabled={!checklistPass || openerPending}>
              {openerPending ? 'Kinnitan…' : 'Kinnita avajana'}
            </button>
          </form>
        ) : (
          <form action={approverFormAction} className="max-w-md space-y-sm">
            <input type="hidden" name="auctionId" value={auctionId} />
            <FormField
              label="Kinnitaja kinnitus (kirjuta KINNITAN)"
              name="keyword"
              autoComplete="off"
              required
              minLength={8}
              maxLength={8}
              disabled={approverPending}
            />
            <button type="submit" className={primaryButtonClass} disabled={approverPending}>
              {approverPending ? 'Kinnitan…' : 'Kinnita kinnitajana'}
            </button>
            <p className="text-bodySm text-ink-muted">
              Kinnitaja peab olema teine isik ja teine sessioon kui avaja
              {currentUserId === opener.userId ? ' — sina oled selle avamise avaja.' : '.'}
            </p>
          </form>
        )}
        <p className="mt-sm text-bodySm text-ink-muted">
          Allkirjad kehtivad 30 minutit ja siduvad kindla sessiooniga.
        </p>
      </section>
    </div>
  )
}
