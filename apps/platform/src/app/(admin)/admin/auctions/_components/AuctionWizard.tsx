'use client'

import { useCallback, useMemo, useState } from 'react'

import { wizardSteps } from './steps'
import {
  buildAuctionPayload,
  stepForField,
  validateAuctionDraft,
} from './wizard-model'
import type {
  AuctionWizardInitial,
  AuctionWizardOptions,
  AuctionWizardState,
} from './wizard-model'
import {
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'

/**
 * Client shell for the lot editor wizard (docs/design/admin/03). One schema,
 * one state: every step edits the same AuctionWizardState and the form posts
 * the whole payload on save, so partial saves never lose data. Steps 5-7 stay
 * registered in steps.tsx as placeholders until task 2.5 replaces them.
 */
export function AuctionWizard({
  action,
  submitLabel,
  cancelHref,
  options,
  initial,
}: {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  cancelHref: string
  options: AuctionWizardOptions
  initial: AuctionWizardInitial
}) {
  const [state, setState] = useState<AuctionWizardState>(initial.state)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)

  const patch = useCallback(
    (partial: Partial<AuctionWizardState>) => {
      const next = { ...state, ...partial }
      setState(next)
      if (showErrors) {
        setErrors(validateAuctionDraft(initial, next, options))
      }
    },
    [state, initial, options, showErrors],
  )

  const payloadJson = useMemo(
    () => JSON.stringify(buildAuctionPayload(initial, state, options)),
    [initial, state, options],
  )

  const step = wizardSteps[stepIndex] ?? wizardSteps[0]
  if (step === undefined) return null

  function firstStepWithIssues(found: Record<string, string>): number | null {
    let lowest: number | null = null
    for (const field of Object.keys(found)) {
      const stepNumber = stepForField(field)
      if (stepNumber === null) continue
      if (lowest === null || stepNumber < lowest) lowest = stepNumber
    }
    return lowest === null ? null : lowest - 1
  }

  function issueCountForStep(stepNumber: number): number {
    return Object.keys(errors).filter((field) => stepForField(field) === stepNumber).length
  }

  const context = { state, patch, errors, initial, options }

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const found = validateAuctionDraft(initial, state, options)
        if (Object.keys(found).length === 0) return
        event.preventDefault()
        setErrors(found)
        setShowErrors(true)
        const target = firstStepWithIssues(found)
        if (target !== null) setStepIndex(target)
      }}
      className="flex max-w-container-xl flex-col gap-md"
    >
      {initial.auctionId !== null ? (
        <input type="hidden" name="id" value={initial.auctionId} />
      ) : null}
      <input type="hidden" name="payload" value={payloadJson} />

      <div className="rounded-card border border-border bg-bgPage p-md">
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="wizard-title" className="text-label font-semibold text-ink">
              Pealkiri<span className="text-danger"> *</span>
            </label>
            <input
              id="wizard-title"
              value={state.title}
              onChange={(event) => {
                patch({ title: event.target.value })
              }}
              className={`${inputClass} ${errors.title !== undefined ? 'border-danger' : ''}`}
            />
            {errors.title !== undefined ? (
              <p role="alert" className="text-bodySm font-medium text-danger">
                {errors.title}
              </p>
            ) : null}
          </div>
          {initial.auctionId === null ? (
            <div className="flex flex-col gap-1">
              <label htmlFor="wizard-slug" className="text-label font-semibold text-ink">
                URL-nimi
              </label>
              <input
                id="wizard-slug"
                value={state.slug}
                placeholder="harju-maa-raieoigus-2026"
                onChange={(event) => {
                  patch({ slug: event.target.value })
                }}
                className={`${inputClass} ${errors.slug !== undefined ? 'border-danger' : ''}`}
              />
              <p className="text-bodySm text-inkMuted">
                Valikuline — tühjana tekib pealkirjast.
              </p>
              {errors.slug !== undefined ? (
                <p role="alert" className="text-bodySm font-medium text-danger">
                  {errors.slug}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[240px_1fr]">
        <nav aria-label="Sammud">
          <ol className="flex flex-row flex-wrap gap-xs lg:flex-col">
            {wizardSteps.map((entry, index) => {
              const issueCount = issueCountForStep(index + 1)
              const current = index === stepIndex
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-current={current ? 'step' : undefined}
                    onClick={() => {
                      setStepIndex(index)
                    }}
                    className={`flex w-full items-center justify-between gap-xs rounded-input border px-sm py-xs text-label font-semibold transition-colors duration-hover ease-hover ${
                      current
                        ? 'border-primary bg-primaryLight text-ink'
                        : 'border-border bg-bgPage text-inkMuted hover:border-primary hover:text-ink'
                    }`}
                  >
                    <span>
                      {String(index + 1)}. {entry.label}
                    </span>
                    {issueCount > 0 ? (
                      <span className="rounded-pill bg-dangerLight px-2 text-bodySm text-danger">
                        {String(issueCount)}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        <section className="rounded-card border border-border bg-bgPage p-md">
          <h2 className="text-h4 font-bold text-ink">
            Samm {String(stepIndex + 1)} / {String(wizardSteps.length)} — {step.label}
          </h2>
          <div className="mt-sm">
            {step.render(context)}
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <button type="submit" className={primaryButtonClass}>
          {submitLabel}
        </button>
        <a href={cancelHref} className={secondaryButtonClass}>
          Tühista
        </a>
        {showErrors && Object.keys(errors).length > 0 ? (
          <span role="alert" className="text-bodySm font-medium text-danger">
            Paranda esitatud andmed enne salvestamist.
          </span>
        ) : null}
      </div>
    </form>
  )
}
