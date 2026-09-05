'use client'

import { useState, useTransition } from 'react'

export interface DocumentPayload {
  ok: boolean
  html: string
  error: string | null
}

interface HtmlPreviewDrawerProps {
  label: string
  drawerTitle: string
  documentId: string
  fetchDocument: (id: string) => Promise<DocumentPayload>
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
}: HtmlPreviewDrawerProps) {
  const [open, setOpen] = useState(false)
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

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

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover"
      >
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-md"
          role="dialog"
          aria-modal="true"
          aria-label={drawerTitle}
        >
          <div className="flex h-[85vh] w-full max-w-container-xl flex-col overflow-hidden rounded-card border border-border bg-bgPage shadow-modal">
            <div className="flex items-center justify-between border-b border-border px-md py-sm">
              <h2 className="text-h4 font-semibold text-ink">{drawerTitle}</h2>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                }}
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
