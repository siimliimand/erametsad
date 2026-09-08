'use client'

import { useId, useRef, useState, useTransition } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'

import {
  trapTabKey,
  useBodyScrollLock,
  useDialogFocus,
  useEscapeKey,
} from '../../../_components/ui/useOverlay'

export interface DocumentPayload {
  ok: boolean
  html: string
  error: string | null
}

const defaultTriggerClass =
  'text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover'

interface HtmlPreviewDrawerProps {
  label: string
  drawerTitle: string
  documentId: string
  fetchDocument: (id: string) => Promise<DocumentPayload>
  triggerClassName?: string
}

/**
 * Inline document viewer (docs/design/admin/08 "Vaata PDF" / "Testrender"):
 * renders the server-rendered contract HTML in a sandboxed iframe drawer.
 * Scripts are fully sandboxed off; the preview is read-only.
 */
export function HtmlPreviewDrawer({
  label,
  drawerTitle,
  documentId,
  fetchDocument,
  triggerClassName = defaultTriggerClass,
}: HtmlPreviewDrawerProps) {
  const [open, setOpen] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  function closeDrawer(): void {
    setOpen(false)
  }

  function openDrawer(): void {
    setOpen(true)
    setHtml(null)
    setError(null)
    startTransition(async () => {
      const result = await fetchDocument(documentId)
      if (result.ok) {
        setHtml(result.html)
      } else {
        setError(result.error ?? 'Dokumendi laadimine ebaõnnestus.')
      }
    })
  }

  useEscapeKey(open, closeDrawer)
  useBodyScrollLock(open)
  useDialogFocus(open, panelRef)

  const handlePanelKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (panelRef.current) trapTabKey(event, panelRef.current)
  }

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className={triggerClassName}
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDrawer()
          }}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
            className="flex h-[85vh] w-full max-w-container-xl flex-col overflow-hidden rounded-card border border-border bg-bgPage shadow-modal"
          >
            <div className="flex items-center justify-between border-b border-border px-md py-sm">
              <h2 id={titleId} className="text-h4 font-semibold text-ink">{drawerTitle}</h2>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-button border border-border bg-bgPage px-3 py-1 text-label font-semibold text-ink transition-colors duration-hover ease-hover hover:border-primary hover:text-primary"
              >
                Sulge
              </button>
            </div>
            <div className="flex-1 overflow-hidden bg-bg-mist p-md">
              {pending ? <p className="text-bodySm text-ink-muted">Laadin dokumenti…</p> : null}
              {error ? <p className="text-bodySm font-semibold text-danger">{error}</p> : null}
              {html !== null && !pending ? (
                <iframe
                  title={drawerTitle}
                  sandbox=""
                  srcDoc={html}
                  className="h-full w-full rounded-input border border-border bg-white"
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
