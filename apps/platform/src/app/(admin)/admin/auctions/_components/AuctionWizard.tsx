'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'

import { visibleWizardSteps, wizardSteps } from './steps'
import {
  buildAuctionPayload,
  stepForField,
  validateWizardForSubmit,
} from './wizard-model'
import type {
  AuctionWizardInitial,
  AuctionWizardOptions,
  AuctionWizardState,
} from './wizard-model'
import {
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { StatusChip } from '../../../_components/StatusChip'

import type { AuctionStatus } from '@/lib/data/schema'

/**
 * Editor bar autosave state (03-auction-editor bar). Idle until the draft
 * persistence task (5.3) starts driving it.
 */
export type AutosaveState = 'idle' | 'saving' | 'saved'

/**
 * Client shell for the lot editor wizard (docs/design/admin/03). One schema,
 * one state: every step edits the same AuctionWizardState and the form posts
 * the whole payload on save, so partial saves never lose data. Buttons with
 * `data-skip-validation` (alias regenerate) bypass the gate; the publish
 * button and the plain submit both run it.
 */
export function AuctionWizard({
  action,
  submitLabel,
  cancelHref,
  options,
  initial,
  status,
  autosaveState = 'idle',
  autosavedAt = null,
}: {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  cancelHref: string
  options: AuctionWizardOptions
  initial: AuctionWizardInitial
  /** Stored lifecycle status for the bar pill; draft is implied for new lots. */
  status?: AuctionStatus | null
  /** Editor bar seam for the draft-autosave task (5.3) to drive. */
  autosaveState?: AutosaveState
  /** Display-ready save time for the saved state; null hides the mono time. */
  autosavedAt?: string | null
}) {
  const [state, setState] = useState<AuctionWizardState>(initial.state)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)

  // Remounting the save dot on each entry into `saved` replays the one-shot
  // save-ping keyframe; a stable class alone would animate only once.
  const prevAutosaveRef = useRef<AutosaveState>(autosaveState)
  const [savePingKey, setSavePingKey] = useState(0)
  useEffect(() => {
    if (autosaveState === 'saved' && prevAutosaveRef.current !== 'saved') {
      setSavePingKey((n) => n + 1)
    }
    prevAutosaveRef.current = autosaveState
  }, [autosaveState])

  const visible = visibleWizardSteps(state.objectType)

  const patch = useCallback(
    (partial: Partial<AuctionWizardState>) => {
      const next = { ...state, ...partial }
      setState(next)
      if (showErrors) {
        setErrors(validateWizardForSubmit(initial, next, options))
      }
    },
    [state, initial, options, showErrors],
  )

  const payloadJson = useMemo(
    () => JSON.stringify(buildAuctionPayload(initial, state, options)),
    [initial, state, options],
  )

  // The Pakett step disappears for non-package lots; keep the index in range
  // while the canonical numbering stays stable for validation jumps.
  const effectiveIndex = Math.min(stepIndex, visible.length - 1)
  const step = visible[effectiveIndex]
  if (step === undefined) return null
  const canonicalStepNumber =
    wizardSteps.findIndex((entry) => entry.id === step.id) + 1

  function firstStepWithIssues(found: Record<string, string>): number | null {
    let lowest: number | null = null
    for (const field of Object.keys(found)) {
      const stepNumber = stepForField(field)
      if (stepNumber === null) continue
      if (lowest === null || stepNumber < lowest) lowest = stepNumber
    }
    if (lowest === null) return null
    const target = visible.findIndex(
      (entry) => wizardSteps.findIndex((candidate) => candidate.id === entry.id) + 1 === lowest,
    )
    return target >= 0 ? target : null
  }

  function issueCountForStep(stepNumber: number): number {
    return Object.keys(errors).filter((field) => stepForField(field) === stepNumber).length
  }

  function goToStep(canonical: number): void {
    const target = visible.findIndex(
      (entry) => wizardSteps.findIndex((candidate) => candidate.id === entry.id) + 1 === canonical,
    )
    if (target >= 0) setStepIndex(target)
  }

  function shouldSkipValidation(event: SyntheticEvent<HTMLFormElement>): boolean {
    const nativeEvent = event.nativeEvent
    if (!(nativeEvent instanceof SubmitEvent)) return false
    const submitter = nativeEvent.submitter
    return submitter instanceof HTMLButtonElement && submitter.dataset.skipValidation === 'true'
  }

  const context = { state, patch, errors, initial, options, goToStep }

  const editorTitle = state.title.trim()
  const chipStatus: AuctionStatus | null =
    status ?? (initial.auctionId === null ? 'draft' : null)
  const autosaveLabel =
    autosaveState === 'saved'
      ? 'Salvestatud'
      : autosaveState === 'saving'
        ? 'Salvestan…'
        : 'Pole veel salvestatud'

  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (shouldSkipValidation(event)) return
        const found = validateWizardForSubmit(initial, state, options)
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

      <header className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-card border border-border bg-bgPage px-5 py-3.5 shadow-card">
        <h2 className="m-0 font-heading text-[18px] font-semibold leading-6 text-ink">
          {initial.auctionId !== null ? (
            <>
              {'Oksjon '}
              <span className="font-mono text-[16px] text-inkMuted">
                {`#${initial.auctionId}`}
              </span>
              {editorTitle !== '' ? ` · ${editorTitle}` : ''}
            </>
          ) : editorTitle !== '' ? (
            editorTitle
          ) : (
            'Uus oksjon'
          )}
        </h2>
        {chipStatus !== null ? <StatusChip status={chipStatus} /> : null}
        <span
          role="status"
          className="inline-flex items-center gap-1.5 text-label font-medium text-inkMuted"
        >
          <span
            key={savePingKey}
            aria-hidden="true"
            className={`h-2 w-2 rounded-pill ${
              autosaveState === 'saved'
                ? 'animate-[save-ping_0.6s_ease-out] bg-statusActive'
                : autosaveState === 'saving'
                  ? 'bg-[var(--st-ended-dot)]'
                  : 'bg-[var(--st-draft-dot)]'
            }`}
          />
          {autosaveLabel}
          {autosaveState === 'saved' && autosavedAt !== null && autosavedAt !== '' ? (
            <span className="font-mono">{autosavedAt}</span>
          ) : null}
        </span>
        <span aria-hidden="true" className="min-w-0 flex-1" />
        {initial.guestPreviewHref !== null ? (
          <a
            href={initial.guestPreviewHref}
            target="_blank"
            rel="noopener"
            className={secondaryButtonClass}
          >
            {'Eelvaade ↗'}
            <span className="sr-only">(avaneb uuel vahelehel)</span>
          </a>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[240px_1fr]">
        <nav aria-label="Sammud">
          <ol className="flex flex-row flex-wrap gap-xs lg:flex-col">
            {visible.map((entry) => {
              const canonical = wizardSteps.findIndex((candidate) => candidate.id === entry.id) + 1
              const issueCount = issueCountForStep(canonical)
              const current = entry.id === step.id
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    aria-current={current ? 'step' : undefined}
                    onClick={() => {
                      setStepIndex(visible.indexOf(entry))
                    }}
                    className={`flex w-full items-center justify-between gap-xs rounded-input border px-sm py-xs text-label font-semibold transition-colors duration-hover ease-hover ${
                      current
                        ? 'border-primary bg-primaryLight text-ink'
                        : 'border-border bg-bgPage text-inkMuted hover:border-primary hover:text-ink'
                    }`}
                  >
                    <span>
                      {String(canonical)}. {entry.label}
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
            Samm {String(canonicalStepNumber)} / {String(wizardSteps.length)} — {step.label}
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
