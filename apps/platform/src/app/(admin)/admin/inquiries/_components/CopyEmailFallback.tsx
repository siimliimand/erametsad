'use client'

import { useState } from 'react'

/**
 * Manual e-mail copy fallback (task 8.6): when no partner matches the
 * request, the operator copies the rendered e-mail text and sends it by
 * hand. Clipboard access can fail (permissions, plain HTTP), so the text
 * stays selectable in a read-only area as the last resort.
 */
export function CopyEmailFallback({ subject, body }: { subject: string; body: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState(false)

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${body}`)
      setCopied(true)
      setError(false)
    } catch {
      setCopied(false)
      setError(true)
    }
  }

  return (
    <div>
      <div className="mb-xs flex flex-wrap items-center gap-sm">
        <button
          type="button"
          onClick={() => {
            void copy()
          }}
          className="inline-flex h-10 items-center rounded-button border border-border bg-bgPage px-4 text-label font-semibold text-ink hover:border-primary hover:text-primary"
        >
          Kopeeri e-kirja tekst
        </button>
        {copied ? (
          <span role="status" className="text-bodySm font-semibold text-info">
            Kopeeritud — kleepige e-kiri partnerile.
          </span>
        ) : null}
        {error ? (
          <span role="alert" className="text-bodySm text-danger">
            Kopeerimine ebaõnnestus — valige tekst käsitsi allolevast kastist.
          </span>
        ) : null}
      </div>
      <textarea
        aria-label="E-kirja tekst"
        readOnly
        rows={8}
        value={`${subject}\n\n${body}`}
        className="w-full rounded-input border border-border bg-bg-mist px-3 py-2 font-mono text-bodySm text-ink outline-none focus:border-primary"
        onFocus={(event) => {
          event.currentTarget.select()
        }}
      />
    </div>
  )
}
