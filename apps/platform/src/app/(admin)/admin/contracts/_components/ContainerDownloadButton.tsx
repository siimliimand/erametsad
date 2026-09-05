'use client'

import { useState, useTransition } from 'react'

export interface ContainerPayload {
  ok: boolean
  filename: string
  content: string
  mimeType: string
  error: string | null
}

interface ContainerDownloadButtonProps {
  label: string
  contractId: string
  fetchContainer: (id: string) => Promise<ContainerPayload>
}

/**
 * "Laadi allkirjakonteiner" (docs/design/admin/08): the server action audits
 * `contract.download_container` before the bytes are handed over; this button
 * only turns the returned document into a browser download.
 */
export function ContainerDownloadButton({
  label,
  contractId,
  fetchContainer,
}: ContainerDownloadButtonProps) {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function download(): void {
    setError(null)
    startTransition(async () => {
      const result = await fetchContainer(contractId)
      if (!result.ok) {
        setError(result.error ?? 'Allalaadimine ebaõnnestus.')
        return
      }
      const blob = new Blob([result.content], { type: result.mimeType })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    })
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className="text-label font-semibold text-primary transition-colors duration-hover ease-hover hover:text-primaryHover disabled:cursor-not-allowed disabled:text-ink-muted"
      >
        {pending ? 'Laadin…' : label}
      </button>
      {error ? <span className="text-label text-danger">{error}</span> : null}
    </span>
  )
}
