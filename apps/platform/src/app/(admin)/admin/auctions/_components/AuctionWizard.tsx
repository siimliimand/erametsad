'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'

import { visibleWizardSteps, wizardSteps } from './steps'
import {
  buildAuctionPayload,
  parseWizardDraft,
  serializeWizardDraft,
  serializeWizardState,
  stepForField,
  validateWizardForSubmit,
  wizardDefectLabel,
  wizardDraftDiffers,
  wizardDraftKey,
  wizardRailSteps,
} from './wizard-model'
import type {
  AuctionWizardInitial,
  AuctionWizardOptions,
  AuctionWizardState,
  WizardDraft,
} from './wizard-model'
import {
  primaryButtonClass,
  secondaryButtonClass,
} from '../../../_components/FormField'
import { StatusChip } from '../../../_components/StatusChip'
import { FileTextIcon } from '../../../_components/icons'
import { Modal } from '../../../_components/ui/Modal'
import { utcIsoToTallinnInputValue } from '../../content/_components/scheduled-publish'

import type { AuctionStatus } from '@/lib/data/schema'

/**
 * Editor bar autosave state (03-auction-editor bar): idle before the first
 * edit, saving while the debounced draft write is pending, saved once the
 * draft has landed in localStorage.
 */
export type AutosaveState = 'idle' | 'saving' | 'saved'

const AUTOSAVE_DEBOUNCE_MS = 800

/** Display-ready HH:mm (Tallinn wall time) for autosave and restore labels. */
function tallinnClock(iso: string): string {
  return utcIsoToTallinnInputValue(iso).slice(11, 16)
}

/** One rail row: canonical number, label, status mark, screen-reader note. */
function RailRow({
  number,
  label,
  mark,
  markColor,
  note,
}: {
  number: number
  label: string
  mark: string
  markColor: string
  note: string
}) {
  return (
    <>
      <span className="w-[14px] flex-none font-mono text-[12px] font-medium">
        {String(number)}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
      <span
        aria-hidden="true"
        className={`w-[18px] flex-none text-center text-[13px] font-bold ${markColor}`}
      >
        {mark}
      </span>
      <span className="sr-only">{note}</span>
    </>
  )
}

/**
 * Client shell for the lot editor wizard (docs/design/admin/03). One schema,
 * one state: every step edits the same AuctionWizardState and the form posts
 * the whole payload on save, so partial saves never lose data. Buttons with
 * `data-skip-validation` (alias regenerate) bypass the gate; the publish
 * button and the plain submit both run it. The editable state autosaves to
 * localStorage as a draft (restore prompt on return, unload guard while
 * dirty); the form submit stays the only durable save.
 */
