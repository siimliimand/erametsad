'use client'

import { useId, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

import { XIcon } from '../icons'
import { OverlayPortal } from './OverlayPortal'
import { trapTabKey, useBodyScrollLock, useDialogFocus, useEscapeKey } from './useOverlay'

// Demo scale is two widths (docs/design/demo/admin: 480px confirm modals,
// 720px contract preview). Backdrop and dialog share --z-modal.
export type ModalSize = 'sm' | 'lg'

const sizeClass: Record<ModalSize, string> = {
  sm: 'max-w-[480px]',
  lg: 'max-w-[720px]',
}

const iconToneClass = {
  danger: 'bg-dangerLight text-danger',
  warning: 'bg-[var(--st-ended-bg)] text-[var(--st-ended-text)]',
  info: 'bg-infoLight text-info',
} as const

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  size?: ModalSize
  tone?: keyof typeof iconToneClass
  icon?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function Modal({
  open,
  onClose,
  title,
  size = 'sm',
  tone,
  icon,
  children,
  footer,
}: ModalProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEscapeKey(open, onClose)
  useBodyScrollLock(open)
  useDialogFocus(open, panelRef)

  if (!open) return null

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (panelRef.current) trapTabKey(event, panelRef.current)
  }

  return (
    <OverlayPortal>
      {/* Backdrop: click-to-close guard checks the target so clicks inside the
          dialog that bubble up do not close it. */}
      <div
        className="fixed inset-0 z-[var(--z-modal)] grid place-items-center bg-[var(--overlay)] p-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose()
        }}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          tabIndex={-1}
          onKeyDown={handlePanelKeyDown}
          className={`animate-[modal-in_0.18s_ease-out] flex max-h-[calc(100vh-32px)] w-full flex-col overflow-hidden rounded-card border border-border bg-bgPage shadow-modal ${sizeClass[size]}`}
        >
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            {icon ? (
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-card [&>svg]:h-[18px] [&>svg]:w-[18px] ${tone ? iconToneClass[tone] : 'bg-bgMist text-primary'}`}
              >
                {icon}
              </span>
            ) : null}
            <h2 id={titleId} className="flex-1 font-heading text-h4 font-semibold text-ink">
              {title}
            </h2>
            <button type="button" onClick={onClose} aria-label="Sulge" className="grid h-9 w-9 shrink-0 place-items-center rounded-card text-inkMuted transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-primary">
              <XIcon className="h-[18px] w-[18px]" />
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4 text-bodySm text-ink">
            {children}
          </div>
          {footer ? (
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </OverlayPortal>
  )
}
