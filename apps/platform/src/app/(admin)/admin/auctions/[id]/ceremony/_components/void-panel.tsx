'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import {
  voidSealedBidsAction,
  type SealedCeremonyActionState,
} from '../../../../../_actions/auctions'
import { FormField, primaryButtonClass } from '../../../../../_components/FormField'

const initialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'checklist',
  error: null,
}

/**
 * Superadmin escape hatch before the winner decision: a typed reason voids
 * the opening — every sealed bid is rejected and the lot is declared
 * unsold. The server re-checks the role, the reason and the ceremony state.
 */
export function VoidPanel({ auctionId }: { auctionId: string }) {
  const router = useRouter()
  const [voidState, voidFormAction, voidPending] = useActionState(
    voidSealedBidsAction,
    initialState,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (voidState.ok) {
      setDialogOpen(false)
      router.refresh()
    }
  }, [voidState.ok, router])

  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Avamise tühistamine</h2>
      <p className="mb-sm text-bodySm text-ink-muted">
        Tühistamine on ainult superadminile: kõik suletud pakkumised kuulutatakse kehtetuks ja
        oksjon märgitakse müümata. Summasid ei paljastata.
      </p>

      {voidState.error ? (
        <p className="mb-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
          {voidState.error}
        </p>
      ) : null}

      <button
        type="button"
        className={primaryButtonClass}
        disabled={voidPending}
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        Tühista avamine
      </button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md"
          role="dialog"
          aria-modal="true"
          aria-label="Tühista avamine"
        >
          <form
            action={voidFormAction}
            className="w-full max-w-md rounded-card border border-border bg-bgPage p-md shadow-modal"
          >
            <input type="hidden" name="auctionId" value={auctionId} />
            <h3 className="font-heading text-h4 font-bold text-ink">Tühista avamine</h3>
            <p className="mt-sm rounded-input border-l-4 border-danger bg-danger-light px-md py-sm text-bodySm font-semibold text-danger">
              HOIATUS: tühistamine on lõplik. Kõik pakkumised kehtetuks, võitjat ei kuulutata ja
              oksjon märgitakse müümata.
            </p>

            <div className="mt-md">
              <FormField
                label="Tühistamise põhjus"
                name="reason"
                value={reason}
                onChange={(event) => {
                  setReason(event.target.value)
                }}
                required
                minLength={5}
                hint="Kohustuslik, vähemalt 5 tähemärki — läheb auditilogisse."
              />
            </div>

            {voidState.error ? (
              <p className="mt-sm rounded-input border border-danger bg-danger-light px-md py-sm text-bodySm text-danger">
                {voidState.error}
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
                disabled={voidPending || reason.trim().length < 5}
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-ink-inverse transition-opacity duration-hover ease-hover hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {voidPending ? 'Tühistan…' : 'Jah, tühistada lõplikult'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
