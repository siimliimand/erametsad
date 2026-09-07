'use client'

import { useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'

import { TriangleAlertIcon } from '../icons'
import { Modal } from './Modal'

// Reason guard is the demo decision modal (07-company-approvals reject:
// "Põhjus on kohustuslik (vähemalt 5 tähemärki)."); keyword guard is the
// maintenance modal (13-settings: trim + case-insensitive HOOLDUS match).
const DEFAULT_MIN_REASON_LENGTH = 5

interface ConfirmDialogBaseProps {
  open: boolean
  onClose: () => void
  title: string
  /** Body copy above the guard input. */
  description?: ReactNode
  /** Small print under the guard input. */
  note?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** Disables both footer buttons while the confirmed action runs. */
  busy?: boolean
}

export type ConfirmDialogProps = ConfirmDialogBaseProps &
  (
    | {
        variant: 'reason'
        reasonLabel: ReactNode
        reasonPlaceholder?: string
        minLength?: number
        onConfirm: (reason: string) => void
      }
    | {
        variant: 'keyword'
        keyword: string
        keywordLabel?: ReactNode
        onConfirm: () => void
      }
  )

function minReasonLength(props: ConfirmDialogProps): number {
  return props.variant === 'reason' ? (props.minLength ?? DEFAULT_MIN_REASON_LENGTH) : DEFAULT_MIN_REASON_LENGTH
}

function isConfirmReady(props: ConfirmDialogProps, reason: string, word: string): boolean {
  if (props.variant === 'reason') {
    return reason.trim().length >= minReasonLength(props)
  }
  return word.trim().toUpperCase() === props.keyword.trim().toUpperCase()
}

function buildConfirmHandler(props: ConfirmDialogProps, reason: string, word: string): () => void {
  return () => {
    if (!isConfirmReady(props, reason, word)) return
    if (props.variant === 'reason') {
      props.onConfirm(reason.trim())
      return
    }
    props.onConfirm()
  }
}

/**
 * Danger confirmation over the shared Modal primitive, in the two demo
 * guards: a required reason textarea (minimum length) and a typed keyword
 * the operator must match before the confirm button enables.
 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const { open, onClose, title, description, note, confirmLabel, cancelLabel = 'Tühista', busy } = props
  const [reason, setReason] = useState('')
  const [word, setWord] = useState('')
  const inputId = useId()
  const errorId = useId()

  // Fresh guard state on every open, like the demo modals reset their inputs.
  useEffect(() => {
    if (open) {
      setReason('')
      setWord('')
    }
  }, [open])

  const ready = isConfirmReady(props, reason, word)

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      tone="danger"
      icon={<TriangleAlertIcon className="h-[18px] w-[18px]" />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="inline-flex items-center rounded-button px-3.5 py-2 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:bg-bgMist disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={buildConfirmHandler(props, reason, word)}
            disabled={!ready || busy}
            className="inline-flex items-center rounded-button bg-danger px-3.5 py-2 text-label font-semibold text-inkInverse transition-[filter] duration-hover ease-hover hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {description ? <p className="text-bodySm text-ink">{description}</p> : null}
      {props.variant === 'reason' ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-label font-semibold text-ink">
            {props.reasonLabel}
          </label>
          <textarea
            id={inputId}
            rows={4}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value)
            }}
            placeholder={props.reasonPlaceholder}
            aria-invalid={!ready && reason.trim().length > 0}
            aria-describedby={!ready && reason.trim().length > 0 ? errorId : undefined}
            className="w-full resize-y rounded-input border border-border bg-bgPage px-3 py-2 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          {!ready && reason.trim().length > 0 ? (
            <p id={errorId} className="text-label text-danger">
              Põhjus on kohustuslik (vähemalt {minReasonLength(props)} tähemärki).
            </p>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label htmlFor={inputId} className="text-label font-semibold text-ink">
            {props.keywordLabel ?? `Trüki kinnitussõna: ${props.keyword}`}
          </label>
          <input
            id={inputId}
            type="text"
            value={word}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setWord(event.target.value)
            }}
            className="h-10 w-full rounded-input border border-border bg-bgPage px-3 text-bodySm text-ink outline-none transition-colors duration-hover ease-hover focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      )}
      {note ? <p className="text-label text-inkMuted">{note}</p> : null}
    </Modal>
  )
}
