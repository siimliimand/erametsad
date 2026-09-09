'use client'

import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useState } from 'react'

import {
  markSealedUnsoldShortcutAction,
  type SealedCeremonyActionState,
  type SealedCeremonyChecklist,
} from '../../../../../_actions/auctions'
import { FormTextareaField, secondaryButtonClass } from '../../../../../_components/FormField'
import { useToast } from '../../../../../_components/ui/Toast'
import { LiveAuditStrip } from '../_lib/live-audit-strip'

/** Signing is server-blocked unless all three hard preconditions pass. */
export function ceremonyChecklistPass(checklist: SealedCeremonyChecklist): boolean {
  return (
    checklist.endingWorker.done &&
    checklist.pendingAlapakkumised === 0 &&
    checklist.template.active
  )
}

function ChecklistItem({
  pass,
  label,
  detail,
  warning,
}: {
  pass: boolean
  label: string
  detail: string
  warning?: string | undefined
}) {
  return (
    <li className="flex items-start gap-sm">
      <span
        aria-hidden="true"
        className={`mt-0.5 font-semibold ${pass ? 'text-primary' : 'text-danger'}`}
      >
        {pass ? '✓' : '✗'}
      </span>
      <div>
        <p className="text-bodySm font-semibold text-ink">{label}</p>
        <p className={`text-bodySm ${pass ? 'text-inkMuted' : 'text-danger'}`}>{detail}</p>
        {warning ? (
          <p className="mt-1 text-bodySm text-statusEndingSoon">{warning}</p>
        ) : null}
      </div>
    </li>
  )
}

/** Precondition checklist: pass/fail per item, gating the signing UI. */
export function CeremonyChecklist({ checklist }: { checklist: SealedCeremonyChecklist }) {
  const { endingWorker, pendingAlapakkumised, template } = checklist
  return (
    <>
      <section className="rounded-card border border-border bg-bgPage p-md">
        <h2 className="mb-sm font-heading text-h4 font-bold text-ink">Eelkontroll</h2>
        <ul className="space-y-sm">
          <ChecklistItem
            pass={endingWorker.done}
            label="Lõppaeg on kinnitatud"
            detail={
              endingWorker.done
                ? `Lõpetustöötlus tehtud (idempotentsusvõti: ${endingWorker.key ?? '—'})`
                : 'Lõpetustöötlus puudub — lõppaega ei ole kinnitatud'
            }
          />
          <ChecklistItem
            pass={pendingAlapakkumised === 0}
            label="Ootel alapakkumised"
            detail={
              pendingAlapakkumised === 0
                ? 'Puuduvad'
                : `Ootel: ${String(pendingAlapakkumised)} — otsusta alapakkumised enne avamist`
            }
          />
          <ChecklistItem
            pass={template.active}
            label="Aktiivne lepingu mall"
            detail={
              template.active
                ? `${template.name ?? 'Mall'} (${template.version ?? '—'})`
                : 'Aktiivset lepingu malli ei ole'
            }
            warning={
              template.active && template.changedWithin24h
                ? 'Malli on muudetud 24 tunni jooksul oksjoni alguse ümber — kontrolli versiooni enne allkirja.'
                : undefined
            }
          />
        </ul>
      </section>
      <LiveAuditStrip />
    </>
  )
}

const shortcutInitialState: SealedCeremonyActionState = {
  ok: false,
  phase: 'checklist',
  error: null,
}

/**
 * Empty-lot shortcut ("Märgi müümata"): an ended lot whose sealed bids hold
 * no valid entries can be declared unsold straight from the checklist,
 * without the two-signature ceremony. The server re-checks the empty state
 * and refuses any lot that still has a qualifying bid.
 */
export function CeremonyUnsoldShortcut({ auctionId }: { auctionId: string }) {
  const router = useRouter()
  const toast = useToast()
  const [state, formAction, pending] = useActionState(
    markSealedUnsoldShortcutAction,
    shortcutInitialState,
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (state.ok) {
      setDialogOpen(false)
      toast({ tone: 'success', title: 'Oksjon kuulutatud müümata. Otsus salvestatud auditilogisse.' })
      router.refresh()
    } else if (state.error !== null) {
      toast({
        tone: 'error',
        title: 'Müümata märkimine ebaõnnestus',
        description: state.error,
      })
    }
  }, [state, toast, router])

  return (
    <section className="rounded-card border border-border bg-bgPage p-md">
      <h2 className="mb-xs font-heading text-h4 font-bold text-ink">Müümata otsetee</h2>
      <p className="mb-sm text-bodySm text-inkMuted">
        Sellel oksjonil ei ole ühtki kehtivat pakkumist. Saad loti kohe müümata märkida ilma
        kahe allkirjaga tseremooniata; otsetee kehtib ainult tühja looti puhul.
      </p>
      <button
        type="button"
        className={secondaryButtonClass}
        disabled={pending}
        onClick={() => {
          setDialogOpen(true)
        }}
      >
        Märgi müümata
      </button>

      {dialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-md"
          role="dialog"
          aria-modal="true"
          aria-label="Märgi müümata"
        >
          <form
            action={formAction}
            className="w-full max-w-md rounded-card border border-border bg-bgPage p-md shadow-modal"
          >
            <input type="hidden" name="auctionId" value={auctionId} />
            <h3 className="font-heading text-h4 font-bold text-ink">Märgi müümata</h3>
            <p className="mt-sm rounded-input border-l-4 border-danger bg-dangerLight px-md py-sm text-bodySm font-semibold text-danger">
              HOIATUS: otsus on lõplik. Oksjon kuulutatakse müümata ja avamine jääb tegemata.
            </p>
            <FormTextareaField
              label="Põhjus"
              name="reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value)
              }}
              required
              minLength={5}
              rows={3}
              hint="Kohustuslik, vähemalt 5 tähemärki — läheb auditilogisse."
            />
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
                disabled={pending || reason.trim().length < 5}
                className="inline-flex h-10 items-center rounded-button bg-danger px-4 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending ? 'Kinnitan…' : 'Kinnita müümata'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  )
}