export function AuctionWizard({
  action,
  submitLabel,
  cancelHref,
  options,
  initial,
  status,
}: {
  action: (formData: FormData) => void | Promise<void>
  submitLabel: string
  cancelHref: string
  options: AuctionWizardOptions
  initial: AuctionWizardInitial
  /** Stored lifecycle status for the bar pill; draft is implied for new lots. */
  status?: AuctionStatus | null
}) {
  const [state, setState] = useState<AuctionWizardState>(initial.state)
  const [stepIndex, setStepIndex] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showErrors, setShowErrors] = useState(false)

  // Draft autosave (task 5.3): the editor bar's seam is driven from real
  // localStorage activity. lastPersisted holds the snapshot the storage
  // already reflects; null until the mount-time restore check has run, which
  // keeps autosave suspended so the wizard never writes on first render.
  const [autosaveState, setAutosaveState] = useState<AutosaveState>('idle')
  const [autosavedAt, setAutosavedAt] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [pendingDraft, setPendingDraft] = useState<WizardDraft | null>(null)
  const lastPersistedRef = useRef<string | null>(null)
  const submittedRef = useRef(false)

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

  const draftKey = useMemo(() => wizardDraftKey(initial.auctionId), [initial.auctionId])
  const stateSnapshot = useMemo(() => serializeWizardState(state), [state])

  // Mount-time restore: a stored draft that differs from the server state
  // opens the prompt; an equal one becomes the baseline so the wizard does
  // not rewrite what is already stored.
  useEffect(() => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(draftKey)
    } catch {
      stored = null
    }
    const draft = stored === null ? null : parseWizardDraft(stored)
    if (draft !== null && wizardDraftDiffers(draft.state, initial.state)) {
      setPendingDraft(draft)
      return
    }
    lastPersistedRef.current =
      draft !== null ? serializeWizardState(draft.state) : serializeWizardState(initial.state)
  }, [draftKey, initial.state])

  // Debounced draft write: 'saving' shows while the timer runs, 'saved' once
  // the state has landed in localStorage. Suspended while the restore prompt
  // is open so the offered draft cannot be overwritten from behind the modal.
  useEffect(() => {
    if (pendingDraft !== null || lastPersistedRef.current === null) return
    if (stateSnapshot === lastPersistedRef.current) {
      setIsDirty(false)
      return
    }
    setIsDirty(true)
    setAutosaveState('saving')
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, serializeWizardDraft(state, new Date()))
        lastPersistedRef.current = stateSnapshot
        setIsDirty(false)
        setAutosaveState('saved')
        const clock = tallinnClock(new Date().toISOString())
        setAutosavedAt(clock === '' ? null : clock)
      } catch {
        setAutosaveState('idle')
      }
    }, AUTOSAVE_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
    }
  }, [draftKey, pendingDraft, state, stateSnapshot])

  // Unload guard only while the draft is dirty; a submit clears the flag
  // first, so the durable save never triggers the browser dialog.
  useEffect(() => {
    if (!isDirty) return
    const guard = (event: BeforeUnloadEvent) => {
      if (submittedRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', guard)
    return () => {
      window.removeEventListener('beforeunload', guard)
    }
  }, [isDirty])

  const visible = useMemo(() => visibleWizardSteps(state.objectType), [state.objectType])
  const hiddenStepIds = useMemo(
    () => wizardSteps.filter((entry) => !visible.includes(entry)).map((entry) => entry.id),
    [visible],
  )

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
  const canonicalStepNumber =
    wizardSteps.findIndex((entry) => entry.id === (step?.id ?? '')) + 1

  const rail = useMemo(
    () =>
      wizardRailSteps(wizardSteps, hiddenStepIds, initial, state, options, canonicalStepNumber),
    [hiddenStepIds, initial, options, state, canonicalStepNumber],
  )
  const defectTotal = rail.reduce((total, entry) => total + entry.defects, 0)

  // All hooks stay above this guard; the visible list is never empty, so the
  // guard is defensive only.
  if (step === undefined) return null

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

  // A submit that passes the gate posts the whole payload, so the local draft
  // has served its purpose: drop it and disarm the unload guard. A failed
  // validation never gets here — the draft stays for the retry.
  function clearDraft(): void {
    try {
      window.localStorage.removeItem(draftKey)
    } catch {
      // Storage unavailable: nothing stored to clear.
    }
    lastPersistedRef.current = serializeWizardState(state)
    setIsDirty(false)
    setAutosaveState('idle')
    setAutosavedAt(null)
  }

  function restoreDraft(): void {
    if (pendingDraft !== null) {
      lastPersistedRef.current = serializeWizardState(initial.state)
      setState({ ...pendingDraft.state, reserveEditing: false })
    }
    setPendingDraft(null)
  }

  function discardDraft(): void {
    try {
      window.localStorage.removeItem(draftKey)
    } catch {
      // Storage unavailable: nothing stored to clear.
    }
    lastPersistedRef.current = serializeWizardState(state)
    setPendingDraft(null)
  }

  // Closed without a choice: leave the stored draft alone and treat the
  // current form as the baseline; the next edit overwrites the draft.
  function keepDraftForLater(): void {
    lastPersistedRef.current = stateSnapshot
    setPendingDraft(null)
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
        if (shouldSkipValidation(event)) {
          submittedRef.current = true
          clearDraft()
          return
        }
        const found = validateWizardForSubmit(initial, state, options)
        if (Object.keys(found).length > 0) {
          event.preventDefault()
          setErrors(found)
          setShowErrors(true)
          const target = firstStepWithIssues(found)
          if (target !== null) setStepIndex(target)
          return
        }
        submittedRef.current = true
        clearDraft()
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
                ? 'animate-[save-ping_0.6s_ease-out] motion-reduce:animate-none bg-statusActive'
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
        <nav aria-label="Koostamise sammud" className="flex flex-col">
          <ol className="flex flex-row flex-wrap gap-xs lg:flex-col">
            {rail.map((entry) => {
              const hidden = entry.mark === 'disabled'
              const current = entry.mark === 'current'
              const note =
                entry.mark === 'done'
                  ? '(täidetud)'
                  : current
                    ? '(aktiivne)'
                    : entry.mark === 'todo'
                      ? '(täitmata)'
                      : '(puudub)'
              const mark =
                entry.mark === 'done' ? '✓' : current ? '●' : entry.mark === 'todo' ? '○' : '—'
              const markColor =
                entry.mark === 'done'
                  ? 'text-[var(--st-active-dot)]'
                  : current
                    ? 'text-primary'
                    : entry.mark === 'todo'
                      ? 'text-[var(--st-draft-dot)]'
                      : 'text-inkMuted'
              const rowClass = `flex w-full items-center gap-xs rounded-input px-sm py-xs text-label transition-colors duration-hover ease-hover ${
                current
                  ? 'bg-primaryLight font-semibold text-primary'
                  : hidden
                    ? 'text-inkMuted opacity-50'
                    : 'text-inkMuted hover:bg-bgMist hover:text-ink'
              }`
              return (
                <li key={entry.id}>
                  {hidden ? (
                    <span aria-disabled="true" className={rowClass}>
                      <RailRow number={entry.step} label={entry.label} mark={mark} markColor={markColor} note={note} />
                    </span>
                  ) : (
                    <button
                      type="button"
                      aria-current={current ? 'step' : undefined}
                      onClick={() => {
                        setStepIndex(visible.findIndex((candidate) => candidate.id === entry.id))
                      }}
                      className={rowClass}
                    >
                      <RailRow number={entry.step} label={entry.label} mark={mark} markColor={markColor} note={note} />
                    </button>
                  )}
                </li>
              )
            })}
          </ol>
          {defectTotal > 0 ? (
            <p className="mt-2 border-t border-border pt-2 text-[12px] font-medium text-[var(--st-ended-text)]">
              <span aria-hidden="true">⚠ </span>
              {wizardDefectLabel(defectTotal)}
            </p>
          ) : null}
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

      <Modal
        open={pendingDraft !== null}
        onClose={keepDraftForLater}
        title="Taasta mustand?"
        tone="info"
        icon={<FileTextIcon className="h-[18px] w-[18px]" />}
        footer={
          <>
            <button type="button" onClick={discardDraft} className={secondaryButtonClass}>
              Kustuta mustand
            </button>
            <button type="button" onClick={restoreDraft} className={primaryButtonClass}>
              Taasta
            </button>
          </>
        }
      >
        <p>
          {pendingDraft !== null
            ? `Kell ${tallinnClock(pendingDraft.savedAt)} salvestatud mustand erineb praegusest vormist.`
            : ''}
        </p>
        <p className="text-label text-inkMuted">
          Taastamine asendab vormi andmed mustandiga. Serverisse salvestab ikka nupp Salvesta.
        </p>
      </Modal>
    </form>
  )
}
