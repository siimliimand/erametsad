'use client'

import { useEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, RefObject } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

// offsetParent is null for elements hidden by display:none; children of a
// position:fixed dialog report the dialog itself, so the check holds there.
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null,
  )
}

// Counted lock: a Drawer can host a confirmation Modal, so the body scroll
// lock must only lift when the last overlay closes.
let scrollLockCount = 0
let scrollLockPreviousOverflow = ''

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active) return
    if (scrollLockCount === 0) {
      scrollLockPreviousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    }
    scrollLockCount += 1
    return () => {
      scrollLockCount -= 1
      if (scrollLockCount === 0) {
        document.body.style.overflow = scrollLockPreviousOverflow
      }
    }
  }, [active])
}

// Escape closes only the topmost overlay (a Drawer can host a confirmation
// Modal), so open overlays register on a stack instead of each listening on
// their own document handler.
const escapeStack: (() => void)[] = []

function handleEscape(event: KeyboardEvent): void {
  if (event.key !== 'Escape') return
  const close = escapeStack[escapeStack.length - 1]
  if (!close) return
  event.stopPropagation()
  close()
}

export function useEscapeKey(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])
  useEffect(() => {
    if (!open) return
    const entry = () => {
      onCloseRef.current()
    }
    escapeStack.push(entry)
    if (escapeStack.length === 1) {
      document.addEventListener('keydown', handleEscape)
    }
    return () => {
      const index = escapeStack.indexOf(entry)
      if (index !== -1) escapeStack.splice(index, 1)
      if (escapeStack.length === 0) {
        document.removeEventListener('keydown', handleEscape)
      }
    }
  }, [open])
}

// Moves focus into the dialog on open and restores it to the trigger on
// close; the restore runs in the cleanup so unmount is covered too.
// The panel mounts one commit after open flips (OverlayPortal), so the
// first run can see a null panel — retry on the next frame until it exists.
export function useDialogFocus(open: boolean, panelRef: RefObject<HTMLElement | null>): void {
  const restoreRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    restoreRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const schedule =
      typeof requestAnimationFrame === 'function'
        ? (fn: () => void) => requestAnimationFrame(fn)
        : (fn: () => void) => setTimeout(fn, 0) as unknown as number
    const cancel =
      typeof cancelAnimationFrame === 'function'
        ? (id: number) => {
            cancelAnimationFrame(id)
          }
        : (id: number) => {
            clearTimeout(id)
          }
    let timer = 0
    const focusPanel = () => {
      const panel = panelRef.current
      if (!panel) {
        timer = schedule(focusPanel)
        return
      }
      const target = getFocusableElements(panel)[0] ?? panel
      target.focus()
    }
    focusPanel()
    return () => {
      cancel(timer)
      restoreRef.current?.focus()
      restoreRef.current = null
    }
  }, [open, panelRef])
}

export function trapTabKey(event: ReactKeyboardEvent<HTMLElement>, panel: HTMLElement): void {
  if (event.key !== 'Tab') return
  const focusable = getFocusableElements(panel)
  // No focusable content: keep focus parked on the dialog panel itself.
  const first = focusable[0]
  if (first === undefined) {
    event.preventDefault()
    panel.focus()
    return
  }
  const last = focusable[focusable.length - 1] ?? first
  if (event.shiftKey) {
    if (document.activeElement === first || document.activeElement === panel) {
      event.preventDefault()
      last.focus()
    }
    return
  }
  if (document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}
