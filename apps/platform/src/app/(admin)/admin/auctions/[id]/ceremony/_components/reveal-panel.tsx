'use client'

import { Lock } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import { formatCountdown, useCeremonyClock } from './use-ceremony-clock'
import {
  revealSealedBidsAction,
  type SealedCeremonyActionState,
  type SealedCeremonyContext,
} from '../../../../../_actions/auctions'
import { primaryButtonClass } from '../../../../../_components/FormField'
import { useToast } from '../../../../../_components/ui/Toast'

const initialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'awaiting-approval',
  error: null,
}

// Demo 05-sealed-opening timings: rows fade in 0.4s ease-out with a
// 0.18s stagger per row index. The pre-reveal table only holds masked
// placeholders — real bid data does not exist client-side before the
// one-shot reveal, so nothing can leak through the blur.
const PLACEHOLDER_ROW_COUNT = 4
const STAGGER_SECONDS = 0.18

/**
 * Reveal arming: locked until 60 seconds after the recorded end time
 * (countdown against `revealAllowedAt`), then a one-shot confirm dialog.
 * The reveal is irreversible — a repeated call only replays the record.
 * Presentation only: blurred masked table with a veil before the reveal,
 * staggered row fade-in after it; `prefers-reduced-motion` skips the
 * blur and the stagger entirely.
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
  const toast = useToast()
  const [revealState, revealFormAction, revealPending] = useActionState(
    revealSealedBidsAction,
    initialState,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const now = useCeremonyClock()

  // Server-action error semantics stay intact: the state drives the toast.
  useEffect(() => {
    if (revealState.ok) {
      setDialogOpen(false)
      toast({ tone: 'success', title: 'Pakkumised dekrüpteeritud ja paljastatud.' })
      router.refresh()
    } else if (revealState.error !== null) {
      toast({
        tone: 'error',
        title: 'Paljastamine ebaõnnestus',
        description: revealState.error,
      })
    }
  }, [revealState, toast, router])

  const unlocked =
    revealAllowedAt !== null && now !== null && now >= Date.parse(revealAllowedAt)
  const countdownMs =
    revealAllowedAt !== null && now !== null ? Date.parse(revealAllowedAt) - now : null
  const revealed = revealState.ok

  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Paljastus</h2>
      <p className="mb-sm text-bodySm text-inkMuted">
        Mõlemad allkirjad on olemas. Paljastus dekrüpteerib kõik pakkumised korraga ja on
        ühekordne.
      </p>

      {signaturesExpired ? (
        <p className="mb-sm text-bodySm text-danger">
          Allkirjad on aegunud — paljastus on lukus, kuni avaja on uuesti allkirja andnud.
        </p>
      ) : !unlocked ? (
        <p className="mb-sm text-bodySm text-inkMuted">
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

      <div className="relative mt-md">
        <div className="overflow-x-auto rounded-input border border-border">
          <table
            aria-hidden="true"
            className={`w-full border-collapse text-left ${revealed ? '' : 'pointer-events-none select-none blur-[6px] motion-reduce:blur-none'}`}
          >
            <thead>
              <tr className="border-b border-border bg-bgMist">
                <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">
                  Koht
                </th>
                <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">
                  Summa
                </th>
                <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">
                  Esitatud
                </th>
                <th scope="col" className="h-10 px-3 text-label font-semibold text-inkMuted">
                  Kehtivus
                </th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: PLACEHOLDER_ROW_COUNT }, (_, index) => (
                <tr
                  key={index}
                  className={`border-b border-border transition-[opacity,transform] duration-[400ms] ease-out last:border-b-0 motion-reduce:[transition-delay:0s] motion-reduce:transition-none ${
                    revealed
                      ? 'translate-y-0 opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100'
                      : 'translate-y-[6px] opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100'
                  }`}
                  style={{ transitionDelay: `${String(index * STAGGER_SECONDS)}s` }}
                >
                  <td className="h-10 px-3 font-mono text-bodySm text-inkMuted">{index + 1}.</td>
                  <td className="h-10 px-3 font-mono text-bodySm text-inkMuted">•• ••• €</td>
                  <td className="h-10 px-3 text-bodySm text-inkMuted">••.•• ••:••</td>
                  <td className="h-10 px-3 text-bodySm text-inkMuted">••••••</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!revealed ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-xs bg-bgPage/70 px-md py-lg text-center">
            <Lock aria-hidden="true" className="h-[22px] w-[22px] text-inkMuted" />
            <p className="max-w-[480px] text-bodySm font-medium text-inkMuted">
              Kõik pakkumised on krüpteeritud. Paljastamine dekrüpteerib need üheaegselt ja kannab
              tegevuse püsivasse auditlogisse.
            </p>
          </div>
        ) : null}
      </div>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md"
          role="dialog"
          aria-modal="true"
          aria-label="Paljasta pakkumised"
        >
          <form
            action={revealFormAction}
            className="w-full max-w-md rounded-card border border-border bg-bgPage p-md shadow-modal [animation:modal-in_0.18s_ease-out] motion-reduce:[animation:none]"
          >
            <input type="hidden" name="auctionId" value={auctionId} />
            <h3 className="font-heading text-h4 font-bold text-ink">Paljasta pakkumised</h3>
            <p className="mt-sm rounded-input border-l-4 border-danger bg-dangerLight px-md py-sm text-bodySm font-semibold text-danger">
              HOIATUS: paljastus on ühekordne ja tagasivõtmatu. Kõik pakkumised dekrüpteeritakse
              korraga ja toiming kirjutatakse pöördumatult auditilogisse.
            </p>
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
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
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
