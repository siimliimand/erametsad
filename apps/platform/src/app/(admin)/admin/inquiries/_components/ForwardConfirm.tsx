'use client'

import { useId, useState } from 'react'
import type { FormEvent } from 'react'

import { useEscapeKey } from '../../../_components/ui/useOverlay'

export interface ForwardConfirmRecipient {
  id: string
  name: string
  email: string | null
  atCapacity: boolean
}

/**
 * Routing confirm modal (task 8.5): intercepts the send button, lists the
 * selected recipients with their e-mails, and soft-warns when a selected
 * partner's capacity is full. Sending needs the explicit Kinnita click.
 */
export function ForwardConfirm({
  recipients,
}: {
  recipients: readonly ForwardConfirmRecipient[]
}) {
  const [pending, setPending] = useState<ForwardConfirmRecipient[] | null>(null)
  const headingId = useId()

  useEscapeKey(pending !== null, () => {
    setPending(null)
  })

  function openConfirm(event: FormEvent<HTMLButtonElement>): void {
    const form = event.currentTarget.form
    if (!form) return
    const selected = new Set(
      Array.from(form.querySelectorAll<HTMLInputElement>('input[name="partnerIds"]:checked')).map(
        (input) => input.value,
      ),
    )
    setPending(recipients.filter((recipient) => selected.has(recipient.id)))
  }

  const capacityFull = pending?.some((recipient) => recipient.atCapacity) ?? false

  return (
    <div>
      <button
        type="button"
        className="bg-primary"
        onClick={openConfirm}
      >
        Saada valitud partneritele
      </button>
      {pending ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={headingId}
          data-testid="forward-confirm"
          className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-container-sm rounded-card border border-border bg-bgPage p-md shadow-lg"
        >
          <h4 id={headingId} className="mb-xs font-heading text-h4 font-bold text-ink">
            Kinnita saatmine
          </h4>
          <p className="mb-xs text-bodySm text-ink-muted">
            Päring suunatakse {String(pending.length)} partnerile:
          </p>
          <ul className="mb-xs space-y-1 text-bodySm text-ink">
            {pending.map((recipient) => (
              <li key={recipient.id}>
                <span className="font-semibold">{recipient.name}</span>
                <span className="text-ink-muted">
                  {recipient.email ? ` · ${recipient.email}` : ' · e-post puudub'}
                </span>
              </li>
            ))}
          </ul>
          {capacityFull ? (
            <p className="mb-xs rounded-input border border-danger bg-danger-light px-3 py-2 text-bodySm font-semibold text-danger">
              Hoiatus: vähemalt ühe valitud partneri maht on täidetud. Kinnitage saatmine teadlikult.
            </p>
          ) : null}
          <div className="mt-xs flex items-center gap-sm">
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-button bg-primary px-4 text-label font-semibold text-ink-inverse hover:bg-primaryHover"
              onClick={(event) => {
                const form = event.currentTarget.closest('form')
                setPending(null)
                // The modal renders inside the server-action form, so a
                // real submit posts the checked partnerIds to the action.
                form?.requestSubmit()
              }}
            >
              Kinnita saatmine
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink hover:border-primary hover:text-primary"
              onClick={() => {
                setPending(null)
              }}
            >
              Tühista
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
