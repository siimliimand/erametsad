'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import { formatCountdown, useCeremonyClock } from './use-ceremony-clock'
import {
  revealSealedBidsAction,
  type SealedCeremonyActionState,
  type SealedCeremonyContext,
} from '../../../../../_actions/auctions'
import { primaryButtonClass } from '../../../../../_components/FormField'

const initialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'awaiting-approval',
  error: null,
}

/**
 * Reveal arming: locked until 60 seconds after the recorded end time
 * (countdown against `revealAllowedAt`), then a one-shot confirm dialog.
 * The reveal is irreversible — a repeated call only replays the record.
 */
export function RevealPanel({
  auctionId,
  revealAllowedAt,
  signaturesExpired,
}: {
  auctionId: string
  revealAllowedAt: SealedCeremonyContext['revealAllowedAt']
  signaturesExpired: boolean
}) {
  const router = useRouter()
  const [revealState, revealFormAction, revealPending] = useActionState(
    revealSealedBidsAction,
    initialState,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const now = useCeremonyClock()

  useEffect(() => {
    if (revealState.ok) {
      setDialogOpen(false)
      router.refresh()
    }
  }, [revealState.ok, router])

  const unlocked =
    revealAllowedAt !== null && now !== null && now >= Date.parse(revealAllowedAt)
  const countdownMs =
    revealAllowedAt !== null && now !== null ? Date.parse(revealAllowedAt) - now : null

  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Paljastus</h2>
      <p className="mb-sm text-bodySm text-ink-muted">
        Mõlemad allkirjad on olemas. Paljastus dekrüpteerib kõik pakkumised korraga ja on
        ühekordne.
      </p>

      {revealState.error ? (
        <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          {revealState.error}
        </p>
      ) : null}

      {signaturesExpired ? (
        <p className="mb-sm text-bodySm text-danger">
          Allkirjad on aegunud — paljastus on lukus, kuni avaja on uuesti allkirja andnud.
        </p>
      ) : !unlocked ? (
        <p className="mb-sm text-bodySm text-ink-muted">
          {countdownMs !== null
            ? `Paljastus avaneb 60 sekundit pärast oksjoni lõppu (${formatCountdown(countdownMs)}).`
            : 'Paljastus avaneb 60 sekundit pärast oksjoni lõppu.'}
        </p>
      ) : null}

      <button
        type="button"
        className={primaryButtonClass}
        disabled={!unlocked || signaturesExpired}
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        Paljasta pakkumised
      </button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md"
          role="dialog"
          aria-modal="true"
          aria-label="Paljasta pakkumised"
        >
          <form
            action={revealFormAction}
            className="w-full max-w-md rounded-card border border-border bg-bgPage p-md shadow-modal"
          >
            <input type="hidden" name="auctionId" value={auctionId} />
            <h3 className="font-heading text-h4 font-bold text-ink">Paljasta pakkumised</h3>
            <p className="mt-sm rounded-input border-l-4 border-danger bg-danger-light px-md py-sm text-bodySm font-semibold text-danger">
              HOIATUS: paljastus on ühekordne ja tagasivõtmatu. Kõik pakkumised dekrüpteeritakse
              korraga ja toiming kirjutatakse pöördumatult auditilogisse.
            </p>
            {revealState.error ? (
              <p className="mt-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
                {revealState.error}
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
                disabled={revealPending}
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-ink-inverse transition-opacity duration-hover ease-hover hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {revealPending ? 'Paljastan…' : 'Jah, paljasta lõplikult'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
