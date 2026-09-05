'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import {
  confirmSealedCeremonyWinnerAction,
  type SealedCeremonyActionState,
  type SealedCeremonyContext,
  type RevealedBidView,
} from '../../../../../_actions/auctions'
import { FormField, primaryButtonClass } from '../../../../../_components/FormField'

type Decision = 'sold' | 'unsold' | 'house-backup'

const initialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'revealed',
  error: null,
}

function decisionLabel(decision: string): string {
  if (decision === 'sold') return 'Müük'
  if (decision === 'unsold') return 'Müümata'
  return 'Varupakkumine'
}

/**
 * Winner decision after the reveal: sold (top valid bid), unsold with a
 * typed reason, or the superadmin-only kiiroksjon house-backup. The opener
 * confirms behind step-up re-auth (password, or session token for eID-only
 * accounts); the reserve comparison itself stays server-side.
 */
export function WinnerConfirm({
  auctionId,
  bids,
  topMeetsReserve,
  isOpener,
  isSuperadmin,
  kiiroksjon,
}: {
  auctionId: string
  bids: SealedCeremonyContext['bids']
  topMeetsReserve: SealedCeremonyContext['topMeetsReserve']
  isOpener: boolean
  isSuperadmin: boolean
  kiiroksjon: boolean
}) {
  const router = useRouter()
  const [confirmState, confirmFormAction, confirmPending] = useActionState(
    confirmSealedCeremonyWinnerAction,
    initialState,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [decision, setDecision] = useState<Decision>('sold')
  const [reason, setReason] = useState('')

  const topBid: RevealedBidView | null = bids.find((bid) => bid.valid) ?? null
  const soldPossible = topBid !== null && topMeetsReserve !== false
  const houseBackupPossible = isSuperadmin && kiiroksjon
  const effectiveDecision: Decision =
    decision === 'sold' && !soldPossible ? 'unsold' : decision

  useEffect(() => {
    if (confirmState.ok) {
      setDialogOpen(false)
      router.refresh()
    }
  }, [confirmState.ok, router])

  if (!isOpener) {
    return (
      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Võitja kinnitamine</h2>
        <p className="text-bodySm text-ink-muted">
          Võitja kinnitab avaja pärast uuesti autentimist. Oota, kuni avaja tulemuse kinnitab.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Võitja kinnitamine</h2>
      {!soldPossible ? (
        <p className="mb-sm text-bodySm text-ink-muted">
          {topBid === null
            ? 'Kehtivaid pakkumisi ei ole — märgi oksjon müümata.'
            : 'Kõrgeim kehtiv pakkumine ei täida piirhinna — võimalik on müümata või varupakkumine.'}
        </p>
      ) : null}
      {!houseBackupPossible && kiiroksjon ? (
        <p className="mb-sm text-bodySm text-ink-muted">
          Varupakkumise tee on ainult superadminile.
        </p>
      ) : null}

      {confirmState.error ? (
        <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          {confirmState.error}
        </p>
      ) : null}

      <button
        type="button"
        className={primaryButtonClass}
        disabled={confirmPending}
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        Kinnita tulemus
      </button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md"
          role="dialog"
          aria-modal="true"
          aria-label="Kinnita tulemus"
        >
          <form
            action={confirmFormAction}
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-card border border-border bg-bgPage p-md shadow-modal"
          >
            <input type="hidden" name="auctionId" value={auctionId} />
            <input type="hidden" name="bidId" value={topBid?.id ?? ''} />
            <input type="hidden" name="decision" value={effectiveDecision} />
            <h3 className="font-heading text-h4 font-bold text-ink">Kinnita tulemus</h3>
            <p className="mt-sm rounded-input border-l-4 border-danger bg-danger-light px-md py-sm text-bodySm font-semibold text-danger">
              HOIATUS: otsus on lõplik. Müük avaldab lõpphinna ja koostab võitjale lepingu;
              müümata kuulutab oksjoni müüdud tagasi ei tule.
            </p>

            <fieldset className="mt-md space-y-xs">
              <legend className="text-label font-semibold text-ink">Tulemus</legend>
              <label className="flex items-center gap-sm text-bodySm text-ink">
                <input
                  type="radio"
                  name="decision-radio"
                  value="sold"
                  checked={effectiveDecision === 'sold'}
                  disabled={!soldPossible}
                  onChange={() => {
                    setDecision('sold')
                  }}
                />
                Müük — kõrgeim kehtiv pakkumine võidab
              </label>
              <label className="flex items-center gap-sm text-bodySm text-ink">
                <input
                  type="radio"
                  name="decision-radio"
                  value="unsold"
                  checked={effectiveDecision === 'unsold'}
                  onChange={() => {
                    setDecision('unsold')
                  }}
                />
                Müümata — kuuluta müümata põhjusega
              </label>
              {houseBackupPossible ? (
                <label className="flex items-center gap-sm text-bodySm text-ink">
                  <input
                    type="radio"
                    name="decision-radio"
                    value="house-backup"
                    checked={effectiveDecision === 'house-backup'}
                    onChange={() => {
                      setDecision('house-backup')
                    }}
                  />
                  Varupakkumine — kiiroksjoni majapakkumise töövoog (superadmin)
                </label>
              ) : null}
            </fieldset>

            {effectiveDecision === 'unsold' || effectiveDecision === 'house-backup' ? (
              <FormField
                label="Põhjus"
                name="reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                }}
                required={effectiveDecision === 'unsold'}
                minLength={5}
                hint={
                  effectiveDecision === 'unsold'
                    ? 'Kohustuslik, vähemalt 5 tähemärki — läheb auditilogisse.'
                    : 'Valikuline — läheb auditilogisse.'
                }
              />
            ) : null}

            <FormField
              label="Kinnitus (kirjuta KINNITAN)"
              name="keyword"
              autoComplete="off"
              required
              minLength={8}
              maxLength={8}
            />
            <FormField
              label="Salasõna (avaja uus autentimine)"
              name="password"
              type="password"
              autoComplete="current-password"
              hint="Step-up: avaja kinnitab uuesti. eID-konto (ilma salasõnata) kinnitab kehtiva sessiooniga — jäta väli tühjaks."
            />

            {confirmState.error ? (
              <p className="mt-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
                {confirmState.error}
              </p>
            ) : null}

            <div className="mt-md flex justify-end gap-sm">
              <button
                type="button"
                onClick={() => {
                  setDialogOpen(false)
                }}
                className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
              >
                Katkesta
              </button>
              <button
                type="submit"
                disabled={
                  confirmPending ||
                  (effectiveDecision === 'unsold' && reason.trim().length < 5)
                }
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-ink-inverse transition-opacity duration-hover ease-hover hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmPending
                  ? 'Kinnitan…'
                  : `Kinnita lõplikult: ${decisionLabel(effectiveDecision)}`}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
