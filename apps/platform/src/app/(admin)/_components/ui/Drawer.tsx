'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'

import { XIcon } from '../icons'
import { OverlayPortal } from './OverlayPortal'
import { trapTabKey, useBodyScrollLock, useDialogFocus, useEscapeKey } from './useOverlay'

// Demo scale is four widths (docs/design/demo/admin: 460 lead card, 560
// service request and CMS version, 680 audit detail, 720 user detail).
// Full width below 768px. Backdrop and panel use the drawer z pair so a
// Modal (150) can stack above an open Drawer (140).
export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl'

const sizeClass: Record<DrawerSize, string> = {
  sm: 'md:max-w-[460px]',
  md: 'md:max-w-[560px]',
  lg: 'md:max-w-[680px]',
  xl: 'md:max-w-[720px]',
}

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  size?: DrawerSize
  children: ReactNode
  footer?: ReactNode
}

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  size = 'md',
  children,
  footer,
}: DrawerProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Enter transition flips one frame after mount; close is an instant
  // unmount (the demo exits by visibility delay, skipped for baseline).
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    if (!open) {
      setEntered(false)
      return
    }
    const frame = requestAnimationFrame(() => {
      setEntered(true)
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [open])

  useEscapeKey(open, onClose)
  useBodyScrollLock(open)
  useDialogFocus(open, panelRef)

  if (!open) return null

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (panelRef.current) trapTabKey(event, panelRef.current)
  }

  return (
    <OverlayPortal>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-[var(--z-drawer-backdrop)] bg-[var(--overlay)] transition-opacity duration-dropdown ease-dropdown motion-reduce:transition-none ${entered ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handlePanelKeyDown}
        className={`fixed inset-y-0 right-0 z-[var(--z-drawer)] flex w-full flex-col border-l border-border bg-bgPage shadow-modal transition-transform duration-dropdown ease-dropdown motion-reduce:transition-none ${sizeClass[size]} ${entered ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="truncate font-heading text-h4 font-semibold text-ink">
              {title}
            </h2>
            {subtitle ? (
              <span className="mt-0.5 block truncate font-mono text-label text-inkMuted">
                {subtitle}
              </span>
            ) : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Sulge" className="grid h-9 w-9 shrink-0 place-items-center rounded-card text-inkMuted transition-colors duration-hover ease-hover hover:bg-bgMist hover:text-primary">
            <XIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 text-bodySm text-ink">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-border px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </OverlayPortal>
  )
}
